import { Sprite } from "@pixi/react-animated";
import React, { useEffect, useImperativeHandle } from "react";
import { CardKey } from "../shared";
import { ObservablePoint, Point, Texture, Transform, Sprite as PixiSprite } from "pixi.js";
import { to, useSpring } from "react-spring";

type props = {
  cardKey: CardKey;
  facing: "front" | "back";
  cardTextures: Record<CardKey, Texture>;
  scale?: number;
} & React.ComponentProps<typeof Sprite>;

export type CardRef = {
  setFacing: (facing: "front" | "back") => Promise<void>;
  moveTo: (position: Point | ObservablePoint) => Promise<void>;
  spriteRef: React.RefObject<PixiSprite>;
  cardKey: CardKey;
};

const Card = React.forwardRef<CardRef, props>(({ cardKey, facing, cardTextures, ...props }, ref) => {
  const [currentFacing, setCurrentFacing] = React.useState(facing);
  const PixiSpriteRef = React.useRef<PixiSprite>(null);

  const [spring, api] = useSpring(() => ({
    scaleX: 1,
    x: props.x || 0,
    y: props.y || 0,
  }));

  const rotate = async (newFacing: "front" | "back") => {
    await api.start({
      scaleX: 0,
      onResolve: async () => {
        setCurrentFacing(newFacing);
        await api.start({
          scaleX: 1,
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
    moveTo: async (position) => {
      return new Promise(async (resolve) => {
        await api.start({
          x: position.x,
          y: position.y,
          onResolve: () => {
            resolve();
          },
          config: { duration: 300 },
        });
      });
    },
    spriteRef: PixiSpriteRef,
    cardKey,
  }));

  const scale = new Point(props.scale);

  return (
    <Sprite
      texture={currentFacing === "front" ? cardTextures[cardKey] : cardTextures["BB"]}
      pivot={[cardTextures[cardKey].width / 2, cardTextures[cardKey].height / 2]}
      ref={PixiSpriteRef}
      {...props}
      scale={spring.scaleX.to((scaleX) => [scaleX * (props.scale || 1), props.scale || 1])}
      // transform={}
      x={spring.x}
      y={spring.y}
    />
  );
});

export default Card;
