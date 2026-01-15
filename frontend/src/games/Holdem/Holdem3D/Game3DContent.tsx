import { CardKey } from "@/games/shared";
import { HoldemGameState } from "../types";
import Card from "./Card";
import Deck from "./Deck";
import { calculateCardsPosition } from "./cardUtils";
import Chips from "./Chips";
import PlayerSeat from "./PlayerSeat";
import { useCardTextures } from "./useCardTextures";
import { getRelativeCenter } from "../helpers";
import { SEAT_POSITIONS_3D } from "../constants";

const DECK_POS: [number, number, number] = [0, 0, -1.7]; // Dealer position
const POT_POS: [number, number, number] = [0, 0, -1];

const Game3DContent = ({ state }: { state: HoldemGameState }) => {
  const textures = useCardTextures();

  // Helper to calculate stack position relative to player
  const getStackPosition = (playerPos: [number, number, number], centerPos: [number, number, number]) => {
    const cardsPos = calculateCardsPosition(playerPos, centerPos, false)[0].positon;
    return [cardsPos[0] - 0.5, cardsPos[1], cardsPos[2]] as [number, number, number];
  };

  return (
    <>
      {/* Deck */}
      <Deck position={DECK_POS} scale={0.25} texture={textures["BB"]} />

      {/* Community Cards */}
      {state.communityCards.map((card, i) => (
        <Card
          key={`community-${i}`}
          cardKey={card as CardKey}
          textures={textures}
          position={[-1.3 + i * 0.7, 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={0.25}
          fromPosition={DECK_POS}
          fromRotation={[-Math.PI / 2, 0, 0]}
          delay={i * 200} // Staggered deal
        />
      ))}

      {/* Players */}
      {state.players.map((player) => {
        const pos = SEAT_POSITIONS_3D[player.seatPosition] || [0, 0, 0];
        const relativeCenter = getRelativeCenter(player.seatPosition);
        const isHero = player.you;
        const cardsPos = calculateCardsPosition(pos, relativeCenter);

        const stackPos = getStackPosition(pos, relativeCenter);
        const betPos: [number, number, number] = [pos[0] * 0.7, 0.06, pos[2] * 0.7];

        const showCards = player.holeCards && player.holeCards.length === 2;
        const isFaceDown = !isHero && !player.folded && !showCards;
        const card1 = showCards ? player.holeCards![0] : "BB";
        const card2 = showCards ? player.holeCards![1] : "BB";

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

            {/* Player Balance Chips */}
            <Chips
              amount={player.stack}
              position={stackPos}
              // No fromPosition means they drop from sky on load, then stay
            />

            {/* Hand Logic */}
            {!player.folded && (state.state === "playing" || showCards) && (
              <>
                <Card
                  key={`card1-${player.seatPosition}`}
                  cardKey={card1 as CardKey}
                  textures={textures}
                  position={cardsPos[0].positon}
                  rotation={cardsPos[0].rotation}
                  scale={isHero ? 0.25 : 0.2}
                  flipped={isFaceDown}
                  fromPosition={DECK_POS}
                  fromRotation={cardsPos[0].rotation}
                  delay={0}
                />
                <Card
                  key={`card2-${player.seatPosition}`}
                  cardKey={card2 as CardKey}
                  textures={textures}
                  position={cardsPos[1].positon}
                  rotation={cardsPos[1].rotation}
                  scale={isHero ? 0.25 : 0.2}
                  flipped={isFaceDown}
                  fromPosition={DECK_POS}
                  fromRotation={cardsPos[1].rotation}
                  delay={200}
                />
              </>
            )}
          </group>
        );
      })}

      {state.pot > 0 && (
        <Chips
          key={state.gameOver ? "pot-won" : "pot-active"}
          amount={state.pot}
          position={
            state.gameOver && state.players.some((p) => p.winner)
              ? getStackPosition(SEAT_POSITIONS_3D[state.players.find((p) => p.winner)!.seatPosition], getRelativeCenter(state.players.find((p) => p.winner)!.seatPosition))
              : POT_POS
          }
          fromPosition={state.gameOver ? POT_POS : [0, 5, 0]}
          delay={state.gameOver ? 0 : 500}
        />
      )}
    </>
  );
};

export default Game3DContent;
