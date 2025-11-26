import React, { useRef, useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { websocketRequest } from "@/lib/utils";
import { GAME_STAGES } from "./constants";
import { HoldemGameState, HoldemResponse } from "./types";
import { CardKey } from "../shared";

// 3D Imports
import Scene from "./Holdem3D/Scene";
import Card from "./Holdem3D/Card";
import PlayerSeat from "./Holdem3D/PlayerSeat";
import Chips from "./Holdem3D/Chips";
import { useCardTextures } from "./Holdem3D/useCardTextures";
import { calculateCardsPosition } from "./Holdem3D/cardUtils";

const ACTION_TIMEOUT_MS = 20_000;
const NEXT_HAND_DELAY_MS = 3_000;

// 3D Positions
const SEAT_POSITIONS_3D: { [seat: number]: [number, number, number] } = {
  0: [0, 0, 3], // Hero (Bottom Center)
  1: [4.2, 0, 2.2], // Right Bottom
  2: [4.2, 0, -2.2], // Right Top
  3: [0, 0, -3], // Top Center
  4: [-4.2, 0, -2.2], // Left Top
  5: [-4.2, 0, 2.2], // Left Bottom
};
const getRelativeCenterForPosition = (position: number): [number, number, number] => {
  switch (position) {
    case 0:
    case 3:
      return [0, 0, 0];
    case 1:
    case 2:
      return [2.1, 0, 0];
    case 4:
    case 5:
      return [-2.1, 0, 0];
    default:
      return [0, 0, 0];
  }
};

const COMMUNITY_CARDS_START_X = -1.3;
const CARD_SPACING = 0.7;

interface HoldemGameProps {
  tableId: number;
  onLeaveTable: () => void;
  // textures prop is no longer needed as we load them in R3F, but keeping signature for now or we can remove it
  textures?: any;
}

const HoldemGame: React.FC<HoldemGameProps> = ({ tableId, onLeaveTable }) => {
  const { toast } = useToast();

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

  // WebSocket Logic (Same as before)
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

  useEffect(() => {
    if (gameState.gameOver && gameState.result) {
      setShowResultOverlay(true);
      setTimeout(() => {
        setShowResultOverlay(false);
      }, NEXT_HAND_DELAY_MS);
    }
  }, [gameState.gameOver, gameState.result]);

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
      {/* Top Bar */}
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

      {/* 3D Scene */}
      <div className="flex-1 relative p-12">
        <Scene>
          <Game3DContent state={gameState} />
        </Scene>

        {/* Result Overlay */}
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
      </div>

      {/* Action Buttons */}
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

              {/* Main Actions */}
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

                {/* Bet Slider */}
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

          {/* Last Action Info */}
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

const Game3DContent: React.FC<{
  state: HoldemGameState;
}> = ({ state }) => {
  const textures = useCardTextures();
  //   const tableCenter: [number, number, number] = [0, 0, 0];

  return (
    <>
      {/* Community Cards */}
      {state.communityCards.map((card, i) => (
        <Card key={`community-${i}`} cardKey={card as CardKey} textures={textures} position={[COMMUNITY_CARDS_START_X + i * CARD_SPACING, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.25} />
      ))}

      {/* Players */}
      {state.players.map((player) => {
        const pos = SEAT_POSITIONS_3D[player.seatPosition] || [0, 0, 0];
        const relativeCenter = getRelativeCenterForPosition(player.seatPosition);
        const isHero = player.you;
        const cardsPos = calculateCardsPosition(pos, relativeCenter, !isHero && !player.folded);

        return (
          <group key={player.seatPosition}>
            <PlayerSeat
              player={player}
              position={pos}
              isActive={state.currentPlayerSeat === player.seatPosition}
              isHero={isHero}
              dealer={state.dealerSeat === player.seatPosition}
              center={relativeCenter}
            />

            {/* Chips */}
            {player.betThisStreet > 0 && <Chips amount={player.betThisStreet} position={[pos[0] * 0.5, 0.06, pos[2] * 0.5]} />}

            {/* Cards */}
            {/* Hero Cards or if we want to force show cards for testing */}
            {isHero && state.playerHand ? (
              <>
                <Card cardKey={state.playerHand[0] as CardKey} textures={textures} position={cardsPos[0].positon} rotation={cardsPos[0].rotation} scale={0.2} />
                <Card cardKey={state.playerHand[1] as CardKey} textures={textures} position={cardsPos[1].positon} rotation={cardsPos[1].rotation} scale={0.2} />
              </>
            ) : (
              // Face down cards for others if no hole cards set
              !isHero &&
              !player.folded &&
              state.state === "playing" && (
                <>
                  <Card cardKey="BB" textures={textures} position={cardsPos[0].positon} rotation={cardsPos[0].rotation} scale={0.2} flipped={true} />
                  <Card cardKey="BB" textures={textures} position={cardsPos[1].positon} rotation={cardsPos[1].rotation} scale={0.2} flipped={true} />
                </>
              )
            )}
          </group>
        );
      })}

      {/* Pot Chips */}
      {state.pot > 0 && <Chips amount={state.pot} position={[0, 0, -1]} />}
    </>
  );
};

export default HoldemGame;
