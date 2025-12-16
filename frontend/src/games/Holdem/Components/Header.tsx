import { Button } from "@/components/ui/button";

const GameHeader = ({ tableId, pot, stage, onLeave, onAddBot }: { tableId: number; pot: number; stage: string; onLeave: () => void; onAddBot?: () => void }) => (
  <div className="absolute top-0 left-0 w-full z-50 p-6 flex justify-between items-start pointer-events-none">
    <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex gap-6 items-center shadow-xl">
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground uppercase font-bold">Stół</span>
        <span className="text-xl font-bold text-white">#{tableId}</span>
      </div>
      <div className="w-px h-8 bg-white/10" />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground uppercase font-bold">Pula</span>
        <span className="text-xl font-bold text-primary">{pot}</span>
      </div>
      <div className="w-px h-8 bg-white/10" />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground uppercase font-bold">Etap</span>
        <span className="text-xl font-bold text-white capitalize">{stage.toLowerCase()}</span>
      </div>
    </div>
    <div className="flex gap-2 pointer-events-auto">
      <Button variant="outline" onClick={onAddBot} className="bg-blue-500/10 border-blue-500/50 text-blue-400 hover:bg-blue-500/20 transition-all">
        Dodaj Bota
      </Button>
      <Button variant="outline" onClick={onLeave} className="border-destructive/50 text-destructive hover:bg-destructive/10 transition-all">
        Opuść stół
      </Button>
    </div>
  </div>
);
export default GameHeader;
