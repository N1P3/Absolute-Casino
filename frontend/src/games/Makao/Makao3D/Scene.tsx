import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, ContactShadows, Environment, useGLTF, OrbitControls } from "@react-three/drei";
import { ACESFilmicToneMapping, AgXToneMapping, LinearSRGBColorSpace, NeutralToneMapping, Object3D, PCFSoftShadowMap } from "three";
import { EffectComposer, Bloom, DepthOfField, SSAO, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { WebGPURenderer } from "three/webgpu";

interface SceneProps {
  children?: React.ReactNode;
}

const Scene: React.FC<SceneProps> = ({ children }) => {
  const table = useGLTF("/table.glb");
  const target = React.useRef<Object3D>(null);

  table.scene.scale.set(2.5, 2.5, 2.5);

  React.useEffect(() => {
    table.scene.traverse((child) => {
      if ((child as any).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [table.scene]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      onCreated={(state) => {
        state.gl.toneMapping = NeutralToneMapping;
        state.gl.shadowMap.enabled = true;
        state.gl.shadowMap.type = PCFSoftShadowMap;
      }}
    >
      {/* Camera: Top-down with slight angle for optimal table view */}
      <PerspectiveCamera makeDefault position={[0, 8, 7]} fov={40} onUpdate={(c) => c.lookAt(0, 0, 0)} />

      <fog attach="fog" args={["#15151a", 15, 30]} />
      <object3D position={[0, 0, 0]} ref={target} />

      {/* Ambient lighting for overall brightness */}
      <ambientLight intensity={0.5} color="#fff" />

      {/* Main overhead light - warm casino lamp */}
      <spotLight
        color="#fff5e8"
        position={[5, 4, -6]}
        target={target.current ?? undefined}
        angle={0.6}
        penumbra={0.5}
        intensity={80}
        distance={0}
        decay={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00005}
      />
      <spotLight
        color="#fff5e8"
        position={[5, 4, 6]}
        target={target.current ?? undefined}
        angle={0.6}
        penumbra={0.5}
        intensity={80}
        distance={0}
        decay={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00005}
      />
      <spotLight
        color="#fff5e8"
        position={[-5, 4, 6]}
        target={target.current ?? undefined}
        angle={0.6}
        penumbra={0.5}
        intensity={80}
        distance={0}
        decay={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00005}
      />
      <spotLight
        color="#fff5e8"
        position={[-5, 4, -6]}
        target={target.current ?? undefined}
        angle={0.6}
        penumbra={0.5}
        intensity={80}
        distance={0}
        decay={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00005}
      />

      <Suspense fallback={null}>
        <primitive object={table.scene} />
        {children}
      </Suspense>
      <OrbitControls makeDefault />
    </Canvas>
  );
};

export default Scene;
