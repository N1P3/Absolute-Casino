import React, { useState } from "react";
import HoldemLobby from "./HoldemLobby";
import HoldemGame from "./HoldemGame";
import HoldemPlayground from "./HoldemPlayground";

type Screen = "lobby" | "table" | "playground";

const Holdem: React.FC = () => {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [activeTableId, setActiveTableId] = useState<number | null>(null);

  const handleJoinTable = (tableId: number) => {
    setActiveTableId(tableId);
    setScreen("table");
  };

  const handleEnterPlayground = () => {
    setScreen("playground");
  };

  const handleLeaveTable = () => {
    setActiveTableId(null);
    setScreen("lobby");
  };

  if (screen === "lobby") {
    return <HoldemLobby onJoinTable={handleJoinTable} onEnterPlayground={handleEnterPlayground} />;
  }

  if (screen === "playground") {
    return <HoldemPlayground onBack={() => setScreen("lobby")} />;
  }

  // Only render game if we have a table ID
  if (activeTableId !== null) {
    return <HoldemGame tableId={activeTableId} onLeaveTable={handleLeaveTable} />;
  }

  return null;
};

export default Holdem;
