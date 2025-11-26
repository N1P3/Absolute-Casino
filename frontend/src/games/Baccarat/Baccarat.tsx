import bg from "@/assets/baccarat/background.jpg?url";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ImperativeSpawner, SpawnerHandle, useContainerSize, waitFor, websocketRequest } from "@/lib/utils";
import { ApplicationRef, extend, Application as PixiApplication } from "@pixi/react";
import { useQuery } from "@tanstack/react-query";
import { Assets, Container, Point, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { useEffect, useMemo, useRef, useState } from "react";
import Card, { CardRef } from "../Blackjack/Card";
import { HandCountDisplay } from "../Blackjack/Components";
import { ErrorResponse } from "../Blackjack/types";
import { CardKey, CardValue, loadCardTextures } from "../shared";
import { POSITIONS } from "./constants";
import { calculateSum } from "./helpers";
import { BaccaratResponse, Choice, GameState, HandPositions } from "./types";

extend({ Sprite, Container, Text });

const stakes = [5, 10, 25, 50, 100, 500, 1000];
const INITIAL_OFFSET = -50;
const CARDS_SPACING = 150;

const defaultGameState: GameState = {
  state: "idle",
  playerCount: "",
  bankerCount: "",
  result: null,
};

const Baccarat = () => {
  const { isLoading, data: textures } = useQuery({
    queryKey: ["game_assets"],
    queryFn: async () => {
      const cards = await loadCardTextures();
      const bgTexture = (await Assets.load(bg)) as Texture;
      return {
        cards: cards,
        background: bgTexture,
      };
    },
  });
  if (!textures || isLoading) return <div>Loading...</div>;
  return <Inner textures={textures} />;
};

const Inner = ({ textures }: any) => {
  const app = useRef<ApplicationRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameContainer = useRef<Container>(null);

  const spawnerRef = useRef<SpawnerHandle>(null);

  const cards = useRef<{
    bankerCards: CardRef[];
    playerCards: CardRef[];
  }>({ bankerCards: [], playerCards: [] });
  // const root = useRef<ReactPixiRoot>(null);
  const ws = useRef<WebSocket>(null);

  const [gameState, _setGameState] = useState<GameState>(defaultGameState);
  const { balance } = useAuth();
  const { width, height } = useContainerSize(containerRef);
  const { toast } = useToast();
  const [stake, setStake] = useState(5);

  const setGameState = (state: Partial<GameState>) => {
    _setGameState((prev) => ({ ...prev, ...state }));
  };

  const scale = useMemo(() => {
    return Math.min(width / textures.background.width, height / textures.background.height);
  }, [width, height]);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8081/ws/baccarat");
    socket.onopen = () => {
      console.log("Połączenie WebSocket nawiązane.");
      ws.current = socket;
    };
    return () => {
      socket.close();
    };
  }, []);

  const handleError = (error: unknown, state: Partial<GameState>) => {
    const data = error as ErrorResponse;
    toast({
      type: "foreground",
      title: "Błąd",
      description: data.Message,
      variant: "destructive",
    });
    setGameState(state);
  };

  // console.log(balance);

  const dealCard = async (cardKey: CardKey, position: HandPositions, flip: boolean) => {
    if (!spawnerRef.current) {
      throw new Error("Spawner not ready");
    }

    const ref = await spawnerRef.current.spawn(Card, {
      facing: "back",
      cardKey: cardKey,
      cardTextures: textures.cards,
      x: POSITIONS.deck.x * scale,
      y: POSITIONS.deck.y * scale,
      scale: scale * 1.2,
    });
    const cardsMap = {
      player: cards.current.playerCards,
      banker: cards.current.bankerCards,
    };

    const currentCards = cardsMap[position];
    const offset = INITIAL_OFFSET + currentCards.length * CARDS_SPACING;

    const pos = POSITIONS[position];
    await ref.current?.moveTo(new Point(pos.x * scale + offset * scale, pos.y * scale));
    if (flip) {
      await ref?.current?.setFacing("front");
    }
    return ref;
  };

  const clearCards = () => {
    Object.values(cards.current)
      .flat()
      .forEach(async (card) => {
        await card.moveTo(new Point(width / 2, -(card.spriteRef.current?.height || 0)));
        card.spriteRef.current?.destroy();
      });
    cards.current = { bankerCards: [], playerCards: [] };
  };

  const deal = async (choice: Choice) => {
    if (!ws.current) return;
    clearCards();
    setGameState({ ...defaultGameState, state: "dealing" });
    try {
      const data = await websocketRequest<BaccaratResponse>(ws.current, {
        command: "deal",
        choice: choice,
        bet: stake,
      });
      const playerCards = data.player_cards;
      const dealerCards = data.dealer_cards;

      const playerCard1 = await dealCard(playerCards[0], "player", true);
      cards.current.playerCards.push(playerCard1.current!);
      const dealerCard1 = await dealCard(dealerCards[0], "banker", true);
      cards.current.bankerCards.push(dealerCard1.current!);
      const playerCard2 = await dealCard(playerCards[1], "player", true);
      cards.current.playerCards.push(playerCard2.current!);
      const dealerCard2 = await dealCard(dealerCards[1], "banker", true);
      cards.current.bankerCards.push(dealerCard2.current!);

      calculateSums();

      //deal the rest of the cards
      if (playerCards.length > 2) {
        await waitFor(500);
        const playerCard3 = await dealCard(playerCards[2], "player", true);
        cards.current.playerCards.push(playerCard3.current!);
        calculateSums();
      }

      if (dealerCards.length > 2) {
        await waitFor(500);
        const dealerCard3 = await dealCard(dealerCards[2], "banker", true);
        cards.current.bankerCards.push(dealerCard3.current!);
        calculateSums();
      }

      setGameState({ state: "idle", result: data.players_result });
    } catch (e) {
      handleError(e, { state: "idle" });
    }
  };

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

  const calculateSums = () => {
    const bankerCardValues = cards.current.bankerCards.map((card) => card.cardKey[0] as CardValue);
    const bankerCount = calculateSum(bankerCardValues).toString();
    const playerCardValues = cards.current.playerCards.map((card) => card.cardKey[0] as CardValue);
    const playerCount = calculateSum(playerCardValues).toString();
    setGameState({ playerCount, bankerCount });
  };

  //   const updateGameStateWithResult = async (data: BlackjackResponse, delay: boolean) => {
  //     setGameState({ currentHand: null });
  //     if (delay) {
  //       await waitFor(1000);
  //     }
  //     await showbankerCards();
  //     calculateSums(true, gameState.isSplit);
  //     await bankerTurn(data.banker_cards);
  //     setGameState({
  //       result: data.result,
  //       result_split: data.result_split,
  //       handValue: data.money_won || gameState.handValue,
  //       handSplitValue: data.money_won_split || gameState.handSplitValue,
  //       state: "end",
  //     });
  //   };

  return (
    <div>
      <div className="w-full h-screen flex flex-row justify-center items-center p-[50px]">
        <div
          className=" shadow-2xl shadow-black"
          style={{ aspectRatio: ` ${textures.background.width} / ${textures.background.height}`, height: "100%", overflow: "hidden", position: "relative" }}
          ref={containerRef}
        >
          <PixiApplication
            background="rgb(31 44 69)"
            ref={(a) => {
              if (a) app.current = a;
            }}
            resizeTo={containerRef.current!}
          >
            {/* <Game container={containerRef} textures={textures} configuration={{ numSymbols: 3, numReels: 5, padding: 2, reelsBoundingBox: [420, 552, 2576, 1684] }} /> */}
            <pixiContainer
              ref={(ref) => {
                if (!ref) return;
                // console.log(ref);
                gameContainer.current = ref;
                // if (!root.current) {
                //   root.current = createRoot(ref);
                // }
              }}
              key="gameContainer"
              sortableChildren={true}
            >
              <>
                <pixiSprite texture={textures.background} scale={scale} />
                <ImperativeSpawner ref={spawnerRef} />
                <pixiContainer x={POSITIONS.deck.x * scale} y={POSITIONS.deck.y * scale}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} cardKey="AS" facing={"back"} cardTextures={textures.cards} x={i * 2} y={-i * 2} scale={scale * 1.2} />
                  ))}
                </pixiContainer>
                {gameState.playerCount && <HandCountDisplay current={false} value={gameState.playerCount} position={POSITIONS.player} scale={scale} />}
                {gameState.bankerCount && <HandCountDisplay current={false} value={gameState.bankerCount} position={POSITIONS.banker} scale={scale} />}
                {/* {gameState.playerSplitCount && (
                  <HandCountDisplay current={gameState.currentHand === "player_split_2"} value={gameState.playerSplitCount} position={POSITIONS.handSplit2} scale={scale} />
                )}
                {gameState.handValue !== 0 && (
                  <HandValueDisplay value={gameState.handValue} result={gameState.result || Result.UNRESOLVED} position={gameState.isSplit ? POSITIONS.handSplit1 : POSITIONS.hand} scale={scale} />
                )}
                {gameState.handSplitValue !== 0 && <HandValueDisplay value={gameState.handSplitValue} result={gameState.result || Result.UNRESOLVED} position={POSITIONS.handSplit2} scale={scale} />} */}

                {gameState.result && (
                  <pixiText
                    text={gameState.result}
                    x={width / 2}
                    y={height / 2}
                    anchor={0.5}
                    scale={1}
                    style={
                      new TextStyle({
                        fill: "white",
                        stroke: {
                          color: "black",
                          width: 10,
                        },
                        fontSize: 250,
                        fontFamily: "Outfit",
                      })
                    }
                  />
                )}
              </>
            </pixiContainer>
          </PixiApplication>
          {/* {balance !== null && (
            <div style={{ position: "absolute", top: "1rem", left: "1rem" }}>
              <p className="text-3xl">
                Saldo: <b>{balance} PLN</b>
              </p>
            </div>
          )} */}
          <div style={{ position: "absolute", bottom: "1rem", width: "100%", display: "flex", justifyContent: "center" }}>
            <div className="shadow-md shadow-black rounded-md w-[60%]" style={{ backdropFilter: "blur(10px) brightness(0.8)", padding: "1rem" }}>
              <div className="flex justify-between ">
                <div className="flex gap-6">
                  <div className="h-full flex flex-col min-w-[150px] items-center">
                    <p className="text-sm text-center text-white">Saldo</p>
                    <p className="text-5xl text-center text-white">{balance}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button className="h-[80px] text-2xl text-white" onClick={decreaseStake} disabled={gameState.state !== "idle"}>
                      -
                    </Button>
                    <div className="h-full flex flex-col w-[100px]">
                      <p className="text-sm text-center text-white">Stawka</p>
                      <p className="text-5xl text-center text-white">{stake}</p>
                    </div>
                    <Button className="h-[80px] text-2xl text-white" onClick={increaseStake} disabled={gameState.state !== "idle"}>
                      +
                    </Button>
                  </div>
                </div>
                {/* <div className="h-full flex flex-col">
                  <p className="text-xl text-center text-white">Wygrana</p>
                  <p className="text-5xl text-center text-white">{win ? <CountUp end={win} start={0} duration={Math.min(multiplier / 2, 10)} /> : ""}</p>
                </div> */}
                <Button
                  size="lg"
                  className="h-[80px] text-4xl text-white"
                  onClick={() => {
                    deal("PUNTO");
                  }}
                  disabled={gameState.state !== "idle"}
                >
                  PLAYER
                </Button>
                <Button
                  size="lg"
                  className="h-[80px] text-4xl text-white"
                  onClick={() => {
                    deal("TIE");
                  }}
                  disabled={gameState.state !== "idle"}
                >
                  TIE
                </Button>
                <Button
                  size="lg"
                  className="h-[80px] text-4xl text-white"
                  onClick={() => {
                    deal("BANCO");
                  }}
                  disabled={gameState.state !== "idle"}
                >
                  BANKER
                </Button>
              </div>
            </div>
          </div>
          {/* <div style={{ position: "absolute", bottom: "1rem", width: "100%" }}>
            {(gameState.state === "idle" || gameState.state === "end") && (
              <div className="flex flex-row justify-center gap-4 m-2">
                {stakes.map((stake) => (
                  <Button size={"lg"} className=" text-xl" key={stake} onClick={() => deal(stake)}>
                    {stake}
                  </Button>
                ))}
              </div>
            )}
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Baccarat;
