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
      // gl={async (props) => {
      //   const renderer = new WebGPURenderer(props as any);
      //   await renderer.init();
      //   renderer.toneMapping = NeutralToneMapping;
      //   renderer.shadowMap.enabled = true;
      //   // renderer.shadowMap.type = PCFSoftShadowMap;

      //   return renderer;
      // }}
    >
      {/* Camera: Top-down with slight angle for optimal table view */}
      <PerspectiveCamera makeDefault position={[0, 8, 7]} fov={40} onUpdate={(c) => c.lookAt(0, 0, 0)} />

      {/* Background color - dark casino room */}
      {/* <color attach="background" args={["#15151a"]} /> */}
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

      {/* <spotLight
        color="#fff5e8"
        position={[0, 5, 10]}
        target={target.current ?? undefined}
        angle={0.5}
        penumbra={0.5}
        intensity={500}
        distance={0}
        decay={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00005}
      /> */}

      {/* Subtle fill lights for depth */}
      {/* <directionalLight position={[10, 5, 0]} intensity={0.5} color="#fff5e8" />
      <directionalLight position={[-10, 5, 0]} intensity={0.5} color="#e8f0ff" /> */}

      {/* <pointLight position={[0, 5, 3]} intensity={50} color="#e8f0ff" castShadow />
      <pointLight position={[5, 5, 3]} intensity={50} color="#e8f0ff" castShadow />
      <pointLight position={[5, 5, -3]} intensity={50} color="#e8f0ff" castShadow />
      <pointLight position={[0, 5, -3]} intensity={50} color="#e8f0ff" castShadow />
      <pointLight position={[-5, 5, -3]} intensity={50} color="#e8f0ff" castShadow />
      <pointLight position={[-5, 5, 3]} intensity={50} color="#e8f0ff" castShadow /> */}

      {/* Subtle environment for ambient reflections */}
      {/* <Suspense fallback={null}>
        <Environment preset="lobby" environmentIntensity={0.2} />
      </Suspense> */}

      {/* Soft contact shadows */}
      {/* <ContactShadows position={[0, -0.05, 0]} opacity={0.3} scale={15} blur={2.5} far={5} resolution={512} color="#000000" /> */}

      {/* Ground plane */}
      {/* <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                <planeGeometry args={[50, 50]} />
                <meshStandardMaterial
                    color="#12121a"
                    roughness={0.95}
                    metalness={0.05}
                />
            </mesh> */}

      <Suspense fallback={null}>
        {/* <Table /> */}
        <primitive object={table.scene} />
        {/* <mesh castShadow receiveShadow geometry={nodes["Plane"].geometry} material={materials['Material.001']} /> */}
        {children}

        {/* Postprocessing: SSAO, Depth of Field, Bloom */}
        {/* <EffectComposer>
          <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
        </EffectComposer> */}
        {/* <EffectComposer multisampling={4} enableNormalPass > */}
        {/* <SSAO
            blendFunction={BlendFunction.MULTIPLY} // blend mode
            samples={30} // amount of samples per pixel (shouldn't be a multiple of the ring count)
            rings={4} // amount of rings in the occlusion sampling pattern
            distanceThreshold={1.0} // global distance threshold at which the occlusion effect starts to fade out. min: 0, max: 1
            distanceFalloff={0.0} // distance falloff. min: 0, max: 1
            rangeThreshold={0.5} // local occlusion range threshold at which the occlusion starts to fade out. min: 0, max: 1
            rangeFalloff={0.1} // occlusion range falloff. min: 0, max: 1
            luminanceInfluence={0.9} // how much the luminance of the scene influences the ambient occlusion
            radius={20} // occlusion sampling radius
            // scale={0.5} // scale of the ambient occlusion
            bias={0.5} // occlusion bias
          /> */}
        {/* <DepthOfField focusDistance={5} focalLength={20} bokehScale={2} />
          <Bloom intensity={0.1} luminanceThreshold={0.9} luminanceSmoothing={0.1} mipmapBlur /> */}
        {/* </EffectComposer> */}
      </Suspense>
      <OrbitControls makeDefault />
    </Canvas>
  );
};

export default Scene;
