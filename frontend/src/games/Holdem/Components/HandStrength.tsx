import React from "react";

interface HandStrengthProps {
  description: string | null;
  strength: number | null;
}

const HandStrength: React.FC<HandStrengthProps> = ({ description, strength }) => {
  if (!description) return null;

  return (
    <div className="absolute right-4 top-24 w-48 bg-black/60 text-white p-3 rounded-lg border border-white/20 backdrop-blur-sm z-10">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-1 text-white/50">Your Hand</h3>
      <div className="text-lg font-bold text-primary mb-2">{description}</div>

      {strength !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] uppercase tracking-tighter text-white/50">
            <span>Strength</span>
            <span>{strength}%</span>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${strength}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default HandStrength;
