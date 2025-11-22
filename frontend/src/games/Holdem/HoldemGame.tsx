import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";

import { Stage, Container, Graphics, Sprite } from "@pixi/react";
import { Texture, Graphics as PixiGraphics, Point, Container as PixiContainer, Assets, SCALE_MODES } from "pixi.js";

import { CardKey } from "../shared";
import Card, { CardRef } from "../Blackjack/Card";
import PokerTableSvg from "@/assets/holdem/PokerTable.svg?raw";
import { Button } from "@/components/ui/button";
import { websocketRequest, RenderCustomPixiElement, waitFor, useContainerSize } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

import { GAME_STAGES } from "./constants";

import { HoldemGameState, HoldemResponse } from "./types";

const ACTION_TIMEOUT_MS = 20_000;
const NEXT_HAND_DELAY_MS = 3_000;

const TABLE_WIDTH = 2760;
const TABLE_HEIGHT = 1680;
const TABLE_CENTER = { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2 };

const SEAT_POSITIONS: {
  [seat: number]: { nameX: number; nameY: number; cardsX: number; cardsY: number };
} = {
  0: { nameX: 1380, nameY: 1400, cardsX: 1380, cardsY: 1100 }, // Hero (Bottom Center) - Reverted to closer to original (doubled)
  1: { nameX: 2160, nameY: 1160, cardsX: 2160, cardsY: 1020 }, // Right Bottom (doubled)
  2: { nameX: 2160, nameY: 460, cardsX: 2160, cardsY: 320 }, // Right Top (doubled)
  3: { nameX: 1380, nameY: 360, cardsX: 1380, cardsY: 220 }, // Top Center (doubled)
  4: { nameX: 640, nameY: 460, cardsX: 640, cardsY: 320 }, // Left Top (doubled)
  5: { nameX: 640, nameY: 1160, cardsX: 640, cardsY: 1020 }, // Left Bottom (doubled)
};

interface HoldemGameProps {
  tableId: number;
  onLeaveTable: () => void;
  textures: Record<CardKey, Texture>;
}

const HoldemGame: React.FC<HoldemGameProps> = ({ tableId, onLeaveTable, textures }) => {
  const { toast } = useToast();

  const [gameState, setGameState] = useState<HoldemGameState>({
    state: "idle",
    playerHand: [],
    communityCards: ["Ah", "Ks", "Td", "2c", "7d"],
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
  const playerCardRefs = useRef<{ [playerId: string]: CardRef[] }>({});
  const gameContainerRef = useRef<PixiContainer>();

  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(containerRef);

  const TableTexture = Texture.from(PokerTableSvg, {
    scaleMode: SCALE_MODES.LINEAR,
  });

  const scale = useMemo(() => {
    return Math.min(width / TABLE_WIDTH, height / TABLE_HEIGHT);
  }, [width, height]);

  // Funkcje do animacji kart
  const dealCard = async (cardKey: CardKey, position: Point, flip: boolean) => {
    if (!gameContainerRef.current || !textures) return null;

    const ref = await RenderCustomPixiElement(gameContainerRef.current, Card, {
      facing: "back",
      cardKey: cardKey,
      cardTextures: textures,
      x: TABLE_CENTER.x * scale,
      y: TABLE_CENTER.y - 200 * scale,
      scale: 0.4 * scale,
    });

    await ref.current?.moveTo(position, 100);
    if (flip) {
      await ref?.current?.setFacing("front");
    }
    return ref;
  };

  const clearCards = async () => {
    const allCards = [...communityCardRefs.current, ...Object.values(playerCardRefs.current).flat()];

    for (const card of allCards) {
      if (card?.spriteRef?.current) {
        await card.moveTo(new Point(TABLE_CENTER.x * scale, -200 * scale), 100);
        card.spriteRef.current?.destroy();
      }
    }

    communityCardRefs.current = [];
    playerCardRefs.current = {};
  };

  const setPartialGameState = useCallback((partial: Partial<HoldemGameState>) => setGameState((prev) => ({ ...prev, ...partial })), []);

  const restartActionTimer = useCallback(
    (isMyTurn: boolean) => {
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
    [tableId]
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

  const scheduleNextHand = useCallback(() => {
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
  }, [tableId]);

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

      const result = inHand ? null : (resp.result ?? null);

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
        scheduleNextHand();
      } else {
        restartActionTimer(isMyTurn);
      }
    },
    [restartActionTimer, scheduleNextHand]
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

  const leaveTable = useCallback(async () => {
    if (!ws.current || !tableId) {
      onLeaveTable();
      return;
    }
    try {
      await websocketRequest(ws.current, {
        command: "leave_table",
        tableId: tableId,
      });
    } catch {
      toast({
        title: "Błąd",
        description: "Nie udało się opuścić stołu",
        variant: "destructive",
      });
    } finally {
      onLeaveTable();
    }
  }, [tableId, onLeaveTable, toast]);

  const doAction = useCallback(
    (command: string, amount?: number) => {
      if (!ws.current || !tableId || gameState.state !== "playing" || !gameState.isMyTurn) return;
      if (actionLocked.current) return;

      const allowed = gameState.availableActions || [];
      if (!allowed.includes(command.toUpperCase())) return;

      actionLocked.current = true;
      websocketRequest(ws.current, {
        command,
        tableId: tableId,
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
    [tableId, gameState.state, gameState.isMyTurn, gameState.availableActions, toast]
  );

  const canAction = (command: string) => gameState.isMyTurn && gameState.state === "playing" && (gameState.availableActions || []).includes(command.toUpperCase());

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
          const position = new Point((TABLE_CENTER.x - 2 * 60 + index * 60) * scale, (TABLE_CENTER.y - 100) * scale);
          const cardRef = await dealCard(cardKey as CardKey, position, true);
          if (cardRef?.current) {
            communityCardRefs.current.push(cardRef.current);
          }
          await waitFor(200);
        }
      }

      // Animuj karty graczy
      const me = gameState.players.find((p) => p.you);
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
              const position = new Point((seatPos.cardsX + (index - 0.5) * 45) * scale, seatPos.cardsY * scale);
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
      for (const player of gameState.players.filter((p) => !p.you)) {
        const playerId = `player-${player.seatPosition}`;
        const expectedCards = gameState.state === "playing" ? 2 : 0;

        if (expectedCards > 0 && (!playerCardRefs.current[playerId] || playerCardRefs.current[playerId].length < expectedCards)) {
          playerCardRefs.current[playerId] = playerCardRefs.current[playerId] || [];
          const seatPos = SEAT_POSITIONS[player.seatPosition as keyof typeof SEAT_POSITIONS];
          if (seatPos) {
            for (let i = playerCardRefs.current[playerId].length; i < expectedCards; i++) {
              const position = new Point((seatPos.cardsX + (i - 0.5) * 45) * scale, seatPos.cardsY * scale);
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

  // Connect to WebSocket and join table on mount
  useEffect(() => {
    const socket = connectWs();

    const joinTable = () => {
      websocketRequest(socket, {
        command: "join_table",
        tableId: tableId,
        amount: 1000,
      }).catch((e) => {
        toast({
          title: "Błąd",
          description: e?.message || "Nie można dołączyć do stołu",
          variant: "destructive",
        });
      });
    };

    // Wait for connection to open
    if (socket.readyState === WebSocket.OPEN) {
      joinTable();
    } else {
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          joinTable();
        }
      }, 300);
    }

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [tableId, connectWs, toast]);

  const me = gameState.players.find((p) => p.you);

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-hidden">
      {/* Górny pasek */}
      <div className="absolute top-0 left-0 w-full z-50 p-6 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex gap-6 items-center shadow-xl">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Stół</span>
            <span className="text-xl font-bold text-white">#{tableId}</span>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Pula</span>
            <span className="text-xl font-bold text-primary">{gameState.pot}</span>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Etap</span>
            <span className="text-xl font-bold text-white capitalize">{gameState.gameStage.toLowerCase()}</span>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={leaveTable}
          className="pointer-events-auto border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all"
        >
          Opuść stół
        </Button>
      </div>

      {/* Main Game Container - Centered with Aspect Ratio */}
      <div className="flex-1 flex items-center justify-center pb-[150px] overflow-hidden">
        <div
          ref={containerRef}
          style={{
            aspectRatio: `${TableTexture.width} / ${TableTexture.height}`,
            height: "100%",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* PixiJS Stage */}
          <Stage
            width={width}
            height={height}
            options={{
              backgroundColor: { h: 224, s: 71.4, l: 4.1 },
              resolution: window.devicePixelRatio || 1,
              antialias: true,
              autoDensity: true,
            }}
            className="absolute inset-0"
          >
            <Container
              ref={(ref) => {
                if (ref) gameContainerRef.current = ref;
              }}
            >
              <Sprite roundPixels texture={TableTexture} scale={scale} />

              {/* Karty renderowane przez animacje */}
            </Container>
          </Stage>

          {/* HTML Overlay Wrapper - Full screen, no scale, projected coordinates */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Overlay wyniku gry */}
            {showResultOverlay && gameState.result && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-300 pointer-events-auto">
                <div className="bg-card border border-primary/20 p-12 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.2)] transform animate-in zoom-in duration-500 text-center max-w-2xl">
                  <h2 className="text-5xl font-extrabold text-white mb-6 drop-shadow-lg tracking-tight">
                    {gameState.result.includes("WIN") || gameState.result.includes("wyg") ? (
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">WYGRANA!</span>
                    ) : (
                      "Koniec rozdania"
                    )}
                  </h2>
                  <p className="text-2xl text-muted-foreground font-medium">{gameState.result}</p>
                </div>
              </div>
            )}

            {/* Info o graczach */}
            {gameState.players.map((p) => {
              const seatPos = SEAT_POSITIONS[p.seatPosition as keyof typeof SEAT_POSITIONS];
              if (!seatPos) return null;

              const isHero = p.you;
              const isTurn = p.currentTurn;
              const hasButton = gameState.dealerSeat !== null && p.seatPosition === gameState.dealerSeat;

              return (
                <div
                  key={p.seatPosition}
                  className={`absolute w-40 transition-all duration-300 pointer-events-auto ${isTurn ? "scale-110 z-20" : "scale-100 z-10"}`}
                  style={{
                    left: seatPos.nameX * scale,
                    top: seatPos.nameY * scale,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div
                    className={`relative overflow-hidden rounded-xl border backdrop-blur-md shadow-xl transition-all duration-300 ${
                      isHero ? "bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(234,179,8,0.15)]" : "bg-black/60 border-white/10"
                    } ${isTurn ? "ring-2 ring-primary ring-offset-2 ring-offset-black" : ""}`}
                  >
                    {p.folded && (
                      <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
                        <span className="text-white/50 font-bold uppercase tracking-widest text-xs">Pas</span>
                      </div>
                    )}

                    <div className="p-3 flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 w-full justify-center relative">
                        {hasButton && <div className="absolute left-0 w-5 h-5 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center shadow-lg">D</div>}
                        <span className={`font-bold truncate max-w-[100px] ${isHero ? "text-primary" : "text-white"}`}>{isHero ? "TY" : `Gracz ${p.userId}`}</span>
                      </div>

                      <div className="w-full h-px bg-white/10 my-1"></div>

                      <div className="flex flex-col items-center">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Stack</span>
                        <span className="font-mono font-bold text-white">{p.stack}</span>
                      </div>

                      {p.betThisStreet > 0 && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 border border-primary/30 text-primary px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
                          {p.betThisStreet}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Przyciski akcji - Moved outside game container to be at bottom of screen */}
      <div className="absolute bottom-0 left-0 w-full p-4 z-50 pointer-events-none">
        <div className="flex flex-col gap-2 items-center w-full max-w-3xl mx-auto pointer-events-auto">
          {gameState.isMyTurn && gameState.state === "playing" && (
            <>
              {/* Timer */}
              {actionSecondsLeft !== null && (
                <div className="bg-destructive/90 px-4 py-1 rounded-full shadow-2xl animate-pulse border border-white/10 mb-2">
                  <span className="text-white font-bold text-sm">Auto-fold za {actionSecondsLeft}s</span>
                </div>
              )}

              {/* Główne przyciski akcji */}
              <div className="bg-black/10 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl border border-white/5 w-full">
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  <Button
                    onClick={fold}
                    disabled={!canAction("fold")}
                    className="bg-destructive hover:bg-destructive/90 text-white font-bold text-base h-10 px-6 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                  >
                    Fold
                  </Button>
                  <Button
                    onClick={check}
                    disabled={!canAction("check")}
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold text-base h-10 px-6 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                  >
                    Check
                  </Button>
                  <Button
                    onClick={call}
                    disabled={!canAction("call")}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold text-base h-10 px-6 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                  >
                    Call
                  </Button>
                  <Button
                    onClick={raise}
                    disabled={!canAction("raise")}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base h-10 px-6 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                  >
                    Raise
                  </Button>
                  <Button
                    onClick={allIn}
                    disabled={!canAction("all_in")}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-base h-10 px-6 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                  >
                    All-In
                  </Button>
                </div>

                {/* Slider do betowania */}
                {(canAction("bet") || canAction("raise")) && (
                  <div className="flex flex-col gap-3 max-w-xl mx-auto bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground font-semibold text-xs uppercase tracking-wider min-w-[50px]">Kwota</span>
                      <Slider value={[betAmount]} onValueChange={(v: number[]) => setBetAmount(v[0])} min={gameState.currentBet || 10} max={me?.stack || 1000} step={10} className="flex-1" />
                      <div className="bg-black/40 px-3 py-1 rounded-lg border border-white/10 min-w-[80px] text-center">
                        <span className="text-primary font-mono font-bold text-lg">{betAmount}</span>
                      </div>
                    </div>
                    <Button
                      onClick={bet}
                      disabled={!canAction("bet")}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base h-10 rounded-lg shadow-lg disabled:opacity-50 transition-all"
                    >
                      Postaw {betAmount}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Info o ostatniej akcji */}
          {gameState.lastAction && !gameState.isMyTurn && (
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl animate-in slide-in-from-bottom-4">
              <span className="text-white font-medium text-sm">
                <span className="text-muted-foreground">Ostatnia akcja:</span> {gameState.lastAction}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HoldemGame;
