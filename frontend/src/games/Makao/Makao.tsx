import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { websocketRequest } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardKey } from "../shared";
import { canPlayCard, getCardDisplayName } from "./helpers";
import Game3DContent from "./Makao3D/Game3DContent";
import Scene from "./Makao3D/Scene";
import { ErrorResponse, GameState, MakaoResponse } from "./types";

const stakes = [5, 10, 25, 50, 100, 500, 1000];

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
  const ws = useRef<WebSocket>(null);
  const [gameState, setGameState] = useState<GameState>(defaultGameState);
  const { balance, user } = useAuth();
  const { toast } = useToast();
  const [stake, setStake] = useState(5);
  const [playWithAi, setPlayWithAi] = useState(false);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [suitSelectorVisible, setSuitSelectorVisible] = useState(false);
  const [numberSelectorVisible, setNumberSelectorVisible] = useState(false);

  const updateGameState = useCallback(
    async (response: MakaoResponse) => {
      console.log("updateGameState called with:", response);

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
    },
    [user]
  );

  const handleGameOver = useCallback(
    async (response: MakaoResponse) => {
      setGameState((prev) => ({
        ...prev,
        state: "end",
        result: response.result === "WIN" ? "WYGRANA!" : "PRZEGRANA!",
        moneyWon: response.moneyWon || 0,
        opponentHandCount: response.opponentHandCount || 0,
        // Update final state if provided
        playerHand: response.playerHand || prev.playerHand,
        tableCard: response.tableCard || prev.tableCard,
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
        play_with_ai: playWithAi,
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
    cardIndices: number[],
    chosenSuit?: string,
    chosenNumber?: string,
    chosenValue?: string
  ) => {
    if (!ws.current || gameState.state !== "playing" || !gameState.isMyTurn)
      return;
    const payload: any = {
      command: "play_card",
      card_indices: cardIndices,
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

  const handleCardClick = (index: number) => {
    if (!gameState.isMyTurn || !gameState.tableCard) return;

    const card = gameState.playerHand[index];
    const cardValue = card[0];

    // If we already have selected cards, check if the new card matches their rank
    if (selectedCards.length > 0) {
      const firstIndex = selectedCards[0];
      const firstCard = gameState.playerHand[firstIndex];
      if (firstCard[0] !== cardValue) {
        // Different rank, clear selection and select new one
        setSelectedCards([index]);
        return;
      }
    }

    // Toggle selection
    if (selectedCards.includes(index)) {
      setSelectedCards(selectedCards.filter((i) => i !== index));
    } else {
      setSelectedCards([...selectedCards, index]);
    }
  };

  const handlePlaySelected = () => {
    if (selectedCards.length === 0) return;

    const firstIndex = selectedCards[0];
    const card = gameState.playerHand[firstIndex];
    const cardValue = card[0];

    if (cardValue === "A") {
      setSuitSelectorVisible(true);
    } else if (cardValue === "J") {
      setNumberSelectorVisible(true);
    } else {
      playCard(selectedCards);
      setSelectedCards([]);
    }
  };

  const handleSuitSelection = (suit: string) => {
    if (selectedCards.length > 0) {
      playCard(selectedCards, suit);
      setSuitSelectorVisible(false);
      setSelectedCards([]);
    }
  };

  const handleNumberSelection = (number: string) => {
    if (selectedCards.length > 0) {
      playCard(selectedCards, undefined, number);
      setNumberSelectorVisible(false);
      setSelectedCards([]);
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

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-hidden">
      {/* 3D Scene */}
      <div className="flex-1 relative">
        <Scene>
          <Game3DContent
            state={gameState}
            onCardClick={handleCardClick}
            onDrawCard={drawCard}
          />
        </Scene>

        {/* Game Result Overlay */}
        {gameState.result && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-black/80 p-8 rounded-xl border-4 border-white text-center animate-in fade-in zoom-in duration-300">
              <h1
                className={`text-6xl font-bold mb-4 ${gameState.result.includes("WYGRANA") ? "text-green-500" : "text-red-500"}`}
              >
                {gameState.result}
              </h1>
              {gameState.moneyWon > 0 && (
                <p className="text-4xl text-yellow-400">
                  Wygrana: {gameState.moneyWon} PLN
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* UI Overlay */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-white/10 pointer-events-auto w-auto max-w-[95vw]">
          <div className="flex justify-between items-center gap-8">
            {/* Stats */}
            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Saldo
                </p>
                <p className="text-3xl font-bold text-white">{balance}</p>
              </div>

              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-white hover:bg-white/10"
                  onClick={decreaseStake}
                  disabled={gameState.state !== "idle"}
                >
                  -
                </Button>
                <div className="flex flex-col items-center min-w-[80px]">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    Stawka
                  </p>
                  <p className="text-2xl font-bold text-white">{stake}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-white hover:bg-white/10"
                  onClick={increaseStake}
                  disabled={gameState.state !== "idle"}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 items-center">
              {gameState.state === "playing" && (
                <div className="flex gap-2 mr-4 overflow-x-auto max-w-[600px] p-2 bg-white/5 rounded-lg border border-white/10">
                  {gameState.playerHand.map((card, index) => {
                    const canPlay =
                      gameState.isMyTurn &&
                      canPlayCard(
                        card,
                        gameState.tableCard,
                        gameState.currentSuit,
                        gameState.requiredNumber,
                        gameState.pendingDrawCount,
                        gameState.drawType,
                        gameState.pendingSkipTurns,
                        gameState.playerToSkip,
                        user?.id
                      );

                    const isRed = card.includes("H") || card.includes("D");
                    const isSelected = selectedCards.includes(index);
                    const isMatchingRank =
                      selectedCards.length > 0 &&
                      gameState.playerHand[selectedCards[0]][0] === card[0];

                    return (
                      <Button
                        key={`${index}-${card}`}
                        variant={isSelected ? "default" : "outline"}
                        className={`h-14 min-w-[60px] px-2 text-lg font-bold border-2 transition-all ${
                          isSelected
                            ? "bg-green-600 border-green-400 scale-110 shadow-lg shadow-green-900/20 ring-2 ring-white"
                            : canPlay || isMatchingRank
                              ? "hover:bg-white/10 border-white/20"
                              : "bg-gray-800/50 border-gray-600 opacity-50 grayscale"
                        }`}
                        onClick={() => handleCardClick(index)}
                        disabled={!canPlay && !isMatchingRank}
                      >
                        <span
                          className={
                            isRed && !canPlay && !isMatchingRank
                              ? "text-red-400"
                              : "text-white"
                          }
                        >
                          {getCardDisplayName(card)}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}

              {gameState.state === "playing" &&
                gameState.isMyTurn &&
                selectedCards.length > 0 && (
                  <Button
                    size="lg"
                    className="h-16 text-2xl px-8 bg-green-600 hover:bg-green-700 animate-in fade-in zoom-in"
                    onClick={handlePlaySelected}
                  >
                    GRAJ ({selectedCards.length})
                  </Button>
                )}

              {gameState.state === "idle" && (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center space-x-2 bg-black/40 p-2 rounded-lg border border-white/10">
                    <Checkbox
                      id="ai-mode"
                      checked={playWithAi}
                      onCheckedChange={(checked) =>
                        setPlayWithAi(checked as boolean)
                      }
                      className="border-white data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                    />
                    <Label
                      htmlFor="ai-mode"
                      className="text-white font-bold cursor-pointer select-none"
                    >
                      Graj z AI
                    </Label>
                  </div>
                  <Button
                    size="lg"
                    className="h-16 text-2xl px-8 bg-green-600 hover:bg-green-700"
                    onClick={joinRoom}
                  >
                    DOŁĄCZ
                  </Button>
                </div>
              )}

              {gameState.state === "waiting" && (
                <Button
                  size="lg"
                  className="h-16 text-2xl px-8 bg-blue-600 hover:bg-blue-700"
                  onClick={startGame}
                >
                  START
                </Button>
              )}

              {gameState.state === "playing" &&
                gameState.isMyTurn &&
                !gameState.pendingSkipTurns && (
                  <Button
                    size="lg"
                    className="h-16 text-2xl px-8 bg-yellow-600 hover:bg-yellow-700"
                    onClick={drawCard}
                  >
                    DOBIERZ
                  </Button>
                )}

              {gameState.state === "playing" &&
                gameState.isMyTurn &&
                gameState.playerToSkip === user?.id && (
                  <div className="h-16 flex items-center px-8 text-white text-xl bg-white/10 rounded-md">
                    Pomijanie tury...
                  </div>
                )}

              {gameState.state === "end" && (
                <Button
                  size="lg"
                  className="h-16 text-2xl px-8 bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    setGameState(defaultGameState);
                  }}
                >
                  NOWA GRA
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Suit selector for Ace */}
      {suitSelectorVisible && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-gray-900 p-8 rounded-xl border-2 border-white/20 shadow-2xl">
            <p className="text-white text-2xl mb-6 text-center font-bold">
              Wybierz kolor
            </p>
            <div className="flex gap-4 mb-6">
              <Button
                className="text-4xl h-20 w-20 bg-red-600 hover:bg-red-700 rounded-xl"
                onClick={() => handleSuitSelection("H")}
              >
                ♥
              </Button>
              <Button
                className="text-4xl h-20 w-20 bg-red-600 hover:bg-red-700 rounded-xl"
                onClick={() => handleSuitSelection("D")}
              >
                ♦
              </Button>
              <Button
                className="text-4xl h-20 w-20 bg-gray-800 hover:bg-gray-700 rounded-xl"
                onClick={() => handleSuitSelection("C")}
              >
                ♣
              </Button>
              <Button
                className="text-4xl h-20 w-20 bg-gray-800 hover:bg-gray-700 rounded-xl"
                onClick={() => handleSuitSelection("S")}
              >
                ♠
              </Button>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setSuitSelectorVisible(false);
                setSelectedCards([]);
              }}
            >
              Anuluj
            </Button>
          </div>
        </div>
      )}

      {/* Number selector for Jack */}
      {numberSelectorVisible && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-gray-900 p-8 rounded-xl border-2 border-white/20 shadow-2xl">
            <p className="text-white text-2xl mb-6 text-center font-bold">
              Wybierz liczbę
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {["5", "6", "7", "8", "9", "T"].map((num) => (
                <Button
                  key={num}
                  className="text-2xl h-16 w-16 bg-blue-600 hover:bg-blue-700 rounded-xl"
                  onClick={() => handleNumberSelection(num)}
                >
                  {num === "T" ? "10" : num}
                </Button>
              ))}
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setNumberSelectorVisible(false);
                setSelectedCards([]);
              }}
            >
              Anuluj
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Makao;
