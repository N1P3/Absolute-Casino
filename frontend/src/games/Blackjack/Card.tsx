import { animated } from "react-spring";
import React, { useEffect, useImperativeHandle, useMemo } from "react";
import { CardKey } from "../shared";
import { ObservablePoint, Point, Texture, Sprite } from "pixi.js";
import { to, useSpring } from "react-spring";
import { extend } from "@pixi/react";

const AnimatedSprite = animated("pixiSprite");

extend({ Sprite });

type props = {
  cardKey: CardKey;
  facing: "front" | "back";
  cardTextures: Record<CardKey, Texture>;
  scale?: number;
} & React.ComponentProps<typeof AnimatedSprite>;

export type CardRef = {
  setFacing: (facing: "front" | "back") => Promise<void>;
  moveTo: (position: Point | ObservablePoint, duration?: number) => Promise<void>;
  spriteRef: React.RefObject<Sprite | null>;
  cardKey: CardKey;
};

const Card = React.forwardRef<CardRef, props>(({ cardKey, facing, cardTextures, ...props }, ref) => {
  const [currentFacing, setCurrentFacing] = React.useState(facing);
  const PixiSpriteRef = React.useRef<Sprite>(null);

  const [spring, api] = useSpring(() => ({
    scaleX: props.scale || 1,
    scaleY: props.scale || 1,
    x: props.x || 0,
    y: props.y || 0,
  }));

  const rotate = async (newFacing: "front" | "back") => {
    await api.start({
      scaleX: 0,
      onResolve: async () => {
        setCurrentFacing(newFacing);
        await api.start({
          scaleX: props.scale || 1,
        });
      },
      config: { duration: 100 },
    });
  };

  useEffect(() => {
    if (facing !== currentFacing) {
      rotate(facing);
    }
  }, [facing]);

  useImperativeHandle(ref, () => ({
    setFacing: async (facing) => {
      if (facing === currentFacing) return;
      await rotate(facing);
    },
    moveTo: async (position, duration) => {
      return new Promise(async (resolve) => {
        await api.start({
          x: position.x,
          y: position.y,
          onResolve: () => {
            resolve();
          },
          config: { duration: duration || 300 },
        });
      });
    },
    spriteRef: PixiSpriteRef,
    cardKey,
  }));

  const texture = currentFacing === "front" ? cardTextures[cardKey] : cardTextures["BB"];

  const pivot = useMemo(
    () => ({
      x: texture.width / 2,
      y: texture.height / 2,
    }),
    [texture]
  );

  return <AnimatedSprite ref={PixiSpriteRef} texture={texture} pivot={pivot} x={spring.x} y={spring.y} scale={to([spring.scaleX, spring.scaleY], (x, y) => ({ x, y }))} />;
});

export default Card;
