import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CardKey } from "../shared";
import Scene from "./Holdem3D/Scene";
import Card from "./Holdem3D/Card";
import PlayerSeat from "./Holdem3D/PlayerSeat";
import Chips from "./Holdem3D/Chips";
import { useCardTextures } from "./Holdem3D/useCardTextures";
import { HoldemPlayer } from "./types";
import { calculateCardsPosition } from "./Holdem3D/cardUtils";

// Reusing constants from HoldemGame
const SEAT_POSITIONS_3D: { [seat: number]: [number, number, number] } = {
  0: [0, 0, 3], // Hero (Bottom Center)
  1: [4.2, 0, 2.2], // Right Bottom
  2: [4.2, 0, -2.2], // Right Top
  3: [0, 0, -3], // Top Center
  4: [-4.2, 0, -2.2], // Left Top
  5: [-4.2, 0, 2.2], // Left Bottom
};

const COMMUNITY_CARDS_START_X = -1.3;
const CARD_SPACING = 0.7;

const getRelativeCenterForPosition = (position: number): [number, number, number] => {
  switch (position) {
    case 0:
    case 3:
      return [0, 0, 0];
    case 1:
    case 2:
      return [2.1, 0, 0];
    case 4:
    case 5:
      return [-2.1, 0, 0];
    default:
      return [0, 0, 0];
  }
};

interface PlaygroundPlayer extends HoldemPlayer {
  name: string;
  holeCards?: string[];
  isDealer: boolean;
  isWinner: boolean;
}

interface PlaygroundState {
  players: PlaygroundPlayer[];
  communityCards: string[];
  pot: number;
  dealerSeat: number;
  currentPlayerSeat: number;
}

const INITIAL_STATE: PlaygroundState = {
  players: [
    {
      userId: 0,
      seatPosition: 0,
      name: "Hero",
      stack: 1000,
      betThisStreet: 0,
      folded: false,
      allIn: false,
      isDealer: true,
      isWinner: false,
      you: true,
      currentTurn: true,
      holeCards: ["AH", "KH"],
    },
  ],
  communityCards: [],
  pot: 0,
  dealerSeat: 0,
  currentPlayerSeat: 0,
};

const HoldemPlayground: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [state, setState] = useState<PlaygroundState>(INITIAL_STATE);

  // UI Control States
  const [selectedSeat, setSelectedSeat] = useState<number>(0);

  const updatePlayer = (seat: number, updates: Partial<PlaygroundPlayer>) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.seatPosition === seat ? { ...p, ...updates } : p)),
    }));
  };

  const addPlayer = (seat: number) => {
    if (state.players.find((p) => p.seatPosition === seat)) return;
    setState((prev) => ({
      ...prev,
      players: [
        ...prev.players,
        {
          userId: seat,
          seatPosition: seat,
          name: `Player ${seat}`,
          stack: 1000,
          betThisStreet: 0,
          folded: false,
          allIn: false,
          isDealer: false,
          isWinner: false,
          you: seat === 0,
          currentTurn: false,
          holeCards: seat === 0 ? ["AH", "KH"] : undefined, // Only Hero sees cards by default
        },
      ],
    }));
  };

  const removePlayer = (seat: number) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.seatPosition !== seat),
    }));
  };

  const setCommunityCards = (cardsStr: string) => {
    const cards = cardsStr.split(",").map((c) => c.trim().toUpperCase());
    //   .filter((c) => c.length > 0);
    setState((prev) => ({ ...prev, communityCards: cards }));
  };

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Controls Sidebar */}
      <div className="w-80 h-full bg-card border-r border-border p-4 overflow-y-auto flex flex-col gap-6 z-10 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Playground</h2>
          <Button variant="outline" size="sm" onClick={onBack}>
            Exit
          </Button>
        </div>

        {/* Global State */}
        <div className="space-y-4 border-b border-border pb-4">
          <h3 className="font-semibold text-muted-foreground">Global State</h3>
          <div className="grid gap-2">
            <Label>Pot Size</Label>
            <div className="flex gap-2">
              <Slider value={[state.pot]} onValueChange={([v]) => setState((s) => ({ ...s, pot: v }))} max={5000} step={10} />
              <span className="w-12 text-right font-mono">{state.pot}</span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Community Cards (comma sep)</Label>
            <Input placeholder="AH, KH, QH..." value={state.communityCards.join(", ")} onChange={(e) => setCommunityCards(e.target.value)} />
          </div>
        </div>

        {/* Quick Scenarios */}
        <div className="space-y-4 border-b border-border pb-4">
          <h3 className="font-semibold text-muted-foreground">Quick Scenarios</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setState(INITIAL_STATE);
                addPlayer(1);
                addPlayer(2);
                updatePlayer(0, { holeCards: ["AH", "KH"] });
                updatePlayer(1, { holeCards: ["QH", "JH"] });
                updatePlayer(2, { holeCards: ["TH", "9H"] });
              }}
            >
              Deal Preflop
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCommunityCards("AS, KS, QS")}>
              Deal Flop
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCommunityCards("AS, KS, QS, JS")}>
              Deal Turn
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCommunityCards("AS, KS, QS, JS, TS")}>
              Deal River
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setState(INITIAL_STATE)}>
              Reset
            </Button>
          </div>
        </div>

        {/* Player Management */}
        <div className="space-y-4 border-b border-border pb-4">
          <h3 className="font-semibold text-muted-foreground">Players</h3>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5].map((seat) => {
              const exists = state.players.find((p) => p.seatPosition === seat);
              return (
                <Button
                  key={seat}
                  variant={exists ? (selectedSeat === seat ? "default" : "secondary") : "outline"}
                  size="sm"
                  onClick={() => (exists ? setSelectedSeat(seat) : addPlayer(seat))}
                  className={!exists ? "opacity-50 hover:opacity-100" : ""}
                >
                  {exists ? `P${seat}` : `+${seat}`}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Selected Player Controls */}
        {(() => {
          const player = state.players.find((p) => p.seatPosition === selectedSeat);
          if (!player) return <div className="text-muted-foreground text-sm">Select a player to edit</div>;

          return (
            <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">
                  Player {selectedSeat} {player.you ? "(Hero)" : ""}
                </h3>
                <Button variant="destructive" size="sm" className="h-7 px-2 text-xs" onClick={() => removePlayer(selectedSeat)}>
                  Remove
                </Button>
              </div>

              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={player.name} onChange={(e) => updatePlayer(selectedSeat, { name: e.target.value })} />
              </div>

              <div className="grid gap-2">
                <Label>Stack</Label>
                <div className="flex gap-2">
                  <Slider value={[player.stack]} onValueChange={([v]) => updatePlayer(selectedSeat, { stack: v })} max={5000} step={50} />
                  <span className="w-12 text-right font-mono">{player.stack}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Bet Amount</Label>
                <div className="flex gap-2">
                  <Slider value={[player.betThisStreet]} onValueChange={([v]) => updatePlayer(selectedSeat, { betThisStreet: v })} max={player.stack} step={10} />
                  <span className="w-12 text-right font-mono">{player.betThisStreet}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Hole Cards (comma sep)</Label>
                <Input
                  placeholder="AH, KH"
                  value={(player.holeCards || []).join(", ")}
                  onChange={(e) => {
                    const cards = e.target.value
                      .split(",")
                      .map((c) => c.trim().toUpperCase())
                      .filter((c) => c.length > 0);
                    updatePlayer(selectedSeat, { holeCards: cards });
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={player.isDealer ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setState((prev) => ({ ...prev, dealerSeat: selectedSeat }));
                    updatePlayer(selectedSeat, { isDealer: true });
                  }}
                >
                  Dealer
                </Button>
                <Button variant={state.currentPlayerSeat === selectedSeat ? "default" : "outline"} size="sm" onClick={() => setState((prev) => ({ ...prev, currentPlayerSeat: selectedSeat }))}>
                  Active Turn
                </Button>
                <Button variant={player.folded ? "destructive" : "outline"} size="sm" onClick={() => updatePlayer(selectedSeat, { folded: !player.folded })}>
                  {player.folded ? "Folded" : "Active"}
                </Button>
                <Button
                  variant={player.isWinner ? "default" : "outline"}
                  size="sm"
                  onClick={() => updatePlayer(selectedSeat, { isWinner: !player.isWinner })}
                  className={player.isWinner ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                >
                  Winner
                </Button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3D Scene Container */}
      <div className="flex-1 relative bg-black">
        <Scene>
          <Game3DContent state={state} />
        </Scene>
      </div>
    </div>
  );
};

const Game3DContent: React.FC<{
  state: PlaygroundState;
}> = ({ state }) => {
  const textures = useCardTextures();
  //   const tableCenter: [number, number, number] = [0, 0, 0];

  return (
    <>
      {/* Community Cards */}
      {state.communityCards.map((card, i) => (
        <Card key={`community-${i}`} cardKey={card as CardKey} textures={textures} position={[COMMUNITY_CARDS_START_X + i * CARD_SPACING, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.25} />
      ))}

      {/* Players */}
      {state.players.map((player) => {
        const pos = SEAT_POSITIONS_3D[player.seatPosition] || [0, 0, 0];
        const relativeCenter = getRelativeCenterForPosition(player.seatPosition);
        const isHero = player.you;
        const cardsPos = calculateCardsPosition(pos, relativeCenter, !isHero && !player.folded);

        return (
          <group key={player.seatPosition}>
            <PlayerSeat
              player={player}
              position={pos}
              isActive={state.currentPlayerSeat === player.seatPosition}
              isHero={isHero}
              dealer={state.dealerSeat === player.seatPosition}
              center={relativeCenter}
            />

            {/* Chips */}
            {player.betThisStreet > 0 && <Chips amount={player.betThisStreet} position={[pos[0] * 0.5, 0.06, pos[2] * 0.5]} />}

            {/* Cards */}
            {/* Hero Cards or if we want to force show cards for testing */}
            {isHero && player.holeCards ? (
              <>
                <Card cardKey={player.holeCards[0] as CardKey} textures={textures} position={cardsPos[0].positon} rotation={cardsPos[0].rotation} scale={0.2} />
                <Card cardKey={player.holeCards[1] as CardKey} textures={textures} position={cardsPos[1].positon} rotation={cardsPos[1].rotation} scale={0.2} />
              </>
            ) : (
              // Face down cards for others if no hole cards set
              !player.folded && (
                <>
                  <Card cardKey="BB" textures={textures} position={cardsPos[0].positon} rotation={cardsPos[0].rotation} scale={0.2} flipped={true} />
                  <Card cardKey="BB" textures={textures} position={cardsPos[1].positon} rotation={cardsPos[1].rotation} scale={0.2} flipped={true} />
                </>
              )
            )}
          </group>
        );
      })}

      {/* Pot Chips */}
      {state.pot > 0 && <Chips amount={state.pot} position={[0, 0, -1]} />}
    </>
  );
};

export default HoldemPlayground;
