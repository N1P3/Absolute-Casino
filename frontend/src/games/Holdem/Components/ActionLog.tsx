import React from "react";

interface ActionLogProps {
  actions: string[];
}

const ActionLog: React.FC<ActionLogProps> = ({ actions }) => {
  return (
    <div className="absolute left-8 top-28 w-64 bg-black/60 text-white p-3 rounded-lg border border-white/20 backdrop-blur-sm z-10 max-h-[300px] overflow-y-auto">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-white/50">Action Log</h3>
      <div className="space-y-1">
        {actions.length === 0 ? (
          <p className="text-xs text-white/30 italic">No actions yet...</p>
        ) : (
          actions.toReversed().map((action, i) => (
            <div key={i} className="text-sm border-l-2 border-primary/50 pl-2 py-0.5 bg-white/5">
              {action}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActionLog;
