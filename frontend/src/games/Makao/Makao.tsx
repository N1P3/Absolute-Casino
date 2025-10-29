import React, { useRef, useMemo, useState } from "react";
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
} from "@/lib/utils";
import { GameState } from "./types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { canPlayCard, getCardDisplayName, getRandomCard } from "./helpers";
import { POSITIONS } from "./constants";

const stakes = [5, 10, 25, 50, 100, 500, 1000];
const PLAYER_CARD_SPACING = 100;
const COMPUTER_CARD_SPACING = 80;

const defaultGameState: GameState = {
  state: "idle",
  playerHand: [],
  computerHandCount: 0,
  tableCard: null,
  currentSuit: null,
  result: null,
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

  const cards = useRef<{
    playerCards: CardRef[];
    computerCards: CardRef[];
    tableCard: CardRef | null;
  }>({ playerCards: [], computerCards: [], tableCard: null });

  const root = useRef<ReactPixiRoot>();

  const [gameState, _setGameState] = useState<GameState>(defaultGameState);
  const [computerHand, setComputerHand] = useState<CardKey[]>([]); // Dodane: rzeczywiste karty komputera
  const { balance } = useAuth();
  const { width, height } = useContainerSize(containerRef);
  const { toast } = useToast();
  const [stake, setStake] = useState(5);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [suitSelectorVisible, setSuitSelectorVisible] = useState(false);

  const setGameState = (state: Partial<GameState>) => {
    _setGameState((prev) => ({ ...prev, ...state }));
  };

  const scale = useMemo(() => {
    return Math.min(
      width / textures.background.width,
      height / textures.background.height
    );
  }, [width, height, textures.background.width, textures.background.height]);

  const dealCard = async (
    cardKey: CardKey,
    position: "player" | "computer" | "table",
    flip: boolean,
    index?: number
  ) => {
    const ref = await RenderCustomPixiElement(gameContainer.current!, Card, {
      facing: "back",
      cardKey: cardKey,
      cardTextures: textures.cards,
      x: POSITIONS.deck.x * scale,
      y: POSITIONS.deck.y * scale,
      scale: scale * 1.0,
    });

    let targetX = 0;
    let targetY = 0;

    if (position === "player") {
      const offset =
        index !== undefined
          ? index * PLAYER_CARD_SPACING
          : cards.current.playerCards.length * PLAYER_CARD_SPACING;
      targetX = POSITIONS.playerHand.x * scale + offset * scale;
      targetY = POSITIONS.playerHand.y * scale;
    } else if (position === "computer") {
      const offset =
        index !== undefined
          ? index * COMPUTER_CARD_SPACING
          : cards.current.computerCards.length * COMPUTER_CARD_SPACING;
      targetX = POSITIONS.computerHand.x * scale + offset * scale;
      targetY = POSITIONS.computerHand.y * scale;
    } else if (position === "table") {
      targetX = POSITIONS.table.x * scale;
      targetY = POSITIONS.table.y * scale;
    }

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
    cards.current = { playerCards: [], computerCards: [], tableCard: null };
    setComputerHand([]); // Reset ręki komputera
  };

  const startGame = async () => {
    clearCards();
    setGameState({ ...defaultGameState, state: "dealing" });

    // Symulacja rozdania kart (mockup bez backendu)
    await waitFor(300);

    // Rozdaj 5 losowych kart graczowi
    const mockPlayerCards: CardKey[] = [];
    for (let i = 0; i < 5; i++) {
      const randomCard = getRandomCard();
      mockPlayerCards.push(randomCard);
      const cardRef = await dealCard(randomCard, "player", true, i);
      cards.current.playerCards.push(cardRef.current!);
      await waitFor(200);
    }

    // Rozdaj 5 kart komputerowi (zakryte) - wygeneruj rzeczywiste karty
    const mockComputerCards: CardKey[] = [];
    for (let i = 0; i < 5; i++) {
      const randomCard = getRandomCard();
      mockComputerCards.push(randomCard);
      const cardRef = await dealCard(randomCard, "computer", false, i);
      cards.current.computerCards.push(cardRef.current!);
      await waitFor(200);
    }
    setComputerHand(mockComputerCards);

    // Połóż losową kartę na stole
    const mockTableCard: CardKey = getRandomCard();
    const tableCardRef = await dealCard(mockTableCard, "table", true);
    cards.current.tableCard = tableCardRef.current!;

    setGameState({
      state: "playing",
      playerHand: mockPlayerCards,
      computerHandCount: 5,
      tableCard: mockTableCard,
      currentSuit: null,
    });
  };

  const playCard = async (cardIndex: number, chosenSuit?: string) => {
    if (gameState.state !== "playing") return;

    const card = gameState.playerHand[cardIndex];
    if (
      !gameState.tableCard ||
      !canPlayCard(card, gameState.tableCard, gameState.currentSuit)
    ) {
      toast({
        title: "Błąd",
        description: "Nie możesz zagrać tej karty!",
        variant: "destructive",
      });
      return;
    }

    setGameState({ state: "computer_turn" });

    // Przenieś kartę gracza na stół
    const oldTableCard = cards.current.tableCard;
    if (oldTableCard) {
      await oldTableCard.moveTo(new Point(width / 2, height + 200));
      oldTableCard.spriteRef.current?.destroy();
    }

    const playerCard = cards.current.playerCards[cardIndex];
    await playerCard.moveTo(
      new Point(POSITIONS.table.x * scale, POSITIONS.table.y * scale)
    );
    cards.current.tableCard = playerCard;
    cards.current.playerCards.splice(cardIndex, 1);

    const newPlayerHand = [...gameState.playerHand];
    newPlayerHand.splice(cardIndex, 1);

    // Jeśli zagrany As lub Joker i wybrano kolor
    let newSuit = gameState.currentSuit;
    if ((card[0] === "A" || card[0] === "J") && chosenSuit) {
      newSuit = chosenSuit;
    } else {
      newSuit = null;
    }

    setGameState({
      playerHand: newPlayerHand,
      tableCard: card,
      currentSuit: newSuit,
    });

    // Przemieść pozostałe karty gracza
    for (let i = 0; i < cards.current.playerCards.length; i++) {
      const cardRef = cards.current.playerCards[i];
      await cardRef.moveTo(
        new Point(
          POSITIONS.playerHand.x * scale + i * PLAYER_CARD_SPACING * scale,
          POSITIONS.playerHand.y * scale
        )
      );
    }

    // Sprawdź czy gracz wygrał
    if (newPlayerHand.length === 0) {
      await waitFor(1000);
      setGameState({
        state: "end",
        result: "WYGRANA!",
      });
      return;
    }

    // Tura komputera (mockup)
    await waitFor(1000);
    await computerTurn(card, newSuit);
  };

  const computerTurn = async (
    _lastPlayedCard: CardKey,
    _currentSuit: string | null
  ) => {
    // Mockup tury komputera - komputer zagrywa losową kartę lub dobiera
    const shouldPlay = Math.random() > 0.3; // 70% szans na zagranie karty

    if (
      shouldPlay &&
      gameState.computerHandCount > 0 &&
      computerHand.length > 0
    ) {
      // Komputer gra kartę
      const playedCardKey = computerHand[0]; // Weź pierwszą kartę z ręki komputera
      const computerCard = cards.current.computerCards[0];
      const oldTableCard = cards.current.tableCard;

      if (oldTableCard) {
        await oldTableCard.moveTo(new Point(width / 2, height + 200));
        oldTableCard.spriteRef.current?.destroy();
      }

      await computerCard.setFacing("front");
      await waitFor(300);
      await computerCard.moveTo(
        new Point(POSITIONS.table.x * scale, POSITIONS.table.y * scale)
      );

      cards.current.tableCard = computerCard;
      cards.current.computerCards.splice(0, 1);

      // Usuń kartę z ręki komputera
      const newComputerHand = [...computerHand];
      newComputerHand.splice(0, 1);
      setComputerHand(newComputerHand);

      // Przemieść pozostałe karty komputera
      for (let i = 0; i < cards.current.computerCards.length; i++) {
        const cardRef = cards.current.computerCards[i];
        await cardRef.moveTo(
          new Point(
            POSITIONS.computerHand.x * scale +
              i * COMPUTER_CARD_SPACING * scale,
            POSITIONS.computerHand.y * scale
          )
        );
      }

      const newComputerHandCount = gameState.computerHandCount - 1;

      // Sprawdź czy komputer wygrał
      if (newComputerHandCount === 0) {
        await waitFor(1000);
        setGameState({
          state: "end",
          computerHandCount: newComputerHandCount,
          tableCard: playedCardKey, // Użyj rzeczywistej karty
          currentSuit: null,
          result: "PRZEGRANA!",
        });
        return;
      }

      setGameState({
        state: "playing",
        computerHandCount: newComputerHandCount,
        tableCard: playedCardKey, // Użyj rzeczywistej karty
        currentSuit: null, // Komputer nie wybiera koloru w mockupie
      });
    } else {
      // Komputer dobiera kartę
      toast({
        title: "Komputer dobiera kartę",
        description: "Komputer nie może zagrać karty i dobiera z talii.",
      });

      const newCard = getRandomCard();
      const newCardRef = await dealCard(
        newCard,
        "computer",
        false,
        cards.current.computerCards.length
      );
      cards.current.computerCards.push(newCardRef.current!);

      // Dodaj kartę do ręki komputera
      const newComputerHand = [...computerHand, newCard];
      setComputerHand(newComputerHand);

      setGameState({
        state: "playing",
        computerHandCount: gameState.computerHandCount + 1,
      });
    }
  };

  const drawCard = async () => {
    if (gameState.state !== "playing") return;

    setGameState({ state: "computer_turn" });

    toast({
      title: "Dobranie karty",
      description: "Dobierasz kartę z talii.",
    });

    // Mockup - dodaj losową kartę do ręki gracza
    const newCard: CardKey = getRandomCard();
    const newCardRef = await dealCard(
      newCard,
      "player",
      true,
      cards.current.playerCards.length
    );
    cards.current.playerCards.push(newCardRef.current!);

    const newPlayerHand = [...gameState.playerHand, newCard];
    setGameState({
      playerHand: newPlayerHand,
    });

    await waitFor(500);

    // Tura komputera
    if (gameState.tableCard) {
      await computerTurn(gameState.tableCard, gameState.currentSuit);
    }
  };

  const handleCardClick = (index: number) => {
    const card = gameState.playerHand[index];
    if (card[0] === "A" || card[0] === "J") {
      // Jeśli As lub Joker, pokaż selektor koloru
      setSelectedCard(index);
      setSuitSelectorVisible(true);
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
                  x={POSITIONS.deck.x * scale}
                  y={POSITIONS.deck.y * scale}
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
                      scale={scale * 1.0}
                    />
                  ))}
                </Container>

                {/* Liczba kart komputera */}
                {gameState.computerHandCount > 0 && (
                  <Text
                    text={`Karty komputera: ${gameState.computerHandCount}`}
                    x={POSITIONS.computerHand.x * scale}
                    y={(POSITIONS.computerHand.y - 100) * scale}
                    anchor={0}
                    style={
                      new TextStyle({
                        fill: "white",
                        stroke: "black",
                        strokeThickness: 5,
                        fontSize: 40,
                        fontFamily: "Lato",
                      })
                    }
                  />
                )}

                {/* Aktualna karta na stole */}
                {gameState.tableCard && (
                  <Text
                    text={`Stół: ${getCardDisplayName(gameState.tableCard)}`}
                    x={POSITIONS.table.x * scale}
                    y={(POSITIONS.table.y - 150) * scale}
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

                {/* Wybrany kolor */}
                {gameState.currentSuit && (
                  <Text
                    text={`Wymagany kolor: ${gameState.currentSuit === "H" ? "♥" : gameState.currentSuit === "D" ? "♦" : gameState.currentSuit === "C" ? "♣" : "♠"}`}
                    x={POSITIONS.table.x * scale}
                    y={(POSITIONS.table.y + 200) * scale}
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

                {/* Wynik gry */}
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

          {/* Interfejs użytkownika */}
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
                    onClick={startGame}
                  >
                    ROZDAJ
                  </Button>
                )}

                {gameState.state === "playing" && (
                  <Button
                    size="lg"
                    className="h-[80px] text-3xl text-white"
                    onClick={drawCard}
                  >
                    DOBIERZ KARTĘ
                  </Button>
                )}

                {gameState.state === "end" && (
                  <Button
                    size="lg"
                    className="h-[80px] text-4xl text-white"
                    onClick={() => {
                      setGameState(defaultGameState);
                    }}
                  >
                    NOWA GRA
                  </Button>
                )}
              </div>

              {/* Karty gracza - klikalne */}
              {gameState.state === "playing" &&
                gameState.playerHand.length > 0 && (
                  <div className="mt-4">
                    <p className="text-center text-white text-xl mb-2">
                      Twoje karty (kliknij, aby zagrać):
                    </p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {gameState.playerHand.map((card, index) => {
                        const canPlay = gameState.tableCard
                          ? canPlayCard(
                              card,
                              gameState.tableCard,
                              gameState.currentSuit
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

          {/* Selektor koloru dla Asa/Jokera */}
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
        </div>
      </div>
    </div>
  );
};

export default Makao;
