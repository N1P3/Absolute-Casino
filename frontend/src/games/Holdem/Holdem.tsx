import React, {
    useRef,
    useMemo,
    useState,
    useEffect,
    useCallback,
} from "react";

import { Stage, Sprite, Container, Graphics, Text } from "@pixi/react";
import { Texture, Graphics as PixiGraphics, Point, TextStyle, Container as PixiContainer } from "pixi.js";

import bg from "@/assets/holdem/background_holdem.png?url";
import { CardKey, loadCardTextures } from "../shared";
import Card, { CardRef } from "../Blackjack/Card";

import { Button } from "@/components/ui/button";
import { websocketRequest, RenderCustomPixiElement, waitFor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

import { GAME_STAGES } from "./constants";

import {
    HoldemGameState,
    HoldemResponse,
    HoldemPlayer,
} from "./types";

const TABLES = [
    { tableId: 1, label: "SB 5" },
    { tableId: 2, label: "SB 10" },
    { tableId: 3, label: "SB 25" },
    { tableId: 4, label: "SB 50" },
];

const ACTION_TIMEOUT_MS = 20_000;
const NEXT_HAND_DELAY_MS = 3_000;

type Screen = "lobby" | "table";

const TABLE_CENTER = { x: 640, y: 360 };

const SEAT_POSITIONS: {
    [seat: number]: { nameX: number; nameY: number; cardsX: number; cardsY: number };
} = {
    0: { nameX: 640, nameY: 660, cardsX: 640, cardsY: 560 },
    1: { nameX: 980, nameY: 600, cardsX: 980, cardsY: 520 },
    2: { nameX: 1160, nameY: 360, cardsX: 1080, cardsY: 320 },
    3: { nameX: 980, nameY: 120, cardsX: 980, cardsY: 200 },
    4: { nameX: 640, nameY: 60, cardsX: 640, cardsY: 160 },
    5: { nameX: 300, nameY: 120, cardsX: 300, cardsY: 200 },
    6: { nameX: 120, nameY: 360, cardsX: 200, cardsY: 320 },
    7: { nameX: 300, nameY: 600, cardsX: 300, cardsY: 520 },
};

const Holdem: React.FC = () => {
    const { toast } = useToast();

    const [screen, setScreen] = useState<Screen>("lobby");
    const [activeTableId, setActiveTableId] = useState<number | null>(null);

    const [textures, setTextures] = useState<Record<CardKey, Texture> | null>(
        null
    );
    const [loading, setLoading] = useState(true);

    const [gameState, setGameState] = useState<HoldemGameState>({
        state: "idle",
        playerHand: [],
        communityCards: [],
        pot: 0,
        currentBet: 0,
        gameStage: GAME_STAGES.PREFLOP,
        currentPlayerSeat: null,
        dealerSeat: null,
        isMyTurn: false,
        players: [],
        result: null,
        gameOver: false,
        availableActions: [],
        lastAction: null,
    });

    const [betAmount, setBetAmount] = useState<number>(10);

    const ws = useRef<WebSocket | undefined>(undefined);
    const actionLocked = useRef(false);
    const actionTimer = useRef<number | null>(null);
    const nextHandTimer = useRef<number | null>(null);

    const [actionDeadlineMs, setActionDeadlineMs] = useState<number | null>(null);
    const [actionSecondsLeft, setActionSecondsLeft] = useState<number | null>(null);
    const [showResultOverlay, setShowResultOverlay] = useState(false);

    const communityCardRefs = useRef<CardRef[]>([]);
    const playerCardRefs = useRef<{[playerId: string]: CardRef[]}>({});
    const gameContainerRef = useRef<PixiContainer>();

    const containerRef = useRef<HTMLDivElement>(null);

    const backgroundTexture = useMemo(() => Texture.from(bg), []);

    // Funkcje do animacji kart
    const dealCard = async (cardKey: CardKey, position: Point, flip: boolean) => {
        if (!gameContainerRef.current || !textures) return null;

        const ref = await RenderCustomPixiElement(gameContainerRef.current, Card, {
            facing: "back",
            cardKey: cardKey,
            cardTextures: textures,
            x: TABLE_CENTER.x,
            y: TABLE_CENTER.y - 200,
            scale: 0.6,
        });

        await ref.current?.moveTo(position);
        if (flip) {
            await ref?.current?.setFacing("front");
        }
        return ref;
    };

    const clearCards = async () => {
        const allCards = [
            ...communityCardRefs.current,
            ...Object.values(playerCardRefs.current).flat()
        ];

        for (const card of allCards) {
            if (card?.spriteRef?.current) {
                await card.moveTo(new Point(TABLE_CENTER.x, -200));
                card.spriteRef.current?.destroy();
            }
        }

        communityCardRefs.current = [];
        playerCardRefs.current = {};
    };

    const setPartialGameState = useCallback(
        (partial: Partial<HoldemGameState>) =>
            setGameState((prev) => ({ ...prev, ...partial })),
        []
    );

    const restartActionTimer = useCallback(
        (tableId: number | null, isMyTurn: boolean) => {
            if (actionTimer.current) {
                window.clearTimeout(actionTimer.current);
                actionTimer.current = null;
            }
            setActionDeadlineMs(null);
            setActionSecondsLeft(null);

            if (!isMyTurn || !tableId || !ws.current) return;

            const deadline = Date.now() + ACTION_TIMEOUT_MS;
            setActionDeadlineMs(deadline);

            actionTimer.current = window.setTimeout(async () => {
                try {
                    await websocketRequest(ws.current!, {
                        command: "fold",
                        tableId,
                    });
                } catch (e) {
                    console.error("Action timeout error", e);
                } finally {
                    setActionDeadlineMs(null);
                    setActionSecondsLeft(null);
                }
            }, ACTION_TIMEOUT_MS);
        },
        []
    );

    useEffect(() => {
        if (!actionDeadlineMs || !gameState.isMyTurn) {
            setActionSecondsLeft(null);
            return;
        }

        const update = () => {
            const diff = actionDeadlineMs - Date.now();
            if (diff <= 0) {
                setActionSecondsLeft(0);
            } else {
                setActionSecondsLeft(Math.ceil(diff / 1000));
            }
        };

        update();
        const id = window.setInterval(update, 250);
        return () => window.clearInterval(id);
    }, [actionDeadlineMs, gameState.isMyTurn]);

    const scheduleNextHand = useCallback(
        (tableId: number | null) => {
            if (!tableId || !ws.current) return;

            if (nextHandTimer.current) {
                window.clearTimeout(nextHandTimer.current);
                nextHandTimer.current = null;
            }

            nextHandTimer.current = window.setTimeout(async () => {
                if (!ws.current) return;
                try {
                    await websocketRequest(ws.current, {
                        command: "start_hand",
                        tableId,
                    });
                } catch (e) {
                    console.error("start_hand error", e);
                } finally {
                    nextHandTimer.current = null;
                }
            }, NEXT_HAND_DELAY_MS);
        },
        []
    );

    const updateFromGameState = useCallback(
        (resp: HoldemResponse) => {
            const players = resp.players || [];
            const isMyTurn = players.some((p) => p.you && p.currentTurn);

            actionLocked.current = false;

            const hasPlayers = players.length > 0;
            const inHand = !!resp.street;

            let playerHand = resp.viewerHoleCards || [];
            let communityCards = resp.communityCards || [];
            let state: HoldemGameState["state"];

            if (!hasPlayers) {
                state = "idle";
                playerHand = [];
                communityCards = [];
            } else if (!inHand) {
                state = "waiting";
                playerHand = [];
                communityCards = [];
            } else {
                state = "playing";
            }

            const result =
                inHand
                    ? null
                    : (resp.result ?? null);

            const newState: HoldemGameState = {
                state,
                playerHand,
                communityCards,
                pot: resp.pot ?? 0,
                currentBet: resp.currentBet ?? 0,
                gameStage: resp.street || GAME_STAGES.PREFLOP,
                currentPlayerSeat: resp.currentPlayerSeat ?? null,
                dealerSeat: resp.dealerSeat ?? null,
                isMyTurn,
                players,
                gameOver: !inHand && !!resp.result,
                result,
                availableActions: resp.availableActions || [],
                lastAction: resp.lastAction ?? null,
            };

            setGameState(newState);

            if (!inHand) {
                if (actionTimer.current) {
                    window.clearTimeout(actionTimer.current);
                    actionTimer.current = null;
                }
                setActionDeadlineMs(null);
                setActionSecondsLeft(null);
                scheduleNextHand(resp.tableId ?? activeTableId);
            } else {
                restartActionTimer(resp.tableId ?? activeTableId, isMyTurn);
            }
        },
        [restartActionTimer, scheduleNextHand, activeTableId]
    );

    const connectWs = useCallback(() => {
        const socket = new WebSocket("ws://localhost:8081/ws/holdem");
        console.log("Opening WS Holdem to ws://localhost:8081/ws/holdem");

        socket.onopen = () => {
            console.log("Połączenie WS Holdem nawiązane");
            ws.current = socket;
        };

        socket.onmessage = (event) => {
            console.log("WS Holdem message:", event.data);
            try {
                const data = JSON.parse(event.data) as HoldemResponse | { type: "ERROR"; message: string };

                if (data.type === "ERROR") {
                    toast({
                        title: "Błąd akcji",
                        description: (data as any).message || "Nieprawidłowy ruch",
                        variant: "destructive",
                    });
                    return;
                }

                if (data.type === "GAME_STATE") {
                    updateFromGameState(data as HoldemResponse);
                }
            } catch (e) {
                console.error("Bad WS message", e);
            }
        };

        socket.onclose = () => {
            console.log("WS Holdem zamknięty");
            ws.current = undefined;
            setPartialGameState({ state: "idle", isMyTurn: false });
            setActionDeadlineMs(null);
            setActionSecondsLeft(null);
            if (nextHandTimer.current) {
                window.clearTimeout(nextHandTimer.current);
                nextHandTimer.current = null;
            }
        };

        socket.onerror = () => {
            toast({
                title: "Błąd",
                description: "Błąd połączenia z serwerem (Holdem)",
                variant: "destructive",
            });
        };

        return socket;
    }, [toast, updateFromGameState, setPartialGameState]);

    const enterTable = (tableId: number) => {
        setActiveTableId(tableId);
        setGameState({
            state: "idle",
            playerHand: [],
            communityCards: [],
            pot: 0,
            currentBet: 0,
            gameStage: GAME_STAGES.PREFLOP,
            currentPlayerSeat: null,
            dealerSeat: null,
            isMyTurn: false,
            players: [],
            result: null,
            gameOver: false,
            availableActions: [],
            lastAction: null,
        });
        setScreen("table");
    };

    const leaveTableToLobby = () => {
        setActiveTableId(null);
        setScreen("lobby");
        setGameState({
            state: "idle",
            playerHand: [],
            communityCards: [],
            pot: 0,
            currentBet: 0,
            gameStage: GAME_STAGES.PREFLOP,
            currentPlayerSeat: null,
            dealerSeat: null,
            isMyTurn: false,
            players: [],
            result: null,
            gameOver: false,
            availableActions: [],
            lastAction: null,
        });
        setActionDeadlineMs(null);
        setActionSecondsLeft(null);
        if (actionTimer.current) {
            window.clearTimeout(actionTimer.current);
            actionTimer.current = null;
        }
        if (nextHandTimer.current) {
            window.clearTimeout(nextHandTimer.current);
            nextHandTimer.current = null;
        }
    };

    const joinTable = useCallback(async () => {
        if (!activeTableId) return;

        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            connectWs();
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (!ws.current) {
            toast({
                title: "Błąd",
                description: "Brak połączenia z serwerem",
                variant: "destructive",
            });
            return;
        }

        try {
            await websocketRequest(ws.current, {
                command: "join_table",
                tableId: activeTableId,
                amount: 1000,
            });
        } catch (e: any) {
            toast({
                title: "Błąd",
                description: e?.message || "Nie można dołączyć do stołu",
                variant: "destructive",
            });
        }
    }, [activeTableId, connectWs, toast]);

    const leaveTable = useCallback(async () => {
        if (!ws.current || !activeTableId) {
            leaveTableToLobby();
            return;
        }
        try {
            await websocketRequest(ws.current, {
                command: "leave_table",
                tableId: activeTableId,
            });
        } catch {
            toast({
                title: "Błąd",
                description: "Nie udało się opuścić stołu",
                variant: "destructive",
            });
        } finally {
            leaveTableToLobby();
        }
    }, [activeTableId]);

    const doAction = useCallback(
        (command: string, amount?: number) => {
            if (
                !ws.current ||
                !activeTableId ||
                gameState.state !== "playing" ||
                !gameState.isMyTurn
            )
                return;
            if (actionLocked.current) return;

            const allowed = gameState.availableActions || [];
            if (!allowed.includes(command.toUpperCase())) return;

            actionLocked.current = true;
            websocketRequest(ws.current, {
                command,
                tableId: activeTableId,
                ...(amount !== undefined ? { amount } : {}),
            })
                .then(() => {})
                .catch((e) => {
                    actionLocked.current = false;
                    toast({
                        title: "Błąd",
                        description: e?.message || "Akcja nie powiodła się",
                        variant: "destructive",
                    });
                });
        },
        [
            activeTableId,
            gameState.state,
            gameState.isMyTurn,
            gameState.availableActions,
            toast,
        ]
    );

    const canAction = (command: string) =>
        gameState.isMyTurn &&
        gameState.state === "playing" &&
        (gameState.availableActions || []).includes(command.toUpperCase());

    const call = () => doAction("call");
    const check = () => doAction("check");
    const fold = () => doAction("fold");
    const bet = () => doAction("bet", Math.max(1, betAmount));
    const raise = () => doAction("raise", Math.max(1, betAmount));
    const allIn = () => doAction("all_in");

    // Animacja kart podczas rozdania
    useEffect(() => {
        if (!textures || !gameState.players.length || !gameContainerRef.current) return;

        const animateCards = async () => {
            // Animuj karty community
            if (gameState.communityCards.length > communityCardRefs.current.length) {
                const newCards = gameState.communityCards.slice(communityCardRefs.current.length);
                for (let i = 0; i < newCards.length; i++) {
                    const cardKey = newCards[i];
                    const index = communityCardRefs.current.length;
                    const position = new Point(
                        TABLE_CENTER.x - 2 * 60 + index * 60,
                        TABLE_CENTER.y
                    );
                    const cardRef = await dealCard(cardKey as CardKey, position, true);
                    if (cardRef?.current) {
                        communityCardRefs.current.push(cardRef.current);
                    }
                    await waitFor(200);
                }
            }

            // Animuj karty graczy
            const me = gameState.players.find(p => p.you);
            if (me && gameState.playerHand.length > 0) {
                const playerId = `player-${me.seatPosition}`;
                if (!playerCardRefs.current[playerId] || playerCardRefs.current[playerId].length < gameState.playerHand.length) {
                    playerCardRefs.current[playerId] = playerCardRefs.current[playerId] || [];
                    const seatPos = SEAT_POSITIONS[me.seatPosition as keyof typeof SEAT_POSITIONS];
                    if (seatPos) {
                        const newCards = gameState.playerHand.slice(playerCardRefs.current[playerId].length);
                        for (let i = 0; i < newCards.length; i++) {
                            const cardKey = newCards[i];
                            const index = playerCardRefs.current[playerId].length;
                            const position = new Point(
                                seatPos.cardsX + (index - 0.5) * 45,
                                seatPos.cardsY
                            );
                            const cardRef = await dealCard(cardKey as CardKey, position, true);
                            if (cardRef?.current) {
                                playerCardRefs.current[playerId].push(cardRef.current);
                            }
                            await waitFor(200);
                        }
                    }
                }
            }

            // Animuj karty przeciwników (zakryte)
            for (const player of gameState.players.filter(p => !p.you)) {
                const playerId = `player-${player.seatPosition}`;
                const expectedCards = gameState.state === "playing" ? 2 : 0;

                if (expectedCards > 0 && (!playerCardRefs.current[playerId] || playerCardRefs.current[playerId].length < expectedCards)) {
                    playerCardRefs.current[playerId] = playerCardRefs.current[playerId] || [];
                    const seatPos = SEAT_POSITIONS[player.seatPosition as keyof typeof SEAT_POSITIONS];
                    if (seatPos) {
                        for (let i = playerCardRefs.current[playerId].length; i < expectedCards; i++) {
                            const position = new Point(
                                seatPos.cardsX + (i - 0.5) * 45,
                                seatPos.cardsY
                            );
                            const cardRef = await dealCard("BB" as CardKey, position, false);
                            if (cardRef?.current) {
                                playerCardRefs.current[playerId].push(cardRef.current);
                            }
                            await waitFor(150);
                        }
                    }
                }
            }
        };

        animateCards();
    }, [gameState.communityCards, gameState.playerHand, gameState.players, gameState.state, textures]);

    // Czyszczenie kart po zakończeniu gry i pokazanie wyniku
    useEffect(() => {
        if (gameState.gameOver && gameState.result) {
            setShowResultOverlay(true);
            setTimeout(() => {
                setShowResultOverlay(false);
                clearCards();
            }, NEXT_HAND_DELAY_MS);
        }
    }, [gameState.gameOver, gameState.result]);

    useEffect(() => {
        let destroyed = false;

        const init = async () => {
            try {
                const cardTextures = await loadCardTextures();
                if (destroyed) return;
                setTextures(cardTextures);
                setLoading(false);
            } catch (e) {
                console.error("loadCardTextures error", e);
                if (destroyed) return;
                setTextures({} as any);
                setLoading(false);
                toast({
                    title: "Błąd",
                    description: "Nie udało się załadować zasobów kart",
                    variant: "destructive",
                });
            }
        };

        init();

        return () => {
            destroyed = true;
        };
    }, [toast]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                Ładowanie…
            </div>
        );
    }

    if (screen === "lobby") {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-gray-900 via-green-900 to-gray-900">
                <div className="text-center">
                    <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-2xl">Texas Hold'em</h1>
                    <p className="text-2xl text-green-300 mb-8">Wybierz stół i dołącz do gry</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    {TABLES.map((t) => (
                        <Button
                            key={t.tableId}
                            size="lg"
                            className="min-w-[200px] h-24 text-3xl font-bold bg-gradient-to-br from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 shadow-2xl transform transition hover:scale-105"
                            onClick={() => {
                                enterTable(t.tableId);
                                // Auto-dołączanie po wyborze blinda
                                setTimeout(() => {
                                    if (ws.current?.readyState === WebSocket.OPEN) {
                                        websocketRequest(ws.current, {
                                            command: "join_table",
                                            tableId: t.tableId,
                                            amount: 1000,
                                        }).catch((e) => {
                                            toast({
                                                title: "Błąd",
                                                description: e?.message || "Nie można dołączyć do stołu",
                                                variant: "destructive",
                                            });
                                        });
                                    } else {
                                        const socket = connectWs();
                                        setTimeout(() => {
                                            if (socket.readyState === WebSocket.OPEN) {
                                                websocketRequest(socket, {
                                                    command: "join_table",
                                                    tableId: t.tableId,
                                                    amount: 1000,
                                                }).catch((e) => {
                                                    toast({
                                                        title: "Błąd",
                                                        description: e?.message || "Nie można dołączyć do stołu",
                                                        variant: "destructive",
                                                    });
                                                });
                                            }
                                        }, 300);
                                    }
                                }, 100);
                            }}
                        >
                            {t.label}
                        </Button>
                    ))}
                </div>
            </div>
        );
    }

    const me = gameState.players.find((p) => p.you);

    return (
        <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-black">
            {/* Górny pasek - tylko info o stole i przycisk powrotu */}
            <div className="flex justify-between items-center p-4 bg-black/80 text-white border-b border-green-800">
                <div className="flex gap-4 items-center">
                    <span className="font-bold text-2xl text-green-400">
                        Stół {activeTableId}
                    </span>
                    <span className="text-lg text-gray-300">
                        Pot: <span className="text-yellow-400 font-bold">{gameState.pot}</span>
                    </span>
                    <span className="text-lg text-gray-300">
                        {gameState.gameStage}
                    </span>
                </div>

                <Button
                    variant="outline"
                    onClick={leaveTable}
                    className="bg-red-600 hover:bg-red-700 text-white border-red-700"
                >
                    Opuść stół
                </Button>
            </div>

            <div ref={containerRef} className="flex-1 relative">
                <Stage
                    width={1280}
                    height={720}
                    options={{
                        backgroundColor: 0x004400,
                        resolution: window.devicePixelRatio || 1,
                    }}
                >
                    <Container
                        ref={(ref) => {
                            if (ref) gameContainerRef.current = ref;
                        }}
                    >
                        <Sprite
                            texture={backgroundTexture}
                            x={0}
                            y={0}
                            width={1280}
                            height={720}
                        />

                        {gameState.isMyTurn && (
                            <Graphics
                                draw={(g: PixiGraphics) => {
                                    g.clear();
                                    g.lineStyle(4, 0x00ff00, 0.9);
                                    g.drawRoundedRect(TABLE_CENTER.x - 260, TABLE_CENTER.y - 100, 520, 200, 20);
                                }}
                            />
                        )}

                        {/* Karty renderowane przez animacje */}
                    </Container>
                </Stage>

                {/* Overlay wyniku gry */}
                {showResultOverlay && gameState.result && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-300">
                        <div className="bg-gradient-to-br from-green-600 to-green-900 p-12 rounded-3xl shadow-2xl border-4 border-yellow-500 transform animate-in zoom-in duration-500">
                            <h2 className="text-6xl font-bold text-white mb-6 text-center drop-shadow-lg">
                                {gameState.result.includes("WIN") || gameState.result.includes("wyg") ? "🎉 WYGRANA! 🎉" : "Koniec rozdania"}
                            </h2>
                            <p className="text-3xl text-yellow-200 text-center font-semibold">
                                {gameState.result}
                            </p>
                        </div>
                    </div>
                )}

                {/* Info o graczach - lepsze czcionki i kontrast */}
                {gameState.players.map((p) => {
                    const seatPos = SEAT_POSITIONS[p.seatPosition as keyof typeof SEAT_POSITIONS];
                    if (!seatPos) return null;

                    const isHero = p.you;
                    const isTurn = p.currentTurn;
                    const hasButton = gameState.dealerSeat !== null && p.seatPosition === gameState.dealerSeat;

                    return (
                        <div
                            key={p.seatPosition}
                            className={`absolute px-4 py-3 rounded-xl flex flex-col gap-1 transition-all duration-300 ${
                                isHero
                                    ? "bg-gradient-to-br from-yellow-600/90 to-yellow-800/90 border-2 border-yellow-400 shadow-2xl"
                                    : "bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-2 border-gray-600"
                            } ${
                                isTurn
                                    ? "shadow-[0_0_30px_rgba(16,185,129,1)] scale-110"
                                    : "shadow-xl"
                            } ${p.folded ? "opacity-50 grayscale" : ""}`}
                            style={{
                                left: seatPos.nameX,
                                top: seatPos.nameY,
                                transform: `translate(-50%, -50%) ${isTurn ? 'scale(1.1)' : 'scale(1)'}`,
                            }}
                        >
                            <div className="flex items-center gap-2">
                                {hasButton && (
                                    <div className="w-6 h-6 rounded-full bg-yellow-400 text-black text-sm font-bold flex items-center justify-center shadow-lg">
                                        D
                                    </div>
                                )}
                                <span className={`font-bold text-lg ${isHero ? "text-white" : "text-gray-100"}`}>
                                    {isHero ? "TY" : `Gracz ${p.userId}`}
                                </span>
                            </div>
                            <div className="flex gap-3 text-base">
                                <span className="text-green-300 font-semibold">Stack: {p.stack}</span>
                                {p.betThisStreet > 0 && (
                                    <span className="text-yellow-300 font-semibold">Bet: {p.betThisStreet}</span>
                                )}
                            </div>
                            {p.folded && (
                                <span className="text-red-400 font-bold text-sm">FOLD</span>
                            )}
                            {isTurn && (
                                <span className="text-green-300 font-bold text-sm animate-pulse">
                                    ▶ RUCH
                                </span>
                            )}
                        </div>
                    );
                })}

                {/* Przyciski akcji - przeprojektowane na dole, pięknie */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-4 items-center z-20">
                    {gameState.isMyTurn && gameState.state === "playing" && (
                        <>
                            {/* Timer */}
                            {actionSecondsLeft !== null && (
                                <div className="bg-red-600/90 px-6 py-2 rounded-full shadow-2xl animate-pulse">
                                    <span className="text-white font-bold text-xl">
                                        Auto-fold za {actionSecondsLeft}s
                                    </span>
                                </div>
                            )}

                            {/* Główne przyciski akcji */}
                            <div className="bg-black/80 backdrop-blur-md px-8 py-6 rounded-3xl shadow-2xl border-2 border-green-700">
                                <div className="flex gap-3 mb-4">
                                    <Button
                                        onClick={fold}
                                        disabled={!canAction("fold")}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-8 py-6 disabled:opacity-30"
                                        size="lg"
                                    >
                                        Fold
                                    </Button>
                                    <Button
                                        onClick={check}
                                        disabled={!canAction("check")}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 py-6 disabled:opacity-30"
                                        size="lg"
                                    >
                                        Check
                                    </Button>
                                    <Button
                                        onClick={call}
                                        disabled={!canAction("call")}
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold text-lg px-8 py-6 disabled:opacity-30"
                                        size="lg"
                                    >
                                        Call
                                    </Button>
                                    <Button
                                        onClick={raise}
                                        disabled={!canAction("raise")}
                                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-lg px-8 py-6 disabled:opacity-30"
                                        size="lg"
                                    >
                                        Raise
                                    </Button>
                                    <Button
                                        onClick={allIn}
                                        disabled={!canAction("all_in")}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg px-8 py-6 disabled:opacity-30"
                                        size="lg"
                                    >
                                        All-In
                                    </Button>
                                </div>

                                {/* Slider do betowania */}
                                {(canAction("bet") || canAction("raise")) && (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-4">
                                            <span className="text-white font-semibold text-lg min-w-[80px]">Kwota:</span>
                                            <Slider
                                                value={[betAmount]}
                                                onValueChange={(v) => setBetAmount(v[0])}
                                                min={gameState.currentBet || 10}
                                                max={me?.stack || 1000}
                                                step={10}
                                                className="w-80"
                                            />
                                            <span className="text-yellow-400 font-bold text-2xl min-w-[100px]">
                                                {betAmount}
                                            </span>
                                        </div>
                                        <Button
                                            onClick={bet}
                                            disabled={!canAction("bet")}
                                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg py-4 disabled:opacity-30"
                                        >
                                            Bet {betAmount}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Info o ostatniej akcji */}
                    {gameState.lastAction && !gameState.isMyTurn && (
                        <div className="bg-blue-600/90 px-6 py-3 rounded-2xl shadow-xl">
                            <span className="text-white font-semibold text-lg">
                                Ostatnia akcja: {gameState.lastAction}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Holdem;
