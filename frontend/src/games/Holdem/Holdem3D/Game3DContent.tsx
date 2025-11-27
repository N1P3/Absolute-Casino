import { CardKey } from "@/games/shared";
import { HoldemGameState } from "../types";
import Card from "./Card";
import { calculateCardsPosition } from "./cardUtils";
import Chips from "./Chips";
import PlayerSeat from "./PlayerSeat";
import { useCardTextures } from "./useCardTextures";
import { getRelativeCenter } from "../helpers";
import { SEAT_POSITIONS_3D } from "../constants";

const DECK_POS: [number, number, number] = [0, 0.2, -2]; // Dealer position
const POT_POS: [number, number, number] = [0, 0, -1];

const Game3DContent = ({ state }: { state: HoldemGameState }) => {
  const textures = useCardTextures();

  //   console.log(state.playerHand);

  return (
    <>
      {/* Community Cards */}
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
          fromRotation={[0, Math.PI, 0]}
          delay={i * 200} // Staggered deal
        />
      ))}

      {/* Players */}
      {state.players.map((player) => {
        const pos = SEAT_POSITIONS_3D[player.seatPosition] || [0, 0, 0];
        const relativeCenter = getRelativeCenter(player.seatPosition);
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

            {player.betThisStreet > 0 && (
              <Chips
                amount={player.betThisStreet}
                position={[pos[0] * 0.5, 0.06, pos[2] * 0.5]}
                fromPosition={[pos[0], 0.06, pos[2]]} // From player seat
                delay={200}
              />
            )}

            {/* Hand Logic */}
            {isHero && state.playerHand?.length ? (
              <>
                <Card
                  cardKey={state.playerHand[0] as CardKey}
                  textures={textures}
                  position={cardsPos[0].positon}
                  rotation={cardsPos[0].rotation}
                  scale={0.2}
                  fromPosition={DECK_POS}
                  fromRotation={[0, Math.PI, 0]}
                  delay={0}
                />
                <Card
                  cardKey={state.playerHand[1] as CardKey}
                  textures={textures}
                  position={cardsPos[1].positon}
                  rotation={cardsPos[1].rotation}
                  scale={0.2}
                  fromPosition={DECK_POS}
                  fromRotation={[0, Math.PI, 0]}
                  delay={200}
                />
              </>
            ) : (
              !isHero &&
              !player.folded &&
              state.state === "playing" && (
                <>
                  <Card
                    cardKey="BB"
                    textures={textures}
                    position={cardsPos[0].positon}
                    rotation={cardsPos[0].rotation}
                    scale={0.2}
                    flipped
                    fromPosition={DECK_POS}
                    fromRotation={[0, Math.PI, 0]}
                    delay={0}
                  />
                  <Card
                    cardKey="BB"
                    textures={textures}
                    position={cardsPos[1].positon}
                    rotation={cardsPos[1].rotation}
                    scale={0.2}
                    flipped
                    fromPosition={DECK_POS}
                    fromRotation={[0, Math.PI, 0]}
                    delay={200}
                  />
                </>
              )
            )}
          </group>
        );
      })}

      {state.pot > 0 && <Chips amount={state.pot} position={POT_POS} fromPosition={[0, 5, 0]} delay={500} />}
    </>
  );
};

export default Game3DContent;
