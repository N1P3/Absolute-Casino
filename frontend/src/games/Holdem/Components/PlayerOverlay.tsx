import React from "react";
import { HoldemPlayer } from "../types";

type PlayerOverlayProps = {
  player: HoldemPlayer;
  isActive: boolean;
  isHero: boolean;
  dealer?: boolean;
};

const PlayerOverlay = ({ player, isActive, isHero, dealer }: PlayerOverlayProps) => {
  return (
    <div
      className={`relative rounded-xl border backdrop-blur-md shadow-xl transition-all duration-300 w-32 ${
        player.winner
          ? "bg-yellow-500/20 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)] scale-110 z-50"
          : isHero
            ? "bg-black/60 border-primary/50 shadow-[0_0_20px_rgba(234,179,8,0.15)]"
            : "bg-black/60 border-white/10"
      } ${isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-black" : ""}`}
    >
      {player.winner && <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[16px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-bounce z-20">WINNER</div>}

      {/* Current Action Indicator */}
      {isActive && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-primary text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse whitespace-nowrap z-30">Ruch gracza...</div>
      )}

      {player.folded && (
        <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center rounded-xl">
          <span className="text-white/50 font-bold uppercase tracking-widest text-xs">Pas</span>
        </div>
      )}

      <div className="p-2 flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 w-full justify-center relative">
          {dealer && <div className="absolute left-0 w-4 h-4 rounded-full bg-yellow-500 text-black text-[8px] font-bold flex items-center justify-center shadow-lg">D</div>}
          <span className={`font-bold truncate max-w-[80px] text-xs ${isHero ? "text-primary" : "text-white"}`}>{isHero ? "TY" : `Gracz ${player.userId}`}</span>
        </div>

        <div className="w-full h-px bg-white/10 my-0.5"></div>

        <div className="flex flex-col items-center">
          <span className="font-mono font-bold text-white text-sm">{player.stack}</span>
        </div>

        {player.betThisStreet > 0 && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 border border-primary/30 text-primary px-2 py-0.5 rounded-full text-lg font-bold shadow-lg whitespace-nowrap">
            {player.betThisStreet}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerOverlay;
