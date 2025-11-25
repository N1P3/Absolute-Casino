import React, { useMemo } from "react";
import { Cylinder, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { calculateChipStack, createChipTextureURI, getChipColor, getChipTextColor } from "./chipUtils";

interface ChipsProps {
    amount: number;
    position: [number, number, number];
}

const SingleChip = ({ value, position, index }: { value: number; position: [number, number, number], index: number }) => {
    const color = useMemo(() => getChipColor(value), [value]);
    const textColor = useMemo(() => getChipTextColor(value), [value]);
    const textureUri = useMemo(() => createChipTextureURI(value, color, textColor), [value, color, textColor]);

    // Load texture
    const texture = useTexture(textureUri);

    // Clone texture to ensure unique offset/rotation if needed, though not strictly necessary here
    // But we do want to ensure encoding is correct if we were using sRGB, but for data URI it's usually linear or sRGB depending on usage.
    // texture.colorSpace = THREE.SRGBColorSpace; // If using R3F v8+ / Three r152+

    return (
        <group position={position}>
            <Cylinder
                args={[0.15, 0.15, 0.05, 32]}
                castShadow
                receiveShadow
                rotation={[0, Math.random() * Math.PI, 0]} // Random rotation for realism
            >
                {/* Side Material - Solid Color */}
                <meshStandardMaterial attach="material-0" color={color} roughness={0.2} />

                {/* Top Material - Texture */}
                <meshStandardMaterial attach="material-1" map={texture} roughness={0.2} />

                {/* Bottom Material - Texture */}
                <meshStandardMaterial attach="material-2" map={texture} roughness={0.2} />
            </Cylinder>
        </group>
    );
};

const Chips: React.FC<ChipsProps> = ({ amount, position }) => {
    if (amount <= 0) return null;

    // Calculate stack of chips
    const chipStack = useMemo(() => {
        const fullStack = calculateChipStack(amount);
        // Limit to top 20 chips for performance/visuals, but prioritize higher values?
        // Our calculateChipStack returns [Small, ..., Big] because of the reverse logic we discussed?
        // Let's check chipUtils.ts:
        // stack.push(denom) -> [Big, Big, Small]
        // return stack.reverse() -> [Small, Big, Big]
        // So rendering from 0 (bottom) to N (top) puts Small at bottom, Big at top.
        // If we slice, we should take the *end* of the array to show the biggest chips on top.
        // But if we have too many, we might want to show a representative stack.
        // For now, let's just take the last 20.
        return fullStack.length > 20 ? fullStack.slice(fullStack.length - 20) : fullStack;
    }, [amount]);

    const chipHeight = 0.05;

    const jitter = useMemo(() => {
        const jitter = [];
        for (let i = 0; i < chipStack.length; i++) {
            jitter.push(Math.random() - 0.5);
        }
        return jitter;
    }, [chipStack]);

    return (
        <group position={position}>
            {chipStack.map((value, i) => (
                <SingleChip
                    key={i}
                    value={value}
                    index={i}
                    position={[
                        jitter[i] * 0.05, // Slight jitter x
                        i * chipHeight + chipHeight / 2, // Stack up
                        jitter[i] * 0.05 // Slight jitter z
                    ]}
                />
            ))}
        </group>
    );
};

export default Chips;
