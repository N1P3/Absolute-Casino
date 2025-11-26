const ResultOverlay = ({ result, visible }: { result: string | null; visible: boolean }) => {
  if (!visible || !result) return null;
  const isWin = result.includes("WIN") || result.includes("wyg");

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-300 pointer-events-auto">
      <div className="bg-card border border-primary/20 p-12 rounded-3xl shadow-2xl transform animate-in zoom-in duration-500 text-center max-w-2xl">
        <h2 className="text-5xl font-extrabold text-white mb-6 drop-shadow-lg">
          {isWin ? <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">WYGRANA!</span> : "Koniec rozdania"}
        </h2>
        <p className="text-2xl text-muted-foreground font-medium">{result}</p>
      </div>
    </div>
  );
};
export default ResultOverlay;
