import React, { Suspense, useMemo, useEffect, useRef } from "react";
import type { Group } from "three";
import { Html, useGLTF } from "@react-three/drei";
import { HoldemPlayer } from "../types";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import PlayerOverlay from "../Components/PlayerOverlay";

interface PlayerSeatProps {
  player: HoldemPlayer;
  position: [number, number, number];
  isActive: boolean;
  isHero: boolean;
  dealer: boolean;
  // Optional center coordinates (defaults to table center at origin)
  center?: [number, number, number];
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({ player, position, isActive, isHero, dealer, center = [0, 0, 0] }) => {
  const groupRef = useRef<Group | null>(null);
  const playerModel = useGLTF("/player.glb");

  const clonedScene = useMemo(() => {
    if (!playerModel?.scene) return null;
    return SkeletonUtils.clone(playerModel.scene);
  }, [playerModel?.scene]);

  useEffect(() => {
    if (!clonedScene) return;
    clonedScene.scale.set(0.5, 0.5, 0.5);
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return () => {
      // Dispose cloned resources on unmount to avoid memory leaks.
      clonedScene.traverse((child: any) => {
        if (child.isMesh) {
          child.geometry?.dispose?.();
          if (Array.isArray(child.material)) {
            child.material.forEach((m: any) => m?.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        }
      });
    };
  }, [clonedScene]);

  // Rotate the group so the player model faces the table center horizontally (Y axis only)
  useEffect(() => {
    if (!groupRef.current) return;
    const [px, , pz] = position;
    const [cx, , cz] = center;
    // Angle so that the negative Z axis faces the center (three.js lookAt aligns -Z to target)
    const angle = Math.atan2(cx - px, cz - pz);
    groupRef.current.rotation.set(0, angle, 0);
  }, [position, center]);

  return (
    <group ref={groupRef} position={position}>
      <Suspense fallback={null}>{clonedScene && <primitive object={clonedScene} />}</Suspense>

      {/* HTML Overlay for Name and Stack */}
      <Html position={[0, 1.5, 0]} center>
        <PlayerOverlay player={player} isActive={isActive} isHero={isHero} dealer={dealer} />
      </Html>
    </group>
  );
};

export default PlayerSeat;
