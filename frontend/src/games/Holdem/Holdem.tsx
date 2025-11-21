import React, {
    useState,
    useEffect,
} from "react";

import { Texture } from "pixi.js";
import { CardKey, loadCardTextures } from "../shared";
import { useToast } from "@/hooks/use-toast";

import HoldemLobby from "./HoldemLobby";
import HoldemGame from "./HoldemGame";

type Screen = "lobby" | "table";

const Holdem: React.FC = () => {
    const { toast } = useToast();

    const [screen, setScreen] = useState<Screen>("lobby");
    const [activeTableId, setActiveTableId] = useState<number | null>(null);

    const [textures, setTextures] = useState<Record<CardKey, Texture> | null>(
        null
    );
    const [loading, setLoading] = useState(true);

    const handleJoinTable = (tableId: number) => {
        setActiveTableId(tableId);
        setScreen("table");
    };

    const handleLeaveTable = () => {
        setActiveTableId(null);
        setScreen("lobby");
    };

    useEffect(() => {
        let destroyed = false;

        const init = async () => {
            try {
                const cardTextures = await loadCardTextures();
                if (destroyed) return;
                setTextures(cardTextures);
                setLoading(false);
            } catch (e) {
                console.error("loadCardTextures error", e);
                if (destroyed) return;
                setTextures({} as any);
                setLoading(false);
                toast({
                    title: "Błąd",
                    description: "Nie udało się załadować zasobów kart",
                    variant: "destructive",
                });
            }
        };

        init();

        return () => {
            destroyed = true;
        };
    }, [toast]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                Ładowanie…
            </div>
        );
    }

    if (screen === "lobby") {
        return <HoldemLobby onJoinTable={handleJoinTable} />;
    }

    // Only render game if we have a table ID and textures
    if (activeTableId !== null && textures) {
        return (
            <HoldemGame
                tableId={activeTableId}
                onLeaveTable={handleLeaveTable}
                textures={textures}
            />
        );
    }

};


export default Holdem;

