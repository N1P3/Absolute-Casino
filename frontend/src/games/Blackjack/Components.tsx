// import { Container, Graphics, Text } from "@pixi/react";
import { Result } from "./types";
import { TextStyle } from "pixi.js";

export const HandCountDisplay = ({ value, current, position, scale }: { value: string; current: boolean; position: { x: number; y: number }; scale: number }) => {
  return (
    <pixiText
      text={value}
      x={position.x * scale}
      y={position.y * scale - 250 * scale}
      anchor={0.5}
      scale={1}
      style={
        new TextStyle({
          fill: current ? "#fbbf24" : "#ffffff",
          fontSize: 50,
          fontFamily: "Outfit",
        })
      }
    />
  );
};

export const HandValueDisplay = ({ value, result, position, scale }: { value: number; result: Result; position: { x: number; y: number }; scale: number }) => {
  return (
    <pixiContainer anchor={0.5} x={position.x * scale - 100} y={position.y * scale - 50 * scale} zIndex={10}>
      <pixiGraphics
        // anchor={0.5}

        draw={(g) => g.clear().roundRect(0, 0, 200, 50, 10).fill({ color: 0x000000, alpha: 0.7 })}
        zIndex={10}
      />
      <pixiText
        text={`${value} PLN`}
        anchor={{
          x: 0.5,
          y: 0,
        }}
        y={2}
        x={100}
        scale={1}
        zIndex={11}
        style={
          new TextStyle({
            fill: result === Result.WIN || result === Result.BLACKJACK ? "#22c55e" : result === Result.LOST ? "#ef4444" : "#ffffff",
            fontSize: 40,
            fontFamily: "Outfit",
          })
        }
      />
    </pixiContainer>
  );
};
