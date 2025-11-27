import React from "react";
import { Box } from "@react-three/drei";
import { Texture } from "three";

interface DeckProps {
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    texture: Texture;
}

const Deck: React.FC<DeckProps> = ({ position, rotation = [0, 0, 0], scale = 1, texture }) => {
    // Card dimensions based on Card.tsx: 2.5 x 3.5
    // We want the deck to lie flat, so dimensions are:
    // Width (X): 2.5 * scale
    // Height (Y): Thickness of deck
    // Depth (Z): 3.5 * scale

    const width = 2.5 * scale;
    const length = 3.5 * scale;
    const height = 0.5 * scale; // Arbitrary deck height (approx 20-30 cards)

    return (
        <group position={position} rotation={rotation as any}>
            <Box args={[width, height, length]} castShadow receiveShadow>
                {/* Materials for the box faces */}
                {/* 0: Right, 1: Left, 2: Top, 3: Bottom, 4: Front, 5: Back */}

                {/* Sides (white/grey paper look) */}
                <meshStandardMaterial attach="material-0" color="#eeeeee" />
                <meshStandardMaterial attach="material-1" color="#eeeeee" />

                {/* Top (Card Back) */}
                <meshStandardMaterial attach="material-2" map={texture} />

                {/* Bottom (White or Card Back, doesn't matter much) */}
                <meshStandardMaterial attach="material-3" color="#eeeeee" />

                {/* Front/Back sides */}
                <meshStandardMaterial attach="material-4" color="#eeeeee" />
                <meshStandardMaterial attach="material-5" color="#eeeeee" />
            </Box>
        </group>
    );
};

export default Deck;
