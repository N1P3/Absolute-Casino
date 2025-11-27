import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { HoldemGameState } from "../types";
// import { Slider } from "@/components/ui/slider";

const GameControls = ({ gameState, onAction, secondsLeft }: { gameState: HoldemGameState; onAction: (cmd: string, amt?: number) => void; secondsLeft: number | null }) => {
  const [betAmount, setBetAmount] = useState<number>(10);

  // Update local bet slider defaults when state changes
  useEffect(() => {
    if (gameState.currentBet) setBetAmount(gameState.currentBet);
  }, [gameState.currentBet]);

  const canAction = (cmd: string) => gameState.isMyTurn && gameState.state === "playing" && gameState.availableActions.includes(cmd.toUpperCase());

  const me = gameState.players.find((p) => p.you);

  //   console.log("GameControls Rendered - isMyTurn:", gameState.isMyTurn, "lastAction:", gameState.lastAction, "availableActions:", gameState.availableActions, "betAmount:", betAmount);
  if (!gameState.isMyTurn && !gameState.lastAction) return null;

  return (
    <div className="absolute bottom-0 left-0 w-full p-4 z-50 pointer-events-none">
      <div className="flex flex-col gap-2 items-center w-full max-w-3xl mx-auto pointer-events-auto">
        {/* Timer */}
        {secondsLeft !== null && gameState.isMyTurn && (
          <div className="bg-destructive/90 px-4 py-1 rounded-full shadow-2xl animate-pulse border border-white/10 mb-2">
            <span className="text-white font-bold text-sm">Auto-fold za {secondsLeft}s</span>
          </div>
        )}

        {/* Action Bar */}
        {gameState.isMyTurn && gameState.state === "playing" && (
          <div className="bg-black/10 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl border border-white/5 w-full">
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <Button onClick={() => onAction("fold")} disabled={!canAction("fold")} variant="destructive">
                Fold
              </Button>
              <Button onClick={() => onAction("check")} disabled={!canAction("check")} variant="secondary">
                Check
              </Button>
              <Button onClick={() => onAction("call")} disabled={!canAction("call")} className="bg-green-600 hover:bg-green-700">
                Call
              </Button>
              <Button onClick={() => onAction("raise", betAmount)} disabled={!canAction("raise")}>
                Raise
              </Button>
              <Button onClick={() => onAction("all_in")} disabled={!canAction("all_in")} className="bg-gradient-to-r from-purple-600 to-pink-600">
                All-In
              </Button>
            </div>

            {/* Slider */}
            {(canAction("bet") || canAction("raise")) && (
              <div className="flex flex-col gap-3 max-w-xl mx-auto bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase min-w-[50px]">Kwota</span>
                  <Slider value={[betAmount]} onValueChange={(v) => setBetAmount(v[0])} min={gameState.currentBet || 10} max={me?.stack || 1000} step={10} className="flex-1" />
                  <div className="bg-black/40 px-3 py-1 rounded-lg border border-white/10 min-w-[80px] text-center">
                    <span className="text-primary font-mono font-bold text-lg">{betAmount}</span>
                  </div>
                </div>
                <Button onClick={() => onAction("bet", betAmount)} disabled={!canAction("bet")}>
                  Postaw {betAmount}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Last Action Notification */}
        {gameState.lastAction && !gameState.isMyTurn && (
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl animate-in slide-in-from-bottom-4">
            <span className="text-white font-medium text-sm">
              <span className="text-muted-foreground">Ostatnia akcja:</span> {gameState.lastAction}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
export default GameControls;
