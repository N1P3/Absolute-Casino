import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { HoldemGameState } from "../types";
import { ChevronUp, ChevronDown } from "lucide-react";

const GameControls = ({ gameState, onAction, secondsLeft }: { gameState: HoldemGameState; onAction: (cmd: string, amt?: number) => void; secondsLeft: number | null }) => {
  const [betAmount, setBetAmount] = useState<number>(10);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  // Update local bet slider defaults when state changes
  useEffect(() => {
    if (gameState.currentBet) setBetAmount(gameState.currentBet);
  }, [gameState.currentBet]);

  // Reset slider visibility when it's not my turn
  useEffect(() => {
    if (!gameState.isMyTurn) {
      setShowRaiseSlider(false);
    }
  }, [gameState.isMyTurn]);

  const canAction = (cmd: string) => gameState.isMyTurn && gameState.state === "playing" && gameState.availableActions.includes(cmd.toUpperCase());

  const me = gameState.players.find((p) => p.you);

  if (gameState.state === "idle") return null;

  return (
    <>
      {/* Hand Strength Indicator - Moved to top of screen */}
      {gameState.handDescription && (
        <div className="fixed top-24 right-6 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/20 flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 shadow-2xl z-50 min-w-[200px]">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-white/50 font-bold leading-none mb-1">Twoja Ręka</span>
            <span className="text-primary font-black text-xl leading-none tracking-tight">{gameState.handDescription}</span>
          </div>
          {gameState.handStrength !== null && (
            <div className="flex flex-col w-full">
              <div className="flex justify-between text-[9px] uppercase text-white/40 font-bold mb-1">
                <span>Siła Układu</span>
                <span>{gameState.handStrength}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-primary/50 to-primary transition-all duration-700 ease-out" style={{ width: `${gameState.handStrength}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timer - Top of page */}
      {secondsLeft !== null && gameState.isMyTurn && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-destructive px-6 py-2 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse border border-white/20 z-[100] flex items-center gap-3">
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
          <span className="text-white font-black text-base uppercase tracking-wider">Auto-fold za {secondsLeft}s</span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 w-full p-4 z-50 pointer-events-none">
        <div className="flex flex-col gap-2 items-center w-full max-w-3xl mx-auto pointer-events-auto">
          {/* Action Bar - Only visible on turn */}
          {gameState.isMyTurn && gameState.state === "playing" && (
            <div className="bg-black/60 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl border border-white/10 w-full">
              {/* Pop-out Slider */}
              {showRaiseSlider && (canAction("bet") || canAction("raise")) && (
                <div className="flex flex-col gap-3 max-w-xl mx-auto bg-black/40 p-4 rounded-xl border border-white/10 mb-4 animate-in zoom-in-95 slide-in-from-bottom-4">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase min-w-[50px]">Kwota</span>
                    <Slider value={[betAmount]} onValueChange={(v) => setBetAmount(v[0])} min={gameState.currentBet || 10} max={me?.stack || 1000} step={10} className="flex-1" />
                    <div className="bg-black/40 px-3 py-1 rounded-lg border border-white/10 min-w-[80px] text-center">
                      <span className="text-primary font-mono font-bold text-lg">{betAmount}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold" onClick={() => onAction(canAction("raise") ? "raise" : "bet", betAmount)}>
                      {canAction("raise") ? "Podbij" : "Postaw"} {betAmount}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setShowRaiseSlider(false)}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => onAction("fold")} disabled={!canAction("fold")} variant="destructive" className="min-w-[80px]">
                  Fold
                </Button>
                <Button onClick={() => onAction("check")} disabled={!canAction("check")} variant="secondary" className="min-w-[80px]">
                  Check
                </Button>
                <Button onClick={() => onAction("call")} disabled={!canAction("call")} className="bg-green-600 hover:bg-green-700 min-w-[80px]">
                  Call
                </Button>

                {(canAction("raise") || canAction("bet")) && (
                  <Button onClick={() => setShowRaiseSlider(!showRaiseSlider)} variant={showRaiseSlider ? "default" : "outline"} className="min-w-[100px] flex gap-2">
                    {canAction("raise") ? "Raise" : "Bet"}
                    {showRaiseSlider ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                )}

                <Button onClick={() => onAction("all_in")} disabled={!canAction("all_in")} className="bg-gradient-to-r from-purple-600 to-pink-600 min-w-[100px]">
                  All-In
                </Button>
              </div>
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
    </>
  );
};
export default GameControls;
