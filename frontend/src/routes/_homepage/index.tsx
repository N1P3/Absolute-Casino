import { createFileRoute, useRouter } from "@tanstack/react-router";
import { config } from "../../gamesConfig";
import { GameConfig, GameType } from "@/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { ArrowRight, Star, Trophy, Shield, Play, Info } from "lucide-react";

export const Route = createFileRoute("/_homepage/")({
  component: Homepage,
});

function GameCard({ game }: { game: GameConfig }) {
  const { user } = useAuth();
  const router = useRouter();
  const launchGame = () => {
    if (!user) {
      router.navigate({ to: "/login" });
      return;
    }
    window.open(`/game/${game.gameId}`, game.name, `scrollbars=no,status=no,location=no,toolbar=no,menubar=no`);
  };

  return (
    <div
      className="relative group w-full md:w-[400px] h-[300px] rounded-xl overflow-hidden shadow-lg border border-white/10 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]"
    >
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
        style={{ backgroundImage: `url(${game.thumbnail})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
      
      <div className="absolute bottom-0 left-0 w-full p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
        <h3 className="text-2xl font-bold text-white mb-1 drop-shadow-md">{game.name}</h3>
        <div className="flex gap-3 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
          <Button size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold" onClick={launchGame}>
            <Play className="w-4 h-4 mr-2" fill="currentColor" /> Zagraj
          </Button>
          <Button size="sm" variant="outline" className="flex-1 border-white/20 bg-black/40 text-white hover:bg-white/10" asChild>
            <a href={`/instructions/${game.gameId}`}>
              <Info className="w-4 h-4 mr-2" /> Info
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Homepage() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl z-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-secondary/30 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-primary text-sm font-medium mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Star className="w-4 h-4 fill-primary" />
            <span>Najlepsze Kasyno Online w Polsce</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            Wygrywaj w <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">Wielkim Stylu</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            Dołącz do elitarnego grona graczy i poczuj dreszczyk emocji. 
            Tysiące gier, błyskawiczne wypłaty i ekskluzywne bonusy czekają na Ciebie.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
            <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)] transition-all" asChild>
              <a href="/register">
                Zacznij Grać Teraz <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-primary/50 transition-all" asChild>
              <a href="#games">
                Przeglądaj Gry
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-secondary/20 border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-card border border-white/5 hover:border-primary/30 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Wysokie Wygrane</h3>
              <p className="text-muted-foreground">Najwyższe RTP na rynku i ogromne jackpoty czekają na szczęśliwców.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-card border border-white/5 hover:border-primary/30 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Bezpieczeństwo</h3>
              <p className="text-muted-foreground">Licencjonowane gry i szyfrowane transakcje gwarantują pełne bezpieczeństwo.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-card border border-white/5 hover:border-primary/30 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Star className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Program VIP</h3>
              <p className="text-muted-foreground">Zbieraj punkty lojalnościowe i wymieniaj je na gotówkę oraz nagrody rzeczowe.</p>
            </div>
          </div>
        </div>
      </section>

      <div id="games" className="container mx-auto px-4 py-20">
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 flex items-center gap-3">
            <span className="w-2 h-8 bg-primary rounded-full"></span>
            Sloty
          </h2>
          <p className="text-muted-foreground text-lg">Najpopularniejsze automaty do gier w sieci.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {config
            .filter((x) => x.type === GameType.SLOT)
            .map((game) => (
              <GameCard key={game.gameId} game={game} />
            ))}
        </div>

        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 flex items-center gap-3">
            <span className="w-2 h-8 bg-primary rounded-full"></span>
            Gry Karciane
          </h2>
          <p className="text-muted-foreground text-lg">Klasyczne gry stołowe dla wymagających graczy.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {config
            .filter((x) => x.type === GameType.CARD)
            .map((game) => (
              <GameCard key={game.gameId} game={game} />
            ))}
        </div>
      </div>
    </div>
  );
}
