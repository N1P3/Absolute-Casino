import { createFileRoute, useRouter } from "@tanstack/react-router";
import { config } from "../../gamesConfig";
import { GameConfig, GameType } from "@/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

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
      className="min-w-[500px] min-h-[500px] bg-cover bg-center rounded-lg shadow-lg flex flex-col justify-end p-6 hover:cursor-pointer select-none hover:scale-105 transition relative group"
      style={{ backgroundImage: `url(${game.thumbnail})` }}
    >
      {/* <div className="bg-black bg-opacity-50 p-4 rounded-lg">
        <h2 className="text-white text-xl font-bold mb-2">Gra</h2>
        <p className="text-white text-base">{game.name}</p>
      </div> */}

      {/* <div className="w-full h-full bg-gray-900 left-0 bottom-0 rounded-lg opacity-50  absolute hidden group-hover:block transition-all"></div> */}

      <div style={{ backdropFilter: "blur(2px) brightness(0.5)" }} className="absolute top-0 left-0 w-full h-full items-center justify-center z-50 hidden group-hover:flex rounded-lg">
        <div className="w-full flex flex-col gap-5">
          <div
            style={{
              textShadow: "2px 2px 2px black",
            }}
            className="text-5xl font-bold text-center uppercase"
          >
            {game.name}
          </div>
          <div className="flex justify-center space-x-2 pb-2">
            <Button size={"lg"} variant="default" className="bg-gray-700 hover:bg-gray-900" onClick={launchGame}>
              Demo
            </Button>
            <Button size={"lg"} variant="default" onClick={launchGame}>
              Zagraj
            </Button>
            <Button size={"lg"} variant="outline" asChild>
              <a href={`/instructions/${game.gameId}`}>Instrukcja</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Homepage() {
  return (
    <div className="w-full p-10 text-white">
      <h1
        style={{
          textShadow: "1px  black",
          letterSpacing: "0.1em",
        }}
        className="font-extrabold uppercase text-3xl mt-4 text-amber-300"
      >
        Sloty
      </h1>
      <hr className="border-amber-400 m-1" />

      <div className="flex justify-center">
        <div className="w-full flex flex-wrap gap-5 justify-center md:justify-start mt-4 mx-4">
          {config
            .filter((x) => x.type === GameType.SLOT)
            .map((game) => (
              <GameCard key={game.gameId} game={game} />
            ))}
        </div>
      </div>

      <h1
        style={{
          textShadow: "1px  black",
          letterSpacing: "0.1em",
        }}
        className="font-extrabold uppercase text-3xl mt-4 text-amber-300"
      >
        Gry karciane
      </h1>
      <hr className="border-amber-400 m-1" />

      <div className="flex justify-center">
        <div className="w-full flex flex-wrap gap-5 justify-center md:justify-start mt-4 mx-4">
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
