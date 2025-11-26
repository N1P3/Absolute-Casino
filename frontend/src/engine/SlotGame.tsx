import { extend, useApplication } from "@pixi/react";
import { Sprite, Texture, Container, Point, Graphics } from "pixi.js";
import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { easings, useSpring, useSprings, animated } from "react-spring";
import { Line } from "./types";
import { MotionBlurFilter } from "pixi-filters";
// import { MotionBlurFilter } from "@pixi/filter-motion-blur";
const AnimatedSprite = animated("pixiSprite");
const AnimatedGraphics = animated("pixiGraphics");

extend({ Sprite, Container, Graphics });

type GameProps = {
  textures: {
    symbols: Texture[];
    background: Texture;
  };
  configuration: {
    numReels: number;
    numSymbols: number;
    padding: number;
    reelsBoundingBox: [x1: number, y1: number, x2: number, y2: number];
  };
  winningLines: Line[];
  scale: number;
  frozenSymbols?: [number, number][];
  highlightedSymbols?: [number, number][];
};

type Reel = {
  //   container: PixiContainer<DisplayObject>;
  symbols: Sprite[];
  position: number;
  previousPosition: number;
  blur: MotionBlurFilter;
};

export type EngineRef = {
  spinAsync: (getResult: () => Promise<number[][]>) => void;
};

const MIN_ROTATIONS = 20;
const REEL_ROTATION_MULTIPLIER = 50;
const REEL_SEQUENCE_TIME = 500;
const MIN_TIME = 2000;

const Game = React.forwardRef<EngineRef, GameProps>(({ textures, configuration, winningLines, scale, frozenSymbols, highlightedSymbols }, ref) => {
  const { app } = useApplication();
  const mainConatiner = useRef<Container>(null);
  // const spinning = useRef(false);
  const [spinning, setSpinning] = useState(false);
  // const [highlightedSymbols, setHighlightedSymbols] = useState<[number, number][]>([]);
  const map = useRef(Array.from({ length: configuration.numSymbols }, () => Array.from({ length: configuration.numReels }, () => getRandomSymbol(textures.symbols))));

  const [springs, api] = useSprings(configuration.numReels, (i) => ({
    y: 0,
    config: {
      easing: easings.easeOutCubic,
    },
  }));

  const [lineSpring] = useSpring(
    () => ({
      from: { opacity: 0 },
      to: async (next) => {
        await next({ opacity: 1, immediate: true, delay: 500 });
        await next({ opacity: 0, immediate: true, delay: 500 });
      },

      loop: true,
      reset: true,
    }),
    []
  );
  const [highlightSpring] = useSpring(
    () => ({
      from: { scale: 1 },
      to: async (next) => {
        await next({ scale: 1.2 });
        await next({ scale: 1 });
      },

      loop: true,
      reset: true,
    }),
    []
  );
  // const maskRef = useRef<PixiGraphics>(null);
  const reels = useRef<Reel[]>(
    Array.from({ length: configuration.numReels }).map(() => {
      const blur = new MotionBlurFilter({
        velocity: new Point(0, 0),
        kernelSize: 99,
      });
      return { symbols: [], position: 0, previousPosition: 0, blur };
    })
  );

  function tick() {
    // Update the slots.
    for (let i = 0; i < reels.current.length; i++) {
      const r = reels.current[i];
      // Update blur filter y amount based on speed.
      // This would be better if calculated with time in mind also. Now blur depends on frame rate.
      const spring = springs[i];
      // spring.y.advance(app.ticker.elapsedMS!);
      const springY = spring.y.get();

      r.position = springY;
      const speed = r.position - r.previousPosition;
      // r.blur.blurY = Math.min(Math.floor(speed * SYMBOL_HEIGHT), 100);
      r.blur.velocity = new Point(0, Math.min(Math.floor(speed * SYMBOL_HEIGHT), 200));
      // r.blur.blurY = speed;
      // console.log(r.blur.blurY);

      const passed = Math.floor(r.position);
      const prevPassed = Math.floor(r.previousPosition);
      r.previousPosition = r.position;

      if (passed > prevPassed) {
        const mapY = spring.y.goal - passed - configuration.padding;
        // let texture = mapY >= 0 && mapY < SYMBOLS ? resultMap[mapY][i] : getRandomTexture();
        const symbol = mapY >= 0 && mapY < configuration.numSymbols ? map.current[mapY][i] : getRandomSymbol(textures.symbols);

        //nie mam pojecia jak ale dziala
        const last = r.symbols.length - 1 - ((passed - 1) % r.symbols.length);
        const isFrozen = frozenSymbols?.some(([y, x]) => x === i && y + configuration.padding === last);
        if (isFrozen) {
          continue;
        }
        r.symbols[last].texture = textures.symbols[symbol];
      }

      // // Update symbol positions on reel.
      // for (let j = 0; j < r.symbols.length; j++) {
      //   const s = r.symbols[j];
      //   const y = (springY * SYMBOL_HEIGHT + j * SYMBOL_HEIGHT) % REEL_REAL_HEIGHT;
      //   s.y = y;
      // }
    }
  }

  useImperativeHandle(ref, () => ({
    spinAsync: async (getResult) => {
      if (spinning) return;
      setSpinning(true);
      const result = getResult();
      // springs.forEach((s) => s.y.set(0));
      const targets = reels.current.map((r, i) => {
        const extra = Math.floor(Math.random() * 10);
        const target = MIN_ROTATIONS + i * REEL_ROTATION_MULTIPLIER + extra;
        const time = MIN_TIME + i * REEL_SEQUENCE_TIME + extra * 100;
        return { target: Math.floor(target), time };
      });

      const animation = new Promise<void>((resolve) => {
        api.start((i) => {
          return {
            y: targets[i].target,
            config: { duration: targets[i].time },
            reset: true,
            // pause: true,
            onResolve: () => {
              if (i === targets.length - 1) {
                resolve();
              }
            },
          };
        });
      });

      app.ticker.add(tick);

      const res = await result;

      map.current = res;

      await animation;

      // await waitFor(200);

      app.ticker.remove(tick);

      setSpinning(false);
      // //Springs cleanup
      springs.forEach((s) => s.y.set(0));
      syncReelsWithMap();

      // //Reel state cleanup
      for (let i = 0; i < reels.current.length; i++) {
        const r = reels.current[i];
        // r.blur.blurY = 0;
        r.blur.velocity = new Point(0, 0);
        r.previousPosition = r.position = 0;
      }
    },
  }));

  const getTexture = useCallback(
    (x: number, y: number) => {
      // console.log("getTexture", x, y);
      if (y < configuration.padding || y >= configuration.numSymbols + configuration.padding) {
        return textures.symbols[getRandomSymbol(textures.symbols)];
      }
      return textures.symbols[map.current[y - configuration.padding][x]];
    },
    [configuration.numSymbols, configuration.padding, textures.symbols]
  );

  const syncReelsWithMap = useCallback(() => {
    for (let reelIndex = 0; reelIndex < configuration.numReels; reelIndex++) {
      const reel = reels.current[reelIndex];
      if (!reel) continue;
      for (let symbolIndex = 0; symbolIndex < configuration.numSymbols + 2 * configuration.padding; symbolIndex++) {
        const sprite = reel.symbols[symbolIndex];
        if (!sprite) continue;
        sprite.texture = getTexture(reelIndex, symbolIndex);
      }
    }
  }, [configuration.numReels, configuration.numSymbols, configuration.padding, getTexture]);

  // const scale = Math.min(app.view.width / textures.background.width, app.view.height / textures.background.height);

  const reelsPositionSize = useMemo(() => {
    const width = (configuration.reelsBoundingBox[2] - configuration.reelsBoundingBox[0]) * scale;
    const height = (configuration.reelsBoundingBox[3] - configuration.reelsBoundingBox[1]) * scale;
    const x = configuration.reelsBoundingBox[0] * scale;
    const y = configuration.reelsBoundingBox[1] * scale;
    return { x, y, width, height };
  }, [scale, configuration.reelsBoundingBox]);

  const REEL_WIDTH = reelsPositionSize.width / configuration.numReels;
  const SYMBOL_WIDTH = REEL_WIDTH;
  const SYMBOL_HEIGHT = reelsPositionSize.height / configuration.numSymbols;
  const REEL_REAL_HEIGHT = SYMBOL_HEIGHT * (configuration.numSymbols + 2 * configuration.padding);

  return (
    <pixiContainer ref={mainConatiner}>
      <pixiContainer x={reelsPositionSize.x} y={reelsPositionSize.y} width={reelsPositionSize.width}>
        {/* <Graphics name="mask" draw={(g) => g.clear().rect(0, 0, reelsPositionSize.width, reelsPositionSize.height).fill({ color: 0xfff, alpha: 0.5 })} ref={maskRef} /> */}
        {springs.map((spring, i) => {
          const hasFrozenSymbols = frozenSymbols?.some(([y, x]) => x === i);
          return (
            <pixiContainer
              key={i}
              x={REEL_WIDTH * i}
              filters={!hasFrozenSymbols ? [reels.current[i].blur] : undefined}
              y={-configuration.padding * SYMBOL_HEIGHT}
              width={REEL_WIDTH}
              height={REEL_REAL_HEIGHT}
              sortableChildren={true}
            >
              {Array.from({ length: configuration.numSymbols + 2 * configuration.padding }).map((_, j) => {
                const isHighlight = highlightedSymbols?.some(([y, x]) => x === i && y === j - configuration.padding);
                const isFrozen = frozenSymbols?.some(([y, x]) => x === i && y === j - configuration.padding);
                const texture = getTexture(i, j);
                const DEFAULT_SYMBOL_SCALE_X = SYMBOL_WIDTH / texture.width;
                const DEFAULT_SYMBOL_SCALE_Y = SYMBOL_HEIGHT / texture.height;
                // console.log(SYMBOL_WIDTH);
                return (
                  <AnimatedSprite
                    key={`${i}-${j}`}
                    texture={texture}
                    y={spring.y.to((springY) => {
                      if (isFrozen) return (j * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2) % REEL_REAL_HEIGHT;
                      return (springY * SYMBOL_HEIGHT + j * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2) % REEL_REAL_HEIGHT;
                    })}
                    // filters={!isFrozen && hasFrozenSymbols ? [reels.current[i].blur] : null}
                    // y={j * SYMBOL_HEIGHT}
                    x={Math.floor(SYMBOL_WIDTH / 2)}
                    width={Math.floor(SYMBOL_WIDTH)}
                    height={SYMBOL_HEIGHT}
                    ref={(r) => {
                      if (!r) return;
                      reels.current[i].symbols[j] = r;
                    }}
                    scale={
                      isHighlight
                        ? { x: highlightSpring.scale.to((s) => DEFAULT_SYMBOL_SCALE_X * s), y: highlightSpring.scale.to((s) => DEFAULT_SYMBOL_SCALE_Y * s) }
                        : { x: DEFAULT_SYMBOL_SCALE_X, y: DEFAULT_SYMBOL_SCALE_Y }
                    }
                    anchor={{
                      x: 0.5,
                      y: 0.5,
                    }}
                    zIndex={isHighlight || isFrozen ? 10 : 1}
                  />
                );
              })}
            </pixiContainer>
          );
        })}
        {winningLines.map((line, i) => (
          <AnimatedGraphics
            key={i}
            alpha={lineSpring.opacity}
            draw={(g) => {
              g.clear();

              g.moveTo(0, SYMBOL_HEIGHT * line[0][0] + SYMBOL_HEIGHT / 2);
              for (let i = 0; i < line.length; i++) {
                g.lineTo(SYMBOL_WIDTH * line[i][1] + SYMBOL_WIDTH / 2, SYMBOL_HEIGHT * line[i][0] + SYMBOL_HEIGHT / 2);
              }
              g.lineTo(SYMBOL_WIDTH * configuration.numReels, SYMBOL_HEIGHT * line[line.length - 1][0] + SYMBOL_HEIGHT / 2);
              g.stroke({ width: 10, color: 0xfcd34d, alpha: 1 });
            }}
          />
        ))}
      </pixiContainer>
      <pixiSprite texture={textures.background} scale={scale} zIndex={100} />
    </pixiContainer>
  );
});

const getRandomSymbol = (symbols: Texture[]) => Math.floor(Math.random() * symbols.length);

export default React.memo(Game);
