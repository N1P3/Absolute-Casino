import { useToast } from "@/hooks/use-toast";
import React, { useCallback, useEffect, useState } from "react";
import { GAME_STAGES, NEXT_HAND_DELAY_MS } from "./constants";
import { HoldemGameState, HoldemResponse } from "./types";
// 3D Imports
import GameControls from "./Components/Controls";
import GameHeader from "./Components/Header";
import ActionLog from "./Components/ActionLog";
import Game3DContent from "./Holdem3D/Game3DContent";
import Scene from "./Holdem3D/Scene";
import { useActionTimer, useHoldemSocket } from "./hooks";

interface HoldemGameProps {
  tableId: number;
  onLeaveTable: () => void;
  onAddBot?: () => void;
}

const HoldemGame: React.FC<HoldemGameProps> = ({ tableId, onLeaveTable }) => {
  const { toast } = useToast();

  // Initial State
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
    handDescription: null,
    handStrength: null,
    actionLog: [],
  });

  // 1. WebSocket Hook
  const handleStateUpdate = useCallback((resp: HoldemResponse) => {
    const players = resp.players || [];
    const inHand = !!resp.street;
    const isMyTurn = players.some((p) => p.you && p.currentTurn);
    const isShowdown = resp.street === GAME_STAGES.SHOWDOWN;

    setGameState({
      state: !players.length ? "idle" : !inHand ? "waiting" : "playing",
      playerHand: resp.viewerHoleCards || [],
      communityCards: resp.communityCards || [],
      pot: resp.pot ?? 0,
      currentBet: resp.currentBet ?? 0,
      gameStage: resp.street || GAME_STAGES.PREFLOP,
      currentPlayerSeat: resp.currentPlayerSeat ?? null,
      dealerSeat: resp.dealerSeat ?? null,
      isMyTurn,
      players,
      gameOver: (!inHand && !!resp.result) || isShowdown,
      result: resp.result ?? null,
      availableActions: resp.availableActions || [],
      lastAction: resp.lastAction ?? null,
      handDescription: resp.handDescription ?? null,
      handStrength: resp.handStrength ?? null,
      actionLog: resp.actionLog || [],
    });
  }, []);

  const { sendCommand } = useHoldemSocket(tableId, handleStateUpdate);

  // 2. Action Handlers
  const handleAction = useCallback(
    async (command: string, amount?: number) => {
      try {
        await sendCommand({ command, tableId, ...(amount !== undefined ? { amount } : {}) });
      } catch (e: any) {
        toast({ title: "Błąd", description: e.message || "Action failed", variant: "destructive" });
      }
    },
    [sendCommand, tableId, toast],
  );

  const handleLeave = useCallback(async () => {
    await sendCommand({ command: "leave_table", tableId });
    onLeaveTable();
  }, [sendCommand, tableId, onLeaveTable]);

  // 3. Timer Hook
  const { secondsLeft } = useActionTimer(gameState.isMyTurn, () => {
    handleAction("fold");
    toast({ title: "Time out", description: "Auto-folded due to timeout" });
  });

  // 4. Auto Next Hand logic
  useEffect(() => {
    if (gameState.state === "waiting") {
      const delay = gameState.result ? 5000 : NEXT_HAND_DELAY_MS;
      const timer = setTimeout(() => {
        sendCommand({ command: "start_hand", tableId });
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [gameState.state, gameState.result, tableId, sendCommand]);

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-hidden">
      <GameHeader
        tableId={tableId}
        pot={gameState.pot}
        stage={gameState.gameStage}
        onLeave={handleLeave}
        onAddBot={() => {
          if (gameState.players.length >= 5) {
            toast({ title: "Limit graczy", description: "Maksymalna liczba graczy to 5", variant: "destructive" });
            return;
          }
          sendCommand({ command: "add_bot", tableId });
        }}
      />

      <div className="flex-1 relative">
        <ActionLog actions={gameState.actionLog} />
        <Scene>
          <Game3DContent state={gameState} />
        </Scene>
      </div>

      <GameControls gameState={gameState} onAction={handleAction} secondsLeft={secondsLeft} />
    </div>
  );
};

export default HoldemGame;
