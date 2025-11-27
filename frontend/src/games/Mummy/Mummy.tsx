import button from "@/assets/mummy/spin.png?url";
import bg from "@/assets/mummy/tlo_transparent.png?url";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import Game, { EngineRef } from "@/engine/SlotGame";
import { useContainerSize, websocketRequest } from "@/lib/utils";
import { ApplicationRef, Application as PixiApplication } from "@pixi/react";
import { useQuery } from "@tanstack/react-query";
import { Application, Assets, Texture } from "pixi.js";
import React, { useEffect, useRef } from "react";
import CountUp from "react-countup";
import { lines } from "./lines";
import { getTextures } from "./textures";
import { MummyBonus, MummyResponse } from "./types";

const Mummy = () => {
  const { isLoading, data: textures } = useQuery({
    queryKey: ["game_assets"],
    queryFn: async () => {
      const symbols = (await getTextures()) as Record<string, Texture>;
      const bgTexture = (await Assets.load(bg)) as Texture;
      const buttonTexture = (await Assets.load(button)) as Texture;
      return {
        symbols: Object.values(symbols),
        button: buttonTexture,
        background: bgTexture,
      };
    },
  });
  const { user } = useAuth();
  // if (!user) {
  //   return <Navigate to="/login" />;
  // }
  if (!textures || isLoading) return <div>Loading...</div>;

  return <Inner textures={textures} />;
};

const stakes = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

const Inner = ({
  textures,
}: {
  textures: {
    symbols: Texture[];
    background: Texture;
    button: Texture;
  };
}) => {
  const app = useRef<ApplicationRef>(null);
  const ws = useRef<WebSocket | null>(null);
  const engineRef = useRef<EngineRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { balance } = useAuth();
  const { width, height } = useContainerSize(containerRef);
  const [stake, setStake] = React.useState(1);
  const [win, setWin] = React.useState<number | null>(null);
  const [winningLines, setWinningLines] = React.useState<(keyof typeof lines)[]>([]);
  const [spinning, setSpinning] = React.useState(false);
  const [currentBonus, setCurrentBonus] = React.useState<MummyBonus | null>(null);
  const [bonusModalOpen, setBonusModalOpen] = React.useState(false);
  const [highlightedSymbols, setHighlightedSymbols] = React.useState<[number, number][]>([]);

  // console.log(width, height);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8081/ws/mummy");
    socket.onopen = () => {
      console.log("Połączenie WebSocket nawiązane.");
      ws.current = socket;
    };
    return () => {
      socket.close();
    };
  }, []);

  const increaseStake = () => {
    const index = stakes.indexOf(stake);
    if (index === stakes.length - 1) return;
    setStake(stakes[index + 1]);
  };

  const decreaseStake = () => {
    const index = stakes.indexOf(stake);
    if (index === 0) return;
    setStake(stakes[index - 1]);
  };

  const spin = async () => {
    if (!engineRef.current) return;
    setWin(null);
    setWinningLines([]);
    if (currentBonus !== null && currentBonus.freeSpinsLeft > 0) {
      setCurrentBonus({ ...currentBonus, freeSpinsLeft: currentBonus.freeSpinsLeft - 1 });
    }

    const promise = websocketRequest<MummyResponse>(ws.current!, { command: "spin", bet: stake });

    setSpinning(true);
    await engineRef.current.spinAsync(async () => {
      return (await promise).gameBoard;
    });
    setSpinning(false);
    const data = await promise;
    setWin(data.moneyWon);
    setWinningLines(data.winningLines.map((x) => Object.keys(x)).flat());
    if (data.bonus !== null && (currentBonus === null || data.bonus.freeSpinsLeft > currentBonus.freeSpinsLeft)) {
      if (data.bonus.type === "FREE_SPINS_MUMMY") {
        setHighlightedSymbols(data.bonus.mummyLine);
      }
      setBonusModalOpen(true);
    }
    setCurrentBonus(data.bonus);
  };

  const scale = Math.min(width / textures.background.width, height / textures.background.height);

  // console.log(app.current?.stage.width);

  return (
    <div>
      {/* <h1 className="text-5xl text-white">
        FPS: <b>{fps}</b>
      </h1> */}

      <div className="w-full h-screen flex flex-row justify-center items-center p-[50px]">
        <div className="shadow-2xl shadow-black" style={{ aspectRatio: ` ${textures.background.width} / ${textures.background.height}`, height: "100%", position: "relative" }} ref={containerRef}>
          <PixiApplication
            background="rgb(115 38 0)"
            // preference="webgpu"
            ref={(a) => {
              if (a) {
                app.current = a;
              }
            }}
            resizeTo={containerRef.current!}
          >
            <Game
              ref={engineRef}
              textures={textures}
              configuration={{ numSymbols: 3, numReels: 5, padding: 2, reelsBoundingBox: [420, 552, 2576, 1684] }}
              winningLines={winningLines.map((x) => lines[x])}
              highlightedSymbols={highlightedSymbols}
              scale={scale}
            />
          </PixiApplication>
          {/* {balance !== null && (
            <div style={{ position: "absolute", top: "1rem", left: "1rem" }}>
              <p className="text-3xl" style={{ textShadow: "2px 2px 2px black" }}>
                Saldo: <b>{balance} PLN</b>
              </p>
            </div>
          )} */}
          {bonusModalOpen && (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div className="shadow-md shadow-black rounded-md flex flex-col gap-4 items-center" style={{ backdropFilter: "blur(10px) brightness(0.5)", padding: "1rem" }}>
                <h1 className="text-5xl text-center">Otrzymujesz bonus!</h1>
                <p className="text-2xl">{currentBonus?.message}</p>
                <Button className="w-fit" size="lg" onClick={() => setBonusModalOpen(false)}>
                  Ok
                </Button>
              </div>
            </div>
          )}
          <div style={{ position: "absolute", bottom: "1rem", width: "100%", display: "flex", justifyContent: "center" }}>
            <div className="shadow-md shadow-black rounded-md w-[70%]" style={{ backdropFilter: "blur(10px) brightness(0.8)", padding: "1rem" }}>
              <div className="flex justify-between ">
                <div className="flex gap-6">
                  <div className="h-full flex flex-col min-w-[150px] items-center">
                    <p className="text-sm text-center text-white">Saldo</p>
                    <p className="text-5xl text-center text-white">{balance}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button className="h-[80px] text-2xl text-white" onClick={decreaseStake} disabled={spinning || bonusModalOpen || currentBonus !== null}>
                      -
                    </Button>
                    <div className="h-full flex flex-col w-[100px]">
                      <p className="text-sm text-center text-white">Stawka</p>
                      <p className="text-5xl text-center text-white">{stake}</p>
                    </div>
                    <Button className="h-[80px] text-2xl text-white" onClick={increaseStake} disabled={spinning || bonusModalOpen || currentBonus !== null}>
                      +
                    </Button>
                  </div>
                </div>
                <div className="h-full flex flex-col">
                  <p className="text-xl text-center text-white">Wygrana</p>
                  <p className="text-5xl text-center text-white">{win ? <CountUp end={win} start={0} duration={2} /> : ""}</p>
                </div>
                {currentBonus && (
                  <div className="h-full flex flex-col">
                    <p className="text-xl text-center text-white">Pozostało free spins</p>
                    <p className="text-5xl text-center text-white">{currentBonus.freeSpinsLeft}</p>
                  </div>
                )}
                <Button size="lg" className="h-[80px] text-4xl text-white" onClick={spin} disabled={spinning || bonusModalOpen}>
                  SPIN
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mummy;
