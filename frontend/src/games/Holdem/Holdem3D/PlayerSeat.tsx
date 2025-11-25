import React, { Suspense, useMemo, useEffect, useRef } from "react";
import type { Group } from "three";
import { Html, useGLTF } from "@react-three/drei";
import { HoldemPlayer } from "../types";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

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
      {/* Avatar Placeholder */}
      {/* <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 0.1, 32]} />
                <meshStandardMaterial color={isActive ? "#fbbf24" : "#333"} />
            </mesh> */}
      <Suspense fallback={null}>{clonedScene && <primitive object={clonedScene} />}</Suspense>

      {/* HTML Overlay for Name and Stack */}
      <Html position={[0, 1.5, 0]} center>
        <div
          className={`relative overflow-hidden rounded-xl border backdrop-blur-md shadow-xl transition-all duration-300 w-32 ${
            isHero ? "bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(234,179,8,0.15)]" : "bg-black/60 border-white/10"
          } ${isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-black" : ""}`}
        >
          {player.folded && (
            <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
              <span className="text-white/50 font-bold uppercase tracking-widest text-xs">Pas</span>
            </div>
          )}

          <div className="p-2 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 w-full justify-center relative">
              {dealer && <div className="absolute left-0 w-4 h-4 rounded-full bg-yellow-500 text-black text-[8px] font-bold flex items-center justify-center shadow-lg">D</div>}
              <span className={`font-bold truncate max-w-[80px] text-xs ${isHero ? "text-primary" : "text-white"}`}>{isHero ? "TY" : `Gracz ${player.userId}`}</span>
            </div>

            <div className="w-full h-px bg-white/10 my-0.5"></div>

            <div className="flex flex-col items-center">
              <span className="font-mono font-bold text-white text-sm">{player.stack}</span>
            </div>

            {player.betThisStreet > 0 && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 border border-primary/30 text-primary px-2 py-0.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
                {player.betThisStreet}
              </div>
            )}
          </div>
        </div>
      </Html>
    </group>
  );
};

export default PlayerSeat;
