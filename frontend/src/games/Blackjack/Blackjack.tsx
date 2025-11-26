import React, { useRef, useMemo, useEffect, useState } from "react";
import { ApplicationRef, Application as PixiApplication, createRoot, extend } from "@pixi/react";
import { Texture, Container, Sprite, Point, Text } from "pixi.js";
import { useQuery } from "@tanstack/react-query";
import { Assets } from "pixi.js";
import bg from "@/assets/blackjack/background.webp?url";
import { CardKey, CardValue, loadCardTextures } from "../shared";
import Card, { CardRef } from "./Card";
import { Button } from "@/components/ui/button";
import { ImperativeSpawner, SpawnerHandle, useContainerSize, waitFor, websocketRequest } from "@/lib/utils";
import { BlackjackResponse, ErrorResponse, GameState, HandPositions, Result } from "./types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { calculatePossibleSums, formatHandValue, getHandPosition, POSITIONS } from "./helpers";
import { HandCountDisplay, HandValueDisplay } from "./Components";

extend({ Sprite, Container, Text });

const stakes = [5, 10, 25, 50, 100, 500, 1000];
const INITIAL_OFFSET = -50;
const CARDS_SPACING = 100;

const defaultGameState: GameState = {
  state: "idle",
  playerCount: "",
  playerSplitCount: "",
  dealerCount: "",
  currentHand: null,
  handValue: 0,
  handSplitValue: 0,
  result: null,
  result_split: null,
  splitable: false,
  doubleable: false,
  isSplit: false,
};

const Blackjack = () => {
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

  const cards = useRef<{
    dealerCards: CardRef[];
    playerCards: CardRef[];
    playerSplitCards: CardRef[];
  }>({ dealerCards: [], playerCards: [], playerSplitCards: [] });

  const spawnerRef = useRef<SpawnerHandle>(null);
  const ws = useRef<WebSocket>(null);

  const [gameState, _setGameState] = useState<GameState>(defaultGameState);
  const { balance } = useAuth();
  const { width, height } = useContainerSize(containerRef);
  const { toast } = useToast();

  const setGameState = (state: Partial<GameState>) => {
    _setGameState((prev) => ({ ...prev, ...state }));
  };

  const scale = useMemo(() => {
    return Math.min(width / textures.background.width, height / textures.background.height);
  }, [width, height]);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8081/ws/blackjack");
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
    console.error("Błąd:", data);
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
      player_split_1: cards.current.playerCards,
      player_split_2: cards.current.playerSplitCards,
      dealer: cards.current.dealerCards,
    };

    const currentCards = cardsMap[position];
    const offset = INITIAL_OFFSET + currentCards.length * CARDS_SPACING;

    const pos = getHandPosition(position);
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
    cards.current = { dealerCards: [], playerCards: [], playerSplitCards: [] };
  };

  const deal = async (betAmount: number) => {
    if (!ws.current) return;
    clearCards();
    setGameState({ ...defaultGameState, state: "dealing" });
    try {
      const data = await websocketRequest<BlackjackResponse>(ws.current, {
        command: "deal",
        bet: betAmount,
      });
      const playerCards = data.player_cards;
      const dealerCards = data.dealer_cards;
      setGameState({ splitable: data.splitable || false, doubleable: data.doublable || false, handValue: betAmount });

      const playerCard1 = await dealCard(playerCards[0], "player", true);
      cards.current.playerCards.push(playerCard1.current!);
      const dealerCard1 = await dealCard(dealerCards[0], "dealer", true);
      cards.current.dealerCards.push(dealerCard1.current!);
      const playerCard2 = await dealCard(playerCards[1], "player", true);
      cards.current.playerCards.push(playerCard2.current!);
      const dealerCard2 = await dealCard(dealerCards[1], "dealer", false);
      cards.current.dealerCards.push(dealerCard2.current!);

      calculateSums(false);

      if (data.result !== Result.UNRESOLVED) {
        //Przypadek w którym dealer, lub gracz ma blackjacka
        await showDealerCards();
        calculateSums(true);
        setGameState({ result: data.result, state: "end", handValue: data.money_won || gameState.handValue });
        return;
      }
      setGameState({ state: "dealt" });
    } catch (e) {
      handleError(e, { state: "idle" });
    }
  };

  const showDealerCards = async () => {
    await Promise.all(
      cards.current.dealerCards.map(async (card) => {
        await card.setFacing("front");
      })
    );
  };

  const dealerTurn = async (dealerCards: CardKey[]) => {
    const newCards = dealerCards.slice(2);
    for (let i = 0; i < newCards.length; i++) {
      await waitFor(500);
      const card = await dealCard(newCards[i], "dealer", true);
      cards.current.dealerCards.push(card.current!);
      calculateSums(true, gameState.isSplit);
    }
  };

  const calculateSums = (showDealer: boolean, split?: boolean) => {
    const dealerCardValues = cards.current.dealerCards.map((card) => card.cardKey[0] as CardValue);
    const dealerCount = formatHandValue(showDealer ? dealerCardValues : dealerCardValues.slice(0, 1));
    if (split) {
      const playerHand1CardValues = cards.current.playerCards.map((card) => card.cardKey[0] as CardValue);
      const playerHand2CardValues = cards.current.playerSplitCards.map((card) => card.cardKey[0] as CardValue);
      const playerHand1Count = formatHandValue(playerHand1CardValues);
      const playerHand2Count = formatHandValue(playerHand2CardValues);
      setGameState({ playerCount: playerHand1Count, playerSplitCount: playerHand2Count, dealerCount });
    } else {
      const playerCardValues = cards.current.playerCards.map((card) => card.cardKey[0] as CardValue);
      const playerCount = formatHandValue(playerCardValues);
      setGameState({ playerCount, dealerCount });
    }
  };

  const updateGameStateWithResult = async (data: BlackjackResponse, delay: boolean) => {
    setGameState({ currentHand: null });
    if (delay) {
      await waitFor(1000);
    }
    await showDealerCards();
    calculateSums(true, gameState.isSplit);
    await dealerTurn(data.dealer_cards);
    setGameState({
      result: data.result,
      result_split: data.result_split,
      handValue: data.money_won || gameState.handValue,
      handSplitValue: data.money_won_split || gameState.handSplitValue,
      state: "end",
    });
  };

  const hit = async () => {
    if (!ws.current) return;
    setGameState({ state: "dealingHit" });

    const data = await websocketRequest<BlackjackResponse>(ws.current, {
      command: "hit",
    });

    if (gameState.isSplit) {
      hitSplit(data);
    } else {
      hitRegular(data);
    }
  };

  const hitRegular = async (data: BlackjackResponse) => {
    const cardHit = data.player_cards[data.player_cards.length - 1];
    const card = await dealCard(cardHit, "player", true);
    cards.current.playerCards.push(card.current!);

    calculateSums(false, gameState.isSplit);
    if (data.result === Result.UNRESOLVED) {
      setGameState({ state: "dealt" });
      return;
    }
    updateGameStateWithResult(data, true);
  };

  const hitSplit = async (data: BlackjackResponse) => {
    const hand = gameState.currentHand!;
    const currentCards = hand === "player_split_1" ? cards.current.playerCards : cards.current.playerSplitCards;
    const cardHit = hand === "player_split_1" ? data.player_cards[data.player_cards.length - 1] : data.player_split_cards[data.player_split_cards.length - 1];
    const card = await dealCard(cardHit, hand, true);
    currentCards.push(card.current!);
    calculateSums(false, gameState.isSplit);

    // if (hand === "player_split_1" && calculatePossibleSums(data.player_cards.map((x) => x[0] as any)).includes(21)) {
    //   //Blackjack na pierwszej ręce
    //   setGameState({ currentHand: "player_split_2" });
    // }
    if (data.result !== Result.UNRESOLVED && data.result_split !== Result.UNRESOLVED && data.result_split !== null) {
      //wynik gry na obu rękach
      updateGameStateWithResult(data, true);
      return;
    }
    if (hand === "player_split_1" && data.result !== Result.UNRESOLVED) {
      //wynik gry na pierwszej ręce
      setGameState({ result: data.result, handValue: data.money_won || gameState.handValue, handSplitValue: data.money_won_split || gameState.handSplitValue, currentHand: "player_split_2" });
      return;
    }
    setGameState({ state: "dealt" });
  };

  const stand = async () => {
    if (!ws.current) return;
    setGameState({ state: "dealing" });
    const data = await websocketRequest<BlackjackResponse>(ws.current, {
      command: "stand",
    });
    // console.log(data.money_won);
    if (data.result !== Result.UNRESOLVED) {
      updateGameStateWithResult(data, false);
    } else {
      setGameState({ state: "dealt", currentHand: "player_split_2", handValue: data.money_won || gameState.handValue, handSplitValue: data.money_won_split || gameState.handSplitValue });
    }
  };

  const double = async () => {
    if (!ws.current) return;
    try {
      setGameState({ state: "dealing" });

      const data = await websocketRequest<BlackjackResponse>(ws.current, {
        command: "double",
      });

      if (gameState.isSplit) {
        doubleSplit(data);
      } else {
        doubleRegular(data);
      }
    } catch (e) {
      handleError(e, { state: "dealt" });
    }
  };

  const doubleSplit = async (data: BlackjackResponse) => {
    const hand = gameState.currentHand!;
    const currentCards = hand === "player_split_1" ? cards.current.playerCards : cards.current.playerSplitCards;
    const cardHit = hand === "player_split_1" ? data.player_cards[data.player_cards.length - 1] : data.player_split_cards[data.player_split_cards.length - 1];
    setGameState({
      handValue: hand === "player_split_1" ? gameState.handValue * 2 : gameState.handValue,
      handSplitValue: hand === "player_split_2" ? gameState.handSplitValue * 2 : gameState.handSplitValue,
    });

    const card = await dealCard(cardHit, hand, true);
    currentCards.push(card.current!);
    calculateSums(false, gameState.isSplit);

    // if (hand === "player_split_1" && calculatePossibleSums(data.player_cards.map((x) => x[0] as any)).includes(21)) {
    //   setGameState({ currentHand: "player_split_2" });
    // }
    if (hand === "player_split_1" && data.result !== Result.UNRESOLVED) {
      setGameState({ result: data.result, handValue: data.money_won || gameState.handValue, handSplitValue: data.money_won_split || gameState.handSplitValue, currentHand: "player_split_2" });
    }

    if (data.result !== Result.UNRESOLVED && data.result_split !== Result.UNRESOLVED && data.result_split !== null) {
      updateGameStateWithResult(data, true);
      return;
    }

    setGameState({ state: "dealt", currentHand: hand === "player_split_2" ? null : "player_split_2" });
  };

  const doubleRegular = async (data: BlackjackResponse) => {
    setGameState({ handValue: gameState.handValue * 2 });
    const cardHit = data.player_cards[data.player_cards.length - 1];
    const card = await dealCard(cardHit, "player", true);
    cards.current.playerCards.push(card.current!);
    calculateSums(false, gameState.isSplit);

    updateGameStateWithResult(data, true);
  };

  const split = async () => {
    if (!ws.current) return;
    try {
      setGameState({ state: "dealing", isSplit: true, splitable: false, handValue: gameState.handValue, handSplitValue: gameState.handValue });

      const data = await websocketRequest<BlackjackResponse>(ws.current, {
        command: "split",
      });

      cards.current.playerSplitCards = [cards.current.playerCards[1]];
      cards.current.playerCards = [cards.current.playerCards[0]];
      cards.current.playerCards[0].moveTo(new Point(POSITIONS.handSplit1.x * scale + INITIAL_OFFSET * scale, POSITIONS.handSplit1.y * scale));
      cards.current.playerSplitCards[0].moveTo(new Point(POSITIONS.handSplit2.x * scale + INITIAL_OFFSET * scale, POSITIONS.handSplit2.y * scale));

      calculateSums(false, true);
      const hand1Card = await dealCard(data.player_cards[1], "player_split_1", true);
      cards.current.playerCards.push(hand1Card.current!);
      calculateSums(false, true);
      const hand2Card = await dealCard(data.player_split_cards[1], "player_split_2", true);
      cards.current.playerSplitCards.push(hand2Card.current!);
      calculateSums(false, true);

      if (calculatePossibleSums(data.player_cards.map((x) => x[0] as any)).includes(21)) {
        setGameState({ state: "dealt", currentHand: "player_split_2" });
        return;
      }

      setGameState({ state: "dealt", currentHand: "player_split_1" });
    } catch (e) {
      handleError(e, { state: "dealt", isSplit: false });
    }
  };

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
            // width={width}
            // height={height}
            resizeTo={containerRef.current!}
          >
            <pixiContainer
              ref={(ref) => {
                if (!ref) return;
                // console.log(ref);
                gameContainer.current = ref;
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
                {gameState.playerCount && <HandCountDisplay current={false} value={gameState.playerCount} position={gameState.isSplit ? POSITIONS.handSplit1 : POSITIONS.hand} scale={scale} />}
                {gameState.dealerCount && <HandCountDisplay current={false} value={gameState.dealerCount} position={POSITIONS.dealer} scale={scale} />}
                {gameState.playerSplitCount && (
                  <HandCountDisplay current={gameState.currentHand === "player_split_2"} value={gameState.playerSplitCount} position={POSITIONS.handSplit2} scale={scale} />
                )}
                {gameState.handValue !== 0 && (
                  <HandValueDisplay value={gameState.handValue} result={gameState.result || Result.UNRESOLVED} position={gameState.isSplit ? POSITIONS.handSplit1 : POSITIONS.hand} scale={scale} />
                )}
                {gameState.handSplitValue !== 0 && <HandValueDisplay value={gameState.handSplitValue} result={gameState.result || Result.UNRESOLVED} position={POSITIONS.handSplit2} scale={scale} />}

                {/* {gameState.result && (
                  <Text
                    text={gameState.result}
                    x={width / 2}
                    y={height / 2}
                    anchor={0.5}
                    scale={1}
                    style={
                      new TextStyle({
                        fill: "white",
                        stroke: "black",
                        strokeThickness: 10,
                        fontSize: 200,
                        fontFamily: "Outfit",
                      })
                    }
                  />
                )} */}
              </>
            </pixiContainer>
          </PixiApplication>
          <div style={{ position: "absolute", bottom: "1rem", width: "100%" }}>
            {(gameState.state === "idle" || gameState.state === "end") && (
              <div className="flex flex-row justify-center gap-4 m-2">
                {stakes.map((stake) => (
                  <Button size={"lg"} className=" text-xl" key={stake} onClick={() => deal(stake)}>
                    {stake}
                  </Button>
                ))}
              </div>
            )}
            {gameState.state === "dealt" && (
              <div className="flex flex-row justify-center gap-4 m-2">
                <Button size={"lg"} className=" text-xl" onClick={() => hit()}>
                  HIT
                </Button>
                <Button size={"lg"} className=" text-xl" onClick={() => stand()}>
                  STAND
                </Button>
                {gameState.doubleable && (
                  <Button size={"lg"} variant={"outline"} className=" text-xl" onClick={() => double()}>
                    DOUBLE
                  </Button>
                )}
                {gameState.splitable && (
                  <Button size={"lg"} variant={"outline"} className=" text-xl" onClick={() => split()}>
                    SPLIT
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Blackjack;
