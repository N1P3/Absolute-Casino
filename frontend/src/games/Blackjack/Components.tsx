import { Container, Graphics, Text } from "@pixi/react";
import { Result } from "./types";
import { TextStyle } from "pixi.js";

export const HandCountDisplay = ({ value, current, position, scale }: { value: string; current: boolean; position: { x: number; y: number }; scale: number }) => {
  return (
    <Text
      text={value}
      x={position.x * scale}
      y={position.y * scale - 250 * scale}
      anchor={0.5}
      scale={1}
      style={
        new TextStyle({
          fill: current ? "#fbbf24" : "white",
          fontSize: 50,
          fontFamily: "Lato",
        })
      }
    />
  );
};

export const HandValueDisplay = ({ value, result, position, scale }: { value: number; result: Result; position: { x: number; y: number }; scale: number }) => {
  return (
    <Container anchor={0.5} x={position.x * scale - 100} y={position.y * scale - 50 * scale} zIndex={10}>
      <Graphics anchor={0.5} draw={(g) => g.clear().beginFill(0x000000, 0.7).drawRoundedRect(0, 0, 200, 50, 10).endFill()} zIndex={10} />
      <Text
        text={`${value} PLN`}
        anchor={[0.5, 0]}
        y={2}
        x={100}
        scale={1}
        zIndex={11}
        style={
          new TextStyle({
            fill: result === Result.WIN || result === Result.BLACKJACK ? "#22c55e" : result === Result.LOST ? "#ef4444" : "white",
            fontSize: 40,
            fontFamily: "Lato",
          })
        }
      />
    </Container>
  );
};
