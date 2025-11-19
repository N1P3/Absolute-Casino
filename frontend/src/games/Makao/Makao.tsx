import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  Stage,
  Sprite,
  Container,
  createRoot,
  ReactPixiRoot,
  Text,
} from "@pixi/react";
import {
  Application,
  Texture,
  Container as PixiContainer,
  Point,
  TextStyle,
} from "pixi.js";
import { useQuery } from "@tanstack/react-query";
import { Assets } from "pixi.js";
import bg from "@/assets/makao/background.png?url";
import { CardKey, loadCardTextures } from "../shared";
import Card, { CardRef } from "../Blackjack/Card";
import { Button } from "@/components/ui/button";
import {
  RenderCustomPixiElement,
  useContainerSize,
  waitFor,
  websocketRequest,
} from "@/lib/utils";
import { GameState, MakaoResponse, ErrorResponse } from "./types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { canPlayCard, getCardDisplayName, getSuitSymbol } from "./helpers";
import { POSITIONS } from "./constants";

const stakes = [5, 10, 25, 50, 100, 500, 1000];
const PLAYER_CARD_SPACING = 60;
const OPPONENT_CARD_SPACING = 50;
const CARD_SCALE = 0.69;

const defaultGameState: GameState = {
  state: "idle",
  playerHand: [],
  opponentHandCount: 0,
  tableCard: null,
  currentSuit: null,
  requiredNumber: null,
  pendingDrawCount: 0,
  drawType: null,
  pendingSkipTurns: 0,
  playerToSkip: null,
  currentPlayerId: null,
  isMyTurn: false,
  result: null,
  moneyWon: 0,
};

const Makao = () => {
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

const Inner = ({
  textures,
}: {
  textures: { cards: Record<CardKey, Texture>; background: Texture };
}) => {
  const app = useRef<Application>();
  const containerRef = useRef<HTMLDivElement>(null);
  const gameContainer = useRef<PixiContainer>();
  const ws = useRef<WebSocket>();

  const cards = useRef<{
    playerCards: CardRef[];
    opponentCards: CardRef[];
    tableCard: CardRef | null;
  }>({ playerCards: [], opponentCards: [], tableCard: null });

  const root = useRef<ReactPixiRoot>();

  const [gameState, setGameState] = useState<GameState>(defaultGameState);
  const gameStateRef = useRef<GameState>(defaultGameState);
  const { balance, user } = useAuth();
  const { width, height } = useContainerSize(containerRef);
  const { toast } = useToast();
  const [stake, setStake] = useState(5);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [suitSelectorVisible, setSuitSelectorVisible] = useState(false);
  const [numberSelectorVisible, setNumberSelectorVisible] = useState(false);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const scale = useMemo(() => {
    const calculatedScale = Math.min(
      width / textures.background.width,
      height / textures.background.height
    );
    console.log(
      "Scale calculation - width:",
      width,
      "height:",
      height,
      "bg.width:",
      textures.background.width,
      "bg.height:",
      textures.background.height,
      "scale:",
      calculatedScale
    );
    // Jeśli scale jest 0 lub NaN, zwróć wartość domyślną
    return calculatedScale > 0 ? calculatedScale : 0.5;
  }, [width, height, textures.background.width, textures.background.height]);

  const dealCard = async (
    cardKey: CardKey,
    position: "player" | "opponent" | "table",
    flip: boolean,
    index?: number
  ) => {
    const bgWidth = textures.background.width * scale;
    const bgHeight = textures.background.height * scale;

    const deckX = POSITIONS.deck.xRatio * bgWidth;
    const deckY = POSITIONS.deck.yRatio * bgHeight;

    console.log("=== dealCard ===");
    console.log("scale:", scale, "bgWidth:", bgWidth, "bgHeight:", bgHeight);
    console.log("Initial position:", deckX, deckY);

    const ref = await RenderCustomPixiElement(gameContainer.current!, Card, {
      facing: "back",
      cardKey: cardKey,
      cardTextures: textures.cards,
      x: deckX,
      y: deckY,
      scale: scale * CARD_SCALE,
    });

    let targetX = 0;
    let targetY = 0;

    if (position === "player") {
      const offset =
        index !== undefined
          ? index * PLAYER_CARD_SPACING * scale
          : cards.current.playerCards.length * PLAYER_CARD_SPACING * scale;
      targetX = POSITIONS.playerHand.xRatio * bgWidth + offset;
      targetY = POSITIONS.playerHand.yRatio * bgHeight;
    } else if (position === "opponent") {
      const offset =
        index !== undefined
          ? index * OPPONENT_CARD_SPACING * scale
          : cards.current.opponentCards.length * OPPONENT_CARD_SPACING * scale;
      targetX = POSITIONS.computerHand.xRatio * bgWidth + offset;
      targetY = POSITIONS.computerHand.yRatio * bgHeight;
    } else if (position === "table") {
      targetX = POSITIONS.table.xRatio * bgWidth - 105;
      targetY = POSITIONS.table.yRatio * bgHeight - 125;
    }

    console.log("Target position for", position, ":", targetX, targetY);
    console.log("ref.current:", ref.current);

    await ref.current?.moveTo(new Point(targetX, targetY));
    if (flip) {
      await ref?.current?.setFacing("front");
    }
    return ref;
  };

  const clearCards = () => {
    Object.values(cards.current)
      .flat()
      .forEach(async (card) => {
        if (!card) return;
        await card.moveTo(
          new Point(width / 2, -(card.spriteRef.current?.height || 0))
        );
        card.spriteRef.current?.destroy();
      });
    cards.current = { playerCards: [], opponentCards: [], tableCard: null };
  };

  const dealInitialCards = async (
    playerHand: CardKey[],
    opponentCount: number,
    tableCard: CardKey
  ) => {
    clearCards();
    setGameState((prev) => ({ ...prev, state: "dealing" }));

    // Poczekaj aż kontener będzie miał poprawne wymiary
    let attempts = 0;
    while ((width === 0 || height === 0) && attempts < 50) {
      await waitFor(100);
      attempts++;
    }

    console.log(
      "Starting card dealing with width:",
      width,
      "height:",
      height,
      "scale:",
      scale
    );

    await waitFor(300);

    for (let i = 0; i < playerHand.length; i++) {
      const cardRef = await dealCard(playerHand[i], "player", true, i);
      cards.current.playerCards.push(cardRef.current!);
      await waitFor(200);
    }

    for (let i = 0; i < opponentCount; i++) {
      const cardRef = await dealCard("BB", "opponent", false, i);
      cards.current.opponentCards.push(cardRef.current!);
      await waitFor(200);
    }

    const tableCardRef = await dealCard(tableCard, "table", true);
    cards.current.tableCard = tableCardRef.current!;

    setGameState((prev) => ({ ...prev, state: "playing" }));
  };

  const updateCards = async (response: MakaoResponse) => {
    const currentState = gameStateRef.current;

    if (
      response.playerHand &&
      JSON.stringify(response.playerHand) !==
        JSON.stringify(currentState.playerHand)
    ) {
      for (const card of cards.current.playerCards) {
        await card.moveTo(new Point(width / 2, height + 200));
        card.spriteRef.current?.destroy();
      }
      cards.current.playerCards = [];

      for (let i = 0; i < response.playerHand.length; i++) {
        const cardRef = await dealCard(
          response.playerHand[i],
          "player",
          true,
          i
        );
        cards.current.playerCards.push(cardRef.current!);
      }
    }

    if (
      response.opponentHandCount !== undefined &&
      response.opponentHandCount !== currentState.opponentHandCount
    ) {
      const diff =
        response.opponentHandCount - cards.current.opponentCards.length;

      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          const cardRef = await dealCard(
            "BB",
            "opponent",
            false,
            cards.current.opponentCards.length
          );
          cards.current.opponentCards.push(cardRef.current!);
        }
      } else if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i++) {
          const card = cards.current.opponentCards.pop();
          if (card) {
            await card.moveTo(new Point(width / 2, height + 200));
            card.spriteRef.current?.destroy();
          }
        }
      }
    }

    if (response.tableCard && response.tableCard !== currentState.tableCard) {
      const oldTableCard = cards.current.tableCard;
      if (oldTableCard) {
        await oldTableCard.moveTo(new Point(width / 2, height + 200));
        oldTableCard.spriteRef.current?.destroy();
      }

      const tableCardRef = await dealCard(response.tableCard, "table", true);
      cards.current.tableCard = tableCardRef.current!;
    }
  };

  const updateGameState = useCallback(
    async (response: MakaoResponse) => {
      console.log("updateGameState called with:", response);
      console.log("User object from auth:", user);

      if (!response.playerHand || !response.tableCard) {
        console.error(
          "Missing required data - playerHand:",
          response.playerHand,
          "tableCard:",
          response.tableCard
        );
        return;
      }

      const isMyTurn = user?.id === response.currentPlayerId;
      console.log(
        "Is my turn:",
        isMyTurn,
        "My ID:",
        user?.id,
        "Current player ID:",
        response.currentPlayerId
      );

      const currentState = gameStateRef.current;

      setGameState((prev) => ({
        ...prev,
        state: "playing",
        playerHand: response.playerHand!,
        opponentHandCount: response.opponentHandCount || 0,
        tableCard: response.tableCard!,
        currentSuit: response.currentSuit || null,
        requiredNumber: response.requiredNumber || null,
        pendingDrawCount: response.pendingDrawCount || 0,
        drawType: response.drawType || null,
        pendingSkipTurns: response.pendingSkipTurns || 0,
        playerToSkip: response.playerToSkip || null,
        currentPlayerId: response.currentPlayerId || null,
        isMyTurn,
      }));

      if (
        isMyTurn &&
        response.playerToSkip !== null &&
        response.playerToSkip !== undefined &&
        response.playerToSkip === user?.id
      ) {
        const hasFour = response.playerHand!.some((card) => card[0] === "4");

        if (!hasFour) {
          setTimeout(() => {
            if (ws.current) {
              ws.current.send(
                JSON.stringify({
                  command: "skip_turn",
                })
              );
            }
          }, 1500);
        }
      }

      if (currentState.state === "waiting" || currentState.state === "idle") {
        await dealInitialCards(
          response.playerHand!,
          response.opponentHandCount || 0,
          response.tableCard!
        );
      } else {
        await updateCards(response);
      }
    },
    [user]
  );

  const handleGameOver = useCallback(
    async (response: MakaoResponse) => {
      // Update cards first before showing game over screen
      if (response.playerHand && response.tableCard) {
        await updateCards(response);
      }

      await waitFor(1000);

      setGameState((prev) => ({
        ...prev,
        state: "end",
        result: response.result === "WIN" ? "WYGRANA!" : "PRZEGRANA!",
        moneyWon: response.moneyWon || 0,
        opponentHandCount: response.opponentHandCount || 0,
      }));

      toast({
        title: response.result === "WIN" ? "Zwycięstwo!" : "Porażka",
        description:
          response.result === "WIN"
            ? `Wygrałeś ${response.moneyWon || 0} PLN!`
            : "Może następnym razem...",
        variant: response.result === "WIN" ? "default" : "destructive",
      });
    },
    [toast]
  );

  const joinRoom = async () => {
    if (!ws.current) {
      toast({
        title: "Błąd",
        description: "Brak połączenia z serwerem",
        variant: "destructive",
      });
      return;
    }

    try {
      await websocketRequest(ws.current, {
        command: "join_room",
        bet: stake,
      });
    } catch (error) {
      const err = error as ErrorResponse;
      toast({
        title: "Błąd",
        description: err.Message,
        variant: "destructive",
      });
    }
  };

  const startGame = () => {
    if (!ws.current) return;
    ws.current.send(
      JSON.stringify({
        command: "start_game",
      })
    );
  };

  const playCard = (
    cardIndex: number,
    chosenSuit?: string,
    chosenNumber?: string,
    chosenValue?: string
  ) => {
    if (!ws.current || gameState.state !== "playing" || !gameState.isMyTurn)
      return;
    const payload: any = {
      command: "play_card",
      card_index: cardIndex,
    };
    if (chosenSuit) payload.chosen_suit = chosenSuit;
    if (chosenNumber) payload.chosen_number = chosenNumber;
    if (chosenValue) payload.chosen_value = chosenValue;
    ws.current.send(JSON.stringify(payload));
  };

  const drawCard = () => {
    if (!ws.current || gameState.state !== "playing" || !gameState.isMyTurn)
      return;
    ws.current.send(
      JSON.stringify({
        command: "draw_card",
      })
    );
  };

  const skipTurn = () => {
    if (!ws.current || gameState.state !== "playing" || !gameState.isMyTurn)
      return;
    ws.current.send(
      JSON.stringify({
        command: "skip_turn",
      })
    );
  };

  const handleCardClick = (index: number) => {
    if (!gameState.isMyTurn || !gameState.tableCard) return;

    const card = gameState.playerHand[index];
    const cardValue = card[0];

    if (cardValue === "A") {
      setSelectedCard(index);
      setSuitSelectorVisible(true);
    } else if (cardValue === "J") {
      setSelectedCard(index);
      setNumberSelectorVisible(true);
    } else {
      playCard(index);
    }
  };

  const handleSuitSelection = (suit: string) => {
    if (selectedCard !== null) {
      playCard(selectedCard, suit);
      setSuitSelectorVisible(false);
      setSelectedCard(null);
    }
  };

  const handleNumberSelection = (number: string) => {
    if (selectedCard !== null) {
      playCard(selectedCard, undefined, number);
      setNumberSelectorVisible(false);
      setSelectedCard(null);
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

  useEffect(() => {
    console.log("Connecting to Makao WebSocket...");
    const socket = new WebSocket("ws://localhost:8081/ws/makao");
    socket.onopen = () => {
      console.log("Makao WebSocket connected");
      ws.current = socket;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as MakaoResponse | ErrorResponse;

        if ("Type" in data && data.Type === "ERROR") {
          toast({
            title: "Błąd",
            description: data.Message,
            variant: "destructive",
          });
          return;
        }

        const response = data as MakaoResponse;

        switch (response.type) {
          case "CONNECTED":
            console.log("Connected to Makao server");
            break;
          case "JOINED_ROOM":
            toast({
              title: "Pokój",
              description: response.message || "Dołączono do pokoju",
            });
            setGameState((prev) => ({ ...prev, state: "waiting" }));
            break;
          case "GAME_STARTED":
          case "GAME_STATE":
            updateGameState(response);
            break;
          case "GAME_OVER":
            handleGameOver(response);
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast({
        title: "Błąd połączenia",
        description: "Nie można połączyć się z serwerem",
        variant: "destructive",
      });
    };

    socket.onclose = () => {
      console.log("Makao WebSocket disconnected");
    };

    return () => {
      socket.close();
    };
  }, [updateGameState, handleGameOver, toast]);

  // Automatyczne przełączenie na pełny ekran przy montowaniu komponentu
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (error) {
        console.log("Nie można przełączyć na pełny ekran:", error);
      }
    };

    enterFullscreen();

    // Opcjonalnie: wyjście z pełnego ekranu przy odmontowaniu
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  return (
    <div>
      <div className="w-full h-screen flex flex-row justify-center items-center p-[50px]">
        <div
          className=" shadow-2xl shadow-black"
          style={{
            aspectRatio: ` ${textures.background.width} / ${textures.background.height}`,
            height: "100%",
            overflow: "hidden",
            position: "relative",
          }}
          ref={containerRef}
        >
          <Stage
            options={{ background: "rgb(31 44 69)" }}
            onMount={(a) => {
              app.current = a;
            }}
            width={width}
            height={height}
          >
            <Container
              ref={(ref) => {
                if (!ref) return;
                gameContainer.current = ref;
                if (!root.current) {
                  root.current = createRoot(ref);
                }
              }}
              key="gameContainer"
              sortableChildren={true}
            >
              <>
                <Sprite
                  name="background"
                  texture={textures.background}
                  scale={scale}
                />
                <Container
                  x={POSITIONS.deck.xRatio * textures.background.width * scale}
                  y={POSITIONS.deck.yRatio * textures.background.height * scale}
                  name="deck"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Card
                      key={i}
                      cardKey="BB"
                      facing={"back"}
                      cardTextures={textures.cards}
                      x={i * 2}
                      y={-i * 2}
                      scale={scale * CARD_SCALE}
                    />
                  ))}
                </Container>

                {/* Opponent card count */}
                {gameState.opponentHandCount > 0 && (
                  <Text
                    text={`Przeciwnik: ${gameState.opponentHandCount}`}
                    x={
                      POSITIONS.computerHand.xRatio *
                      textures.background.width *
                      scale
                    }
                    y={
                      POSITIONS.computerHand.yRatio *
                        textures.background.height *
                        scale -
                      90
                    }
                    anchor={0}
                    style={
                      new TextStyle({
                        fill: "white",
                        stroke: "black",
                        strokeThickness: 4,
                        fontSize: 32,
                        fontFamily: "Lato",
                      })
                    }
                  />
                )}

                {/* Current table card */}
                {gameState.tableCard && (
                  <Text
                    text={`Stół: ${getCardDisplayName(gameState.tableCard)}`}
                    x={
                      POSITIONS.table.xRatio * textures.background.width * scale
                    }
                    y={
                      POSITIONS.table.yRatio *
                        textures.background.height *
                        scale -
                      150
                    }
                    anchor={0.5}
                    style={
                      new TextStyle({
                        fill: "white",
                        stroke: "black",
                        strokeThickness: 5,
                        fontSize: 50,
                        fontFamily: "Lato",
                      })
                    }
                  />
                )}

                {/* Active suit requirement */}
                {gameState.currentSuit && (
                  <Text
                    text={`Wymagany kolor: ${getSuitSymbol(gameState.currentSuit)}`}
                    x={
                      POSITIONS.table.xRatio * textures.background.width * scale
                    }
                    y={
                      (POSITIONS.table.yRatio * textures.background.height +
                        200) *
                        scale -
                      120 * scale
                    }
                    anchor={0.5}
                    style={
                      new TextStyle({
                        fill: "yellow",
                        stroke: "black",
                        strokeThickness: 5,
                        fontSize: 45,
                        fontFamily: "Lato",
                      })
                    }
                  />
                )}

                {/* Required number (after Jack) */}
                {gameState.requiredNumber && (
                  <Text
                    text={`Wymagana liczba: ${gameState.requiredNumber === "T" ? "10" : gameState.requiredNumber}`}
                    x={
                      POSITIONS.table.xRatio * textures.background.width * scale
                    }
                    y={
                      (POSITIONS.table.yRatio * textures.background.height +
                        200) *
                      scale
                    }
                    anchor={0.5}
                    style={
                      new TextStyle({
                        fill: "cyan",
                        stroke: "black",
                        strokeThickness: 5,
                        fontSize: 45,
                        fontFamily: "Lato",
                      })
                    }
                  />
                )}

                {/* Pending draw count */}
                {gameState.pendingDrawCount > 0 && (
                  <Text
                    text={`Do dobrania: ${gameState.pendingDrawCount} kart (${gameState.drawType})`}
                    x={
                      POSITIONS.table.xRatio * textures.background.width * scale
                    }
                    y={
                      (POSITIONS.table.yRatio * textures.background.height +
                        280) *
                        scale -
                      100 * scale
                    }
                    anchor={0.5}
                    style={
                      new TextStyle({
                        fill: "orange",
                        stroke: "black",
                        strokeThickness: 5,
                        fontSize: 40,
                        fontFamily: "Lato",
                      })
                    }
                  />
                )}

                {/* Pending skip turns */}
                {gameState.pendingSkipTurns > 0 && (
                  <Text
                    text={`Pominiętych tur: ${gameState.pendingSkipTurns}`}
                    x={
                      POSITIONS.table.xRatio * textures.background.width * scale
                    }
                    y={
                      (POSITIONS.table.yRatio * textures.background.height +
                        280) *
                        scale -
                      800 * scale
                    }
                    anchor={0.5}
                    style={
                      new TextStyle({
                        fill: "magenta",
                        stroke: "black",
                        strokeThickness: 5,
                        fontSize: 40,
                        fontFamily: "Lato",
                      })
                    }
                  />
                )}

                {/* Turn indicator */}
                {gameState.state === "playing" && (
                  <Text
                    text={
                      gameState.isMyTurn ? "TWOJA TURA" : "TURA PRZECIWNIKA"
                    }
                    x={width / 2}
                    y={50 * scale}
                    anchor={0.5}
                    style={
                      new TextStyle({
                        fill: gameState.isMyTurn ? "lime" : "red",
                        stroke: "black",
                        strokeThickness: 8,
                        fontSize: 60,
                        fontFamily: "Lato",
                      })
                    }
                  />
                )}

                {/* Game result */}
                {gameState.result && (
                  <Text
                    text={gameState.result}
                    x={width / 2}
                    y={height / 2}
                    anchor={0.5}
                    scale={1}
                    style={
                      new TextStyle({
                        fill: gameState.result.includes("WYGRANA")
                          ? "lime"
                          : "red",
                        stroke: "black",
                        strokeThickness: 10,
                        fontSize: gameState.result.includes("WYGRANA")
                          ? 250
                          : 200,
                        fontFamily: "Lato",
                      })
                    }
                  />
                )}
              </>
            </Container>
          </Stage>

          {/* User Interface */}
          <div
            style={{
              position: "absolute",
              bottom: "1rem",
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              className="shadow-md shadow-black rounded-md w-[80%]"
              style={{
                backdropFilter: "blur(10px) brightness(0.8)",
                padding: "1rem",
              }}
            >
              <div className="flex justify-between items-center">
                <div className="flex gap-6">
                  <div className="h-full flex flex-col min-w-[150px] items-center">
                    <p className="text-sm text-center text-white">Saldo</p>
                    <p className="text-5xl text-center text-white">{balance}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      className="h-[80px] text-2xl text-white"
                      onClick={decreaseStake}
                      disabled={gameState.state !== "idle"}
                    >
                      -
                    </Button>
                    <div className="h-full flex flex-col w-[100px]">
                      <p className="text-sm text-center text-white">Stawka</p>
                      <p className="text-5xl text-center text-white">{stake}</p>
                    </div>
                    <Button
                      className="h-[80px] text-2xl text-white"
                      onClick={increaseStake}
                      disabled={gameState.state !== "idle"}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {gameState.state === "idle" && (
                  <Button
                    size="lg"
                    className="h-[80px] text-4xl text-white"
                    onClick={joinRoom}
                  >
                    DOŁĄCZ DO GRY
                  </Button>
                )}

                {gameState.state === "waiting" && (
                  <Button
                    size="lg"
                    className="h-[80px] text-3xl text-white"
                    onClick={startGame}
                  >
                    ROZPOCZNIJ GRĘ
                  </Button>
                )}

                {gameState.state === "playing" &&
                  gameState.isMyTurn &&
                  !gameState.pendingSkipTurns && (
                    <Button
                      size="lg"
                      className="h-[80px] text-3xl text-white"
                      onClick={drawCard}
                    >
                      DOBIERZ KARTĘ
                    </Button>
                  )}

                {gameState.state === "playing" &&
                  gameState.isMyTurn &&
                  gameState.playerToSkip === user?.id && (
                    <div className="h-[80px] flex items-center justify-center text-white text-2xl">
                      Automatycznie pomijanie tury...
                    </div>
                  )}

                {gameState.state === "end" && (
                  <Button
                    size="lg"
                    className="h-[80px] text-4xl text-white"
                    onClick={() => {
                      setGameState(defaultGameState);
                      clearCards();
                    }}
                  >
                    NOWA GRA
                  </Button>
                )}
              </div>

              {/* Player cards - clickable */}
              {gameState.state === "playing" &&
                gameState.playerHand.length > 0 && (
                  <div className="mt-4">
                    <p className="text-center text-white text-xl mb-2">
                      Twoje karty{" "}
                      {gameState.isMyTurn ? "(kliknij, aby zagrać):" : ""}
                    </p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {gameState.playerHand.map((card, index) => {
                        const canPlay =
                          gameState.tableCard && gameState.isMyTurn
                            ? canPlayCard(
                                card,
                                gameState.tableCard,
                                gameState.currentSuit,
                                gameState.requiredNumber,
                                gameState.pendingDrawCount,
                                gameState.drawType,
                                gameState.pendingSkipTurns,
                                gameState.playerToSkip,
                                user?.id
                              )
                            : false;
                        return (
                          <Button
                            key={index}
                            onClick={() => handleCardClick(index)}
                            disabled={!canPlay}
                            className={`text-lg h-[60px] ${canPlay ? "bg-green-600 hover:bg-green-700" : "bg-gray-600"}`}
                          >
                            {getCardDisplayName(card)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Suit selector for Ace */}
          {suitSelectorVisible && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1000,
              }}
            >
              <div className="bg-black bg-opacity-90 p-6 rounded-lg border-4 border-white">
                <p className="text-white text-2xl mb-4 text-center">
                  Wybierz kolor:
                </p>
                <div className="flex gap-4">
                  <Button
                    className="text-4xl h-[80px] w-[80px] bg-red-600 hover:bg-red-700"
                    onClick={() => handleSuitSelection("H")}
                  >
                    ♥
                  </Button>
                  <Button
                    className="text-4xl h-[80px] w-[80px] bg-red-600 hover:bg-red-700"
                    onClick={() => handleSuitSelection("D")}
                  >
                    ♦
                  </Button>
                  <Button
                    className="text-4xl h-[80px] w-[80px] bg-gray-800 hover:bg-gray-900"
                    onClick={() => handleSuitSelection("C")}
                  >
                    ♣
                  </Button>
                  <Button
                    className="text-4xl h-[80px] w-[80px] bg-gray-800 hover:bg-gray-900"
                    onClick={() => handleSuitSelection("S")}
                  >
                    ♠
                  </Button>
                </div>
                <Button
                  className="mt-4 w-full"
                  variant="destructive"
                  onClick={() => {
                    setSuitSelectorVisible(false);
                    setSelectedCard(null);
                  }}
                >
                  Anuluj
                </Button>
              </div>
            </div>
          )}

          {/* Number selector for Jack */}
          {numberSelectorVisible && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1000,
              }}
            >
              <div className="bg-black bg-opacity-90 p-6 rounded-lg border-4 border-white">
                <p className="text-white text-2xl mb-4 text-center">
                  Wybierz wymaganą liczbę (5-10):
                </p>
                <div className="flex gap-3">
                  {["5", "6", "7", "8", "9", "T"].map((num) => (
                    <Button
                      key={num}
                      className="text-2xl h-[70px] w-[70px] bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleNumberSelection(num)}
                    >
                      {num === "T" ? "10" : num}
                    </Button>
                  ))}
                </div>
                <Button
                  className="mt-4 w-full"
                  variant="destructive"
                  onClick={() => {
                    setNumberSelectorVisible(false);
                    setSelectedCard(null);
                  }}
                >
                  Anuluj
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Makao;
