import React, { useCallback, useImperativeHandle, useMemo, useRef, useEffect } from "react";
import { extend, useApplication } from "@pixi/react";
// 1. Import BlurFilter from pixi.js instead of pixi-filters
import { Sprite, Texture, Container, Graphics, BlurFilter } from "pixi.js";
import { easings, useSpring, useSprings, animated } from "react-spring";
import { Line } from "./types";

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

export type EngineRef = {
  spinAsync: (getResult: () => Promise<number[][]>) => void;
};

type ReelState = {
  symbols: Sprite[];
  // 2. Change type to native BlurFilter
  blurFilter: BlurFilter;
  prevSpinOffset: number;
};

const CONFIG = {
  MIN_ROTATIONS: 20,
  ROTATION_MULTIPLIER: 50,
  SEQUENCE_TIME: 500,
  MIN_TIME: 2000,
  // 3. Adjust max blur strength (Gaussian blur values are different from MotionBlur values)
  MAX_BLUR: 40,
};

const fitSymbol = (sprite: Sprite, texture: Texture, targetW: number, targetH: number) => {
  sprite.texture = texture;
  sprite.scale.set(targetW / texture.width, targetH / texture.height);
};

const Paylines = React.memo(({ lines, scaleX, scaleY, active }: { lines: Line[]; scaleX: number; scaleY: number; active: boolean }) => {
  const { opacity } = useSpring({
    opacity: active ? 1 : 0,
    config: { duration: 500 },
    loop: active ? { reverse: true } : false,
    immediate: !active,
  });

  if (lines.length === 0) return null;

  return lines.map((line, i) => (
    <AnimatedGraphics
      key={`line-${i}`}
      alpha={opacity}
      draw={(g) => {
        g.clear();
        g.setStrokeStyle({ width: 10, color: 0xfcd34d, alpha: 1 });
        const startY = scaleY * line[0][0] + scaleY / 2;
        g.moveTo(0, startY);

        line.forEach((point) => {
          g.lineTo(scaleX * point[1] + scaleX / 2, scaleY * point[0] + scaleY / 2);
        });

        const lastPoint = line[line.length - 1];
        g.lineTo(scaleX * line.length, scaleY * lastPoint[0] + scaleY / 2);
        g.stroke();
      }}
    />
  ));
});

const Game = React.forwardRef<EngineRef, GameProps>((props, ref) => {
  const { textures, configuration: config, winningLines, scale, frozenSymbols, highlightedSymbols } = props;
  const { app } = useApplication();

  const layout = useMemo(() => {
    const rawW = config.reelsBoundingBox[2] - config.reelsBoundingBox[0];
    const rawH = config.reelsBoundingBox[3] - config.reelsBoundingBox[1];

    return {
      x: config.reelsBoundingBox[0] * scale,
      y: config.reelsBoundingBox[1] * scale,
      width: rawW * scale,
      height: rawH * scale,
      reelWidth: (rawW * scale) / config.numReels,
      symbolHeight: (rawH * scale) / config.numSymbols,
      totalReelHeight: ((rawH * scale) / config.numSymbols) * (config.numSymbols + 2 * config.padding),
      symbolsPerReel: config.numSymbols + 2 * config.padding,
    };
  }, [scale, config]);

  const spinningRef = useRef(false);

  const resultsMap = useRef<number[][]>(Array.from({ length: config.numSymbols }, () => Array.from({ length: config.numReels }, () => Math.floor(Math.random() * textures.symbols.length))));

  const reelsRef = useRef<ReelState[]>([]);
  if (reelsRef.current.length === 0) {
    reelsRef.current = Array.from({ length: config.numReels }).map(() => {
      // 4. Initialize native BlurFilter
      // strength: 0 means no blur initially.
      const filter = new BlurFilter({ strength: 0, quality: 1 });
      filter.blurX = 0; // Ensure horizontal blur is always 0
      return {
        symbols: [],
        prevSpinOffset: 0,
        blurFilter: filter,
      };
    });
  }

  const [springs, api] = useSprings(config.numReels, (i) => ({
    y: 0,
    config: { easing: easings.easeOutCubic },
  }));

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

  const getRandomSymbolId = useCallback(() => Math.floor(Math.random() * textures.symbols.length), [textures]);

  const getTargetTexture = useCallback(
    (reelIndex: number, logicalRowIndex: number) => {
      const symbolRow = logicalRowIndex - config.padding;
      if (symbolRow >= 0 && symbolRow < config.numSymbols) {
        const symbolId = resultsMap.current[symbolRow][reelIndex];
        return textures.symbols[symbolId];
      }
      return textures.symbols[getRandomSymbolId()];
    },
    [config.padding, config.numSymbols, textures, getRandomSymbolId]
  );

  const tick = useCallback(() => {
    const { symbolHeight, totalReelHeight, reelWidth } = layout;

    reelsRef.current.forEach((reel, i) => {
      const currentSpinOffset = springs[i].y.get();

      const delta = currentSpinOffset - reel.prevSpinOffset;

      // 5. Update BlurY based on speed
      // We multiply delta (which is small per frame) to get a visible blur
      const blurAmount = Math.abs(delta * symbolHeight * 0.5);
      reel.blurFilter.blurY = Math.min(blurAmount, CONFIG.MAX_BLUR);

      const passedRows = Math.floor(currentSpinOffset);
      const prevPassedRows = Math.floor(reel.prevSpinOffset);
      reel.prevSpinOffset = currentSpinOffset;

      if (passedRows > prevPassedRows) {
        const mapRowIndex = springs[i].y.goal - passedRows - config.padding;
        const wrappingSymbolIndex = reel.symbols.length - 1 - ((passedRows - 1) % reel.symbols.length);
        const sprite = reel.symbols[wrappingSymbolIndex];

        const logicalRow = wrappingSymbolIndex - config.padding;
        const isFrozen = frozenSymbols?.some(([y, x]) => x === i && y === logicalRow);

        if (sprite && !isFrozen) {
          const symbolId = mapRowIndex >= 0 && mapRowIndex < config.numSymbols ? resultsMap.current[mapRowIndex][i] : getRandomSymbolId();

          fitSymbol(sprite, textures.symbols[symbolId], reelWidth, symbolHeight);
        }
      }

      reel.symbols.forEach((sprite, slotIndex) => {
        if (!sprite) return;

        const isFrozen = frozenSymbols?.some(([y, x]) => x === i && y === slotIndex - config.padding);

        if (isFrozen) {
          sprite.y = (slotIndex * symbolHeight + symbolHeight / 2) % totalReelHeight;
        } else {
          const shift = currentSpinOffset * symbolHeight + slotIndex * symbolHeight + symbolHeight / 2;
          sprite.y = shift % totalReelHeight;
        }
      });
    });
  }, [layout, springs, config, frozenSymbols, textures, getRandomSymbolId]);

  const forceSyncReels = useCallback(() => {
    const { reelWidth, symbolHeight, totalReelHeight } = layout;

    reelsRef.current.forEach((reel, i) => {
      // 6. Reset blur on sync
      reel.blurFilter.blurY = 0;
      reel.prevSpinOffset = 0;

      reel.symbols.forEach((sprite, j) => {
        if (!sprite) return;
        const tex = getTargetTexture(i, j);
        fitSymbol(sprite, tex, reelWidth, symbolHeight);
        sprite.y = (j * symbolHeight + symbolHeight / 2) % totalReelHeight;
      });
    });
  }, [layout, getTargetTexture]);

  useImperativeHandle(ref, () => ({
    spinAsync: async (getResult) => {
      if (spinningRef.current) return;
      spinningRef.current = true;

      const resultGrid = await getResult();

      const targets = reelsRef.current.map((_, i) => {
        const extra = Math.floor(Math.random() * 10);
        const target = CONFIG.MIN_ROTATIONS + i * CONFIG.ROTATION_MULTIPLIER + extra;
        const time = CONFIG.MIN_TIME + i * CONFIG.SEQUENCE_TIME + extra * 100;
        return { target: Math.floor(target), time };
      });

      const animationPromise = new Promise<void>((resolve) => {
        api.start((i) => ({
          y: targets[i].target,
          config: { duration: targets[i].time },
          reset: true,
          onResolve: () => {
            if (i === targets.length - 1) resolve();
          },
        }));
      });

      app.ticker.add(tick);
      resultsMap.current = resultGrid;

      await animationPromise;

      app.ticker.remove(tick);
      spinningRef.current = false;

      springs.forEach((s) => s.y.set(0));
      forceSyncReels();
    },
  }));

  useEffect(() => {
    forceSyncReels();
  }, [forceSyncReels]);

  return (
    <pixiContainer ref={null}>
      <pixiContainer x={layout.x} y={layout.y}>
        {springs.map((_, i) => {
          const isReelFrozen = frozenSymbols?.some(([_, x]) => x === i);

          return (
            <pixiContainer key={`reel-${i}`} x={layout.reelWidth * i} y={-config.padding * layout.symbolHeight} filters={!isReelFrozen ? [reelsRef.current[i].blurFilter] : []} sortableChildren={true}>
              {Array.from({ length: layout.symbolsPerReel }).map((_, j) => {
                const isHighlight = highlightedSymbols?.some(([y, x]) => x === i && y === j - config.padding);
                const isFrozen = frozenSymbols?.some(([y, x]) => x === i && y === j - config.padding);
                const initialTexture = textures.symbols[0];

                return (
                  <AnimatedSprite
                    key={`sym-${i}-${j}`}
                    texture={initialTexture}
                    anchor={0.5}
                    x={layout.reelWidth / 2}
                    ref={(el) => {
                      if (el) reelsRef.current[i].symbols[j] = el;
                    }}
                    zIndex={isHighlight || isFrozen ? 10 : 1}
                    scale={
                      isHighlight
                        ? {
                            x: highlightSpring.scale.to((s) => {
                              const w = reelsRef.current[i]?.symbols[j]?.texture.width ?? 100;
                              return (layout.reelWidth / w) * s;
                            }),
                            y: highlightSpring.scale.to((s) => {
                              const h = reelsRef.current[i]?.symbols[j]?.texture.height ?? 100;
                              return (layout.symbolHeight / h) * s;
                            }),
                          }
                        : undefined
                    }
                  />
                );
              })}
            </pixiContainer>
          );
        })}

        <Paylines lines={winningLines} scaleX={layout.reelWidth} scaleY={layout.symbolHeight} active={winningLines.length > 0} />
      </pixiContainer>

      <pixiSprite texture={textures.background} scale={scale} zIndex={100} />
    </pixiContainer>
  );
});

export default React.memo(Game);
