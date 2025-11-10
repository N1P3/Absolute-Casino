import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

interface UserType {
  id: number;
  name: string;
  balance: number;
}

interface UserContextType {
  user: UserType | null;
  balance: number | null;
  reload: () => void;
}

type BalanceUpdate = {
  Type: "BALANCE_UPDATE";
  Balance: number;
};

const defaultUserContext: UserContextType = {
  user: null,
  balance: null,
  // setUser: () => {},
  reload: () => {},
};

export const AuthContext = createContext(defaultUserContext);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};

export default function AuthProvider({ children }: { children: ReactNode }) {
  // const [user, setUser] = useState<UserType | null>(null);
  // const [reload, setReload] = useState<boolean>(false);
  const websocket = useRef<WebSocket | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const { data: user, refetch } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const response = await api.get<UserType>("/api/details");
        setBalance(response.data.balance);
        return response.data;
      } catch (err) {
        // console.error("Failed to fetch user:", err);
        return null;
      }
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (user) {
      websocket.current = new WebSocket("ws://localhost:8081/ws/balance");
      websocket.current.onmessage = (event) => {
        const data = JSON.parse(event.data) as BalanceUpdate;
        // console.log(data.Balance);
        setBalance(data.Balance);
      };
    }

    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
    };
  }, [user]);

  return <AuthContext.Provider value={{ user: user ?? null, reload: refetch, balance }}>{children}</AuthContext.Provider>;
}
