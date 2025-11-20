import React, {
    useRef,
    useMemo,
    useState,
    useEffect,
    useCallback,
} from "react";

import { Stage, Sprite, Container, Graphics } from "@pixi/react";
import { Texture, Graphics as PixiGraphics } from "pixi.js";

import bg from "@/assets/holdem/background_holdem.png?url";
import { CardKey, loadCardTextures } from "../shared";
import Card, { CardRef } from "../Blackjack/Card";

import { Button } from "@/components/ui/button";
import { websocketRequest } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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

    const cardRefs = useRef<Record<string, CardRef | null>>({});
    const communityCardRefs = useRef<Record<string, CardRef | null>>({});

    const containerRef = useRef<HTMLDivElement>(null);

    const backgroundTexture = useMemo(() => Texture.from(bg), []);

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
            <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                <h1 className="text-3xl mb-4">Texas Hold&apos;em</h1>
                <p className="text-lg mb-2">
                    Wybierz stół (stawka ustawiana na backendzie po tableId):
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                    {TABLES.map((t) => (
                        <Button
                            key={t.tableId}
                            size="lg"
                            className="min-w-[180px] text-xl"
                            onClick={() => enterTable(t.tableId)}
                        >
                            Stół {t.tableId} – {t.label}
                        </Button>
                    ))}
                </div>
            </div>
        );
    }

    const me = gameState.players.find((p) => p.you);
    const others = gameState.players.filter((p) => !p.you);
    const hasButton = (p: HoldemPlayer) =>
        gameState.dealerSeat !== null &&
        p.seatPosition === gameState.dealerSeat;

    const isSeatTurn = (p: HoldemPlayer) => !!p.currentTurn;

    const playerCards: JSX.Element[] = [];

    if (me && gameState.playerHand.length > 0 && textures) {
        const seatPos =
            SEAT_POSITIONS[me.seatPosition as keyof typeof SEAT_POSITIONS];
        if (seatPos) {
            gameState.playerHand.forEach((cardKey, index) => {
                playerCards.push(
                    <Card
                        key={`me-${index}`}
                        ref={(ref) => (cardRefs.current[`me-${index}`] = ref)}
                        cardKey={cardKey as CardKey}
                        facing="front"
                        cardTextures={textures}
                        x={seatPos.cardsX + (index - 0.5) * 45}
                        y={seatPos.cardsY}
                        scale={0.6}
                    />
                );
            });
        }
    }

    if (textures) {
        others.forEach((p) => {
            const seatPos =
                SEAT_POSITIONS[p.seatPosition as keyof typeof SEAT_POSITIONS];
            if (!seatPos) return;

            [0, 1].forEach((index) => {
                playerCards.push(
                    <Card
                        key={`villain-${p.seatPosition}-${index}`}
                        ref={(ref) =>
                            (cardRefs.current[`villain-${p.seatPosition}-${index}`] = ref)
                        }
                        cardKey={"BB" as CardKey}
                        facing="back"
                        cardTextures={textures}
                        x={seatPos.cardsX + (index - 0.5) * 45}
                        y={seatPos.cardsY}
                        scale={0.55}
                    />
                );
            });
        });
    }

    const BoardGlow: React.FC = () => {
        if (!gameState.isMyTurn) return null;
        return (
            <Graphics
                draw={(g: PixiGraphics) => {
                    g.clear();
                    g.lineStyle(3, 0x00ff00, 0.8);
                    g.drawRoundedRect(TABLE_CENTER.x - 240, TABLE_CENTER.y - 80, 480, 160, 18);
                }}
            />
        );
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-4 bg-black/70 text-white">
                <div className="flex gap-2 items-center">
                    <span className="font-semibold text-lg">
                        Stół {activeTableId}
                    </span>
                    {gameState.state === "idle" && (
                        <Button onClick={joinTable}>
                            Dołącz do stołu
                        </Button>
                    )}
                    {gameState.state !== "idle" && (
                        <span className="text-sm px-2 py-1 rounded bg-emerald-700/60">
                            Siedzisz przy stole
                        </span>
                    )}
                    <Button variant="outline" onClick={leaveTable}>
                        Lobby
                    </Button>
                </div>

                <div className="flex flex-col items-end text-sm">
                    <div>Etap: {gameState.gameStage}</div>
                    <div>Pot: {gameState.pot}</div>
                    <div>Aktualny bet: {gameState.currentBet}</div>
                    <div className="text-[10px] opacity-70">
                        Złote B = button, zielona poświata = Twój ruch
                    </div>
                </div>
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
                    <Sprite
                        texture={backgroundTexture}
                        x={0}
                        y={0}
                        width={1280}
                        height={720}
                    />

                    <BoardGlow />

                    <Container>
                        {gameState.communityCards.map((cardKey, index) => (
                            <Card
                                key={`board-${index}`}
                                ref={(ref) =>
                                    (communityCardRefs.current[`board-${index}`] = ref)
                                }
                                cardKey={cardKey as CardKey}
                                facing="front"
                                cardTextures={textures || ({} as any)}
                                x={TABLE_CENTER.x - 2 * 60 + index * 60}
                                y={TABLE_CENTER.y}
                                scale={0.65}
                            />
                        ))}

                        {playerCards}
                    </Container>
                </Stage>

                {gameState.players.map((p) => {
                    const seatPos =
                        SEAT_POSITIONS[p.seatPosition as keyof typeof SEAT_POSITIONS];
                    if (!seatPos) return null;

                    const isHero = p.you;
                    const isTurn = isSeatTurn(p);

                    return (
                        <div
                            key={p.seatPosition}
                            className={`absolute text-xs px-2 py-1 rounded flex items-center gap-1 transition-shadow ${
                                isHero ? "border border-emerald-400 bg-black/80" : "bg-black/70"
                            } ${
                                isTurn
                                    ? "shadow-[0_0_16px_rgba(16,185,129,0.9)]"
                                    : "shadow-none"
                            } ${p.folded ? "opacity-40" : ""}`}
                            style={{
                                left: seatPos.nameX,
                                top: seatPos.nameY,
                                transform: "translate(-50%, -50%)",
                            }}
                        >
                            {hasButton(p) && (
                                <div className="w-4 h-4 rounded-full bg-yellow-400 text-black text-[10px] flex items-center justify-center mr-1">
                                    B
                                </div>
                            )}
                            <span className="font-semibold">
                                {isHero ? "Ty" : `Gracz ${p.userId}`}
                            </span>
                            <span>stack: {p.stack}</span>
                            <span>bet: {p.betThisStreet}</span>
                            {isTurn && (
                                <span className="text-emerald-400 ml-1 text-[10px]">
                                    ruch
                                </span>
                            )}
                        </div>
                    );
                })}

                <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-black/70 text-white p-3 rounded w-[360px]">
                    <div className="text-sm mb-1">
                        {gameState.state === "waiting" &&
                            (gameState.result || "Czekanie na kolejne rozdanie...")}
                        {gameState.state === "idle" && "Nie siedzisz przy stole"}
                        {gameState.state === "playing" &&
                            (gameState.isMyTurn
                                ? "Twój ruch"
                                : "Ruch przeciwnika")}
                    </div>

                    {gameState.isMyTurn && actionSecondsLeft !== null && (
                        <div className="text-xs text-red-300 mb-1">
                            Auto-fold za {actionSecondsLeft}s
                        </div>
                    )}

                    {gameState.lastAction && (
                        <div className="text-xs text-emerald-300 mb-1">
                            {gameState.lastAction}
                        </div>
                    )}

                    <div className="flex gap-2 items-center">
                        <span>Bet:</span>
                        <input
                            type="number"
                            className="w-20 px-2 py-1 rounded bg-background text-foreground text-black"
                            value={betAmount}
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            min={1}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        <Button onClick={call} disabled={!canAction("call")}>
                            Call
                        </Button>
                        <Button onClick={check} disabled={!canAction("check")}>
                            Check
                        </Button>
                        <Button onClick={fold} disabled={!canAction("fold")}>
                            Fold
                        </Button>
                        <Button onClick={bet} disabled={!canAction("bet")}>
                            Bet
                        </Button>
                        <Button onClick={raise} disabled={!canAction("raise")}>
                            Raise
                        </Button>
                        <Button onClick={allIn} disabled={!canAction("all_in")}>
                            All-in
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Holdem;
