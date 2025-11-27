import React from "react";
import { CardKey } from "@/games/shared";
import { GameState } from "../types";
import Card from "./Card";
import Deck from "./Deck";
import { calculateHandPosition } from "./cardUtils";
import { useCardTextures } from "./useCardTextures";

interface Game3DContentProps {
  state: GameState;
  onCardClick: (index: number) => void;
  onDrawCard: () => void;
}

const DECK_POS: [number, number, number] = [-2, 0.01, 0];
const TABLE_CARD_POS: [number, number, number] = [0, 0.01, 0];
const PLAYER_SEAT_POS: [number, number, number] = [0, 0, 5];
const OPPONENT_SEAT_POS: [number, number, number] = [0, 0, -5];
const TABLE_CENTER: [number, number, number] = [0, 0, 0];

const Game3DContent: React.FC<Game3DContentProps> = ({ state, onCardClick, onDrawCard }) => {
  const textures = useCardTextures();

  return (
    <>
      {/* Deck - Clickable to draw card */}
      <Deck 
        position={DECK_POS} 
        scale={0.2} 
        texture={textures["BB"]} 
        onClick={state.isMyTurn ? onDrawCard : undefined}
      />

      {/* Table Card (Discard Pile) */}
      {state.tableCard && (
        <Card
          cardKey={state.tableCard}
          textures={textures}
          position={TABLE_CARD_POS}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={0.2}
          fromPosition={DECK_POS}
          fromRotation={[-Math.PI / 2, 0, 0]}
        />
      )}

      {/* Player Hand */}
      {state.playerHand.map((card, i) => {
        const { positon, rotation } = calculateHandPosition(
          PLAYER_SEAT_POS,
          TABLE_CENTER,
          i,
          state.playerHand.length
        );

        return (
          <Card
            key={`player-${i}-${card}`}
            cardKey={card}
            textures={textures}
            position={positon}
            rotation={rotation}
            scale={0.2}
            fromPosition={DECK_POS}
            fromRotation={[-Math.PI / 2, 0, 0]}
            delay={i * 100}
            onClick={() => onCardClick(i)}
          />
        );
      })}

      {/* Opponent Hand */}
      {Array.from({ length: state.opponentHandCount }).map((_, i) => {
        const { positon, rotation } = calculateHandPosition(
          OPPONENT_SEAT_POS,
          TABLE_CENTER,
          i,
          state.opponentHandCount,
          true // faceDown
        );

        return (
          <Card
            key={`opponent-${i}`}
            cardKey="BB"
            textures={textures}
            position={positon}
            rotation={rotation}
            scale={0.2}
            flipped
            fromPosition={DECK_POS}
            fromRotation={[-Math.PI / 2, 0, 0]}
            delay={i * 100}
          />
        );
      })}
    </>
  );
};

export default Game3DContent;
