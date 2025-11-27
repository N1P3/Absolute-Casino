import { useToast } from "@/hooks/use-toast";
import { websocketRequest } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { ACTION_TIMEOUT_MS, WS_URL } from "./constants";
import { HoldemResponse } from "./types";

/**
 * Manages the "Auto-Fold" countdown timer
 */
export const useActionTimer = (isMyTurn: boolean, onTimeout: () => void) => {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!isMyTurn) {
      setDeadline(null);
      setSecondsLeft(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const newDeadline = Date.now() + ACTION_TIMEOUT_MS;
    setDeadline(newDeadline);

    // Set the actual timeout action
    timeoutRef.current = setTimeout(() => {
      if (onTimeoutRef.current) onTimeoutRef.current();
    }, ACTION_TIMEOUT_MS);

    // Update the visual countdown
    const interval = setInterval(() => {
      const diff = newDeadline - Date.now();
      setSecondsLeft(diff <= 0 ? 0 : Math.ceil(diff / 1000));
    }, 250);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      clearInterval(interval);
    };
  }, [isMyTurn]);

  return { secondsLeft };
};

/**
 * Manages WebSocket connection and Game State updates
 */
export const useHoldemSocket = (tableId: number, onGameStateUpdate: (data: HoldemResponse) => void) => {
  const { toast } = useToast();
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socket.onopen = () => {
      console.log(`Connected to Holdem Table ${tableId}`);
      ws.current = socket;

      // Auto-join
      websocketRequest(socket, {
        command: "join_table",
        tableId,
        amount: 1000,
      }).catch((e) => console.error("Join failed", e));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Holdem WS Message:", data);

        if (data.type === "ERROR") {
          toast({ title: "Error", description: data.message, variant: "destructive" });
        } else if (data.type === "GAME_STATE") {
          onGameStateUpdate(data as HoldemResponse);
        }
      } catch (e) {
        console.error("WS Parse Error", e);
      }
    };

    socket.onclose = () => {
      console.log("Holdem WS Closed");
      ws.current = null;
    };

    return () => {
      socket.close();
    };
  }, [tableId, toast, onGameStateUpdate]);

  const sendCommand = useCallback(async (payload: any) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    console.log("Holdem WS Send:", payload);
    return websocketRequest(ws.current, payload);
  }, []);

  return { sendCommand };
};
