import { config } from "@/gamesConfig";
import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
import React from "react";
import { Suspense } from "react";

export const Route = createFileRoute("/game/$gameId")({
  component: () => {
    const game = useLoaderData({ from: "/game/$gameId" });
    const Component = game.component;
    return <Suspense fallback="Loading...">{<Component />}</Suspense>;
  },
  loader: (ctx) => {
    const gameId = ctx.params.gameId;
    const game = config.find((g) => g.gameId === gameId);
    if (!game) {
      throw new Error(`Game not found: ${gameId}`);
    }
    return game;
  },
});
