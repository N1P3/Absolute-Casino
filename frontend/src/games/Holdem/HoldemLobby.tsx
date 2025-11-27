import React from "react";

const TABLES = [
  { tableId: 1, label: "SB 5" },
  { tableId: 2, label: "SB 10" },
  { tableId: 3, label: "SB 25" },
  { tableId: 4, label: "SB 50" },
];

interface HoldemLobbyProps {
  onJoinTable: (tableId: number) => void;
  onEnterPlayground: () => void;
}

const HoldemLobby: React.FC<HoldemLobbyProps> = ({ onJoinTable, onEnterPlayground }) => {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-12 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-3xl"></div>
      </div>

      <div className="text-center z-10 relative">
        <h1 className="text-6xl md:text-7xl font-extrabold text-white mb-6 tracking-tight">
          Texas <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">Hold'em</span>
        </h1>
        <p className="text-xl text-muted-foreground">Wybierz stół i dołącz do elitarnej rozgrywki</p>

        <button
          onClick={onEnterPlayground}
          className="absolute -right-32 top-0 text-xs text-muted-foreground hover:text-primary transition-colors border border-white/10 px-2 py-1 rounded hover:border-primary/50"
        >
          DEV: Playground
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
        {TABLES.map((t) => (
          <div key={t.tableId} onClick={() => onJoinTable(t.tableId)} className="group relative w-64 h-40 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 rounded-2xl border border-white/10 backdrop-blur-sm transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{t.label}</span>
              <span className="text-sm text-muted-foreground uppercase tracking-wider">Stawki</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HoldemLobby;
