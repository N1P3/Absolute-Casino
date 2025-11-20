import { ErrorResponse } from "@/games/Blackjack/types";
import { createRoot, ReactPixiRoot } from "@pixi/react";
import { clsx, type ClassValue } from "clsx";
import { debounce } from "lodash-es";
import { Container } from "pixi.js";
import React from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function RenderCustomPixiElement<
  T extends React.JSXElementConstructor<any>,
>(
  container: Container,
  element: T,
  props: React.ComponentProps<T>
): Promise<React.RefObject<React.ElementRef<T>>> {
  return new Promise((resolve) => {
    const ref: { current: React.ElementRef<T> | null } = { current: null };
    const setRef = (el: React.ElementRef<T>) => {
      ref.current = el;
      resolve(ref);
    };
    const cont = new Container();
    const root = createRoot(cont);
    container.addChild(cont);
    const card = React.createElement(element, { ...props, ref: setRef });
    root.render(card);
  });
}

export const websocketRequest = async <T extends object>(
  websocket: WebSocket,
  request: object
) => {
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

export const useContainerSize = (
  containerRef: React.RefObject<HTMLDivElement>
) => {
  const [width, _setWidth] = React.useState(0);
  const [height, _setHeight] = React.useState(0);

  React.useEffect(() => {
    if (!containerRef.current) return;
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

export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
