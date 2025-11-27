import { ErrorResponse } from "@/games/Blackjack/types";
import { createRoot } from "@pixi/react";
import { clsx, type ClassValue } from "clsx";
import { debounce } from "lodash-es";
import { twMerge } from "tailwind-merge";
import type { Container } from "pixi.js";
import React, { useState, useImperativeHandle, forwardRef, ReactElement, ComponentPropsWithRef } from "react";

export type SpawnerHandle = {
  spawn: <T extends React.ElementType>(Element: T, props: React.ComponentPropsWithRef<T>) => Promise<React.RefObject<React.ComponentRef<T>>>;
  clear: () => void;
};

// This component sits inside your Pixi tree and renders whatever you tell it to
export const ImperativeSpawner = forwardRef<SpawnerHandle>((_, ref) => {
  // We store elements with a unique ID and their specific JSX
  const [items, setItems] = useState<{ id: number; element: ReactElement }[]>([]);

  useImperativeHandle(ref, () => ({
    spawn: <T extends React.ElementType>(Element: T, props: React.ComponentPropsWithRef<T>) => {
      return new Promise<React.RefObject<React.ComponentRef<T>>>((resolve) => {
        const id = Date.now() + Math.random();

        // We build props and use React.createElement to avoid JSX generic ref typing issues
        const elementProps = {
          key: id,
          ...(props as object),
          ref: (node: React.ComponentRef<T> | null) => {
            // Resolve the promise with the ref once mounted
            if (node) {
              resolve({ current: node } as React.RefObject<React.ComponentRef<T>>);
            }
          },
        } as any;

        const WrappedElement = React.createElement(Element as any, elementProps);

        setItems((prev) => [...prev, { id, element: WrappedElement }]);
      });
    },
    clear: () => {
      setItems([]); // React will unmount all children, Pixi-React will destroy sprites
    },
  }));

  return <>{items.map((i) => i.element)}</>;
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const websocketRequest = async <T extends object>(websocket: WebSocket, request: object) => {
  return new Promise<T>((resolve, reject) => {
    const handle = (event: MessageEvent) => {
      const data = JSON.parse(event.data) as T | ErrorResponse;
      if ("Type" in data && data.Type === "ERROR") {
        reject(data);
      } else {
        resolve(data as T);
      }
      websocket.removeEventListener("message", handle);
    };
    websocket.addEventListener("message", handle);
    websocket.send(JSON.stringify(request));
  });
};

export const useContainerSize = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const [width, _setWidth] = React.useState(0);
  const [height, _setHeight] = React.useState(0);

  React.useEffect(() => {
    if (!containerRef.current) return;
    console.log(containerRef.current);
    const setWidth = debounce(_setWidth, 100);
    const setHeight = debounce(_setHeight, 100);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setHeight(entry.contentRect.height);
      setWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
    };
  }, [containerRef]);

  return { width, height };
};

export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
