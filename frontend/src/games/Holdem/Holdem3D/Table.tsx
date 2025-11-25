// import React, { useEffect, useMemo } from "react";
// import { Shape, Path, Vector3, Vector2, CatmullRomCurve3, RepeatWrapping, MirroredRepeatWrapping } from "three";
// import { Text, Line, useTexture } from "@react-three/drei";
// import { useLoader } from "@react-three/fiber";

// // Dimensions (Scaled to match previous size)
// const WIDTH = 12;
// const HEIGHT = 7; // Approx based on aspect ratio
// const RAIL_WIDTH = 0.7;
// const RADIUS = 3.5; // Half of height for full semicircle

// const createStadiumShape = (width: number, height: number, radius: number) => {
//     const shape = new Shape();
//     const straightWidth = width - 2 * radius;
//     const cxRight = straightWidth / 2;
//     const cxLeft = -straightWidth / 2;

//     shape.moveTo(cxRight, -radius);
//     shape.absarc(cxRight, 0, radius, -Math.PI / 2, Math.PI / 2, false);
//     shape.lineTo(cxLeft, radius);
//     shape.absarc(cxLeft, 0, radius, Math.PI / 2, 3 * Math.PI / 2, false);
//     shape.lineTo(cxRight, -radius);

//     return shape;
// };

// const Table: React.FC = () => {
//     // 1. Rail Shape
//     const railShape = useMemo(() => {
//         const shape = createStadiumShape(WIDTH, HEIGHT, RADIUS);
//         const hole = createStadiumShape(WIDTH - RAIL_WIDTH * 2, HEIGHT - RAIL_WIDTH * 2, RADIUS - RAIL_WIDTH);
//         shape.holes.push(hole);
//         return shape;
//     }, []);

//     // 2. Felt Shape
//     const feltShape = useMemo(() => {
//         return createStadiumShape(WIDTH - RAIL_WIDTH * 2, HEIGHT - RAIL_WIDTH * 2, RADIUS - RAIL_WIDTH);
//     }, []);

//     const leatherTexture = useTexture({
//         map: "/textures/leather/leather_red_02_coll1_1k.jpg",
//         normalMap: "/textures/leather/leather_red_02_nor_gl_1k.jpg",
//         roughnessMap: "/textures/leather/leather_red_02_rough_1k.jpg", // Removing roughness map to avoid shininess
//         aoMap: "/textures/leather/leather_red_02_ao_1k.jpg",
//         displacementMap: "/textures/leather/leather_red_02_disp_1k.png",
//     });

//     useEffect(() => {
//         [
//             leatherTexture.normalMap,
//             // leatherTexture.roughnessMap,
//             leatherTexture.aoMap,
//             leatherTexture.displacementMap
//         ].forEach(t => {
//             if (t) {
//                 t.wrapS = t.wrapT = RepeatWrapping;
//                 t.repeat.set(0.1, 0.1); // Increased repeat to minimize seam visibility
//                 t.needsUpdate = true;
//             }
//         });
//     }, [leatherTexture]);

//     const linenTexture = useTexture({
//         map: "/textures/linen/rough_linen_diff_1k.jpg",
//         normalMap: "/textures/linen/rough_linen_nor_gl_1k.jpg",
//         roughnessMap: "/textures/linen/rough_linen_rough_1k.jpg",
//         aoMap: "/textures/linen/rough_linen_ao_1k.jpg",
//         displacementMap: "/textures/linen/rough_linen_disp_1k.png",
//     });

//     useEffect(() => {
//         [
//             linenTexture.map,
//             linenTexture.normalMap,
//             linenTexture.roughnessMap,
//             linenTexture.aoMap,
//             linenTexture.displacementMap
//         ].forEach(t => {
//             if (t) {
//                 t.wrapS = t.wrapT = RepeatWrapping;
//                 t.repeat.set(0.7, 0.7); // Adjust repeat for linen scale
//                 t.needsUpdate = true;
//             }
//         });
//     }, [linenTexture]);

//     return (
//         <group rotation={[-Math.PI / 2, 0, 0]}>
//             {/* Rail */}
//             <mesh position={[0, 0, 0]} castShadow receiveShadow ref={(mesh) => {
//                 if (mesh && mesh.geometry) {
//                     mesh.geometry.computeVertexNormals();
//                 }
//             }}>
//                 <extrudeGeometry
//                     args={[
//                         railShape,
//                         {
//                             depth: 0.15,
//                             bevelEnabled: true,
//                             bevelThickness: 0.1,
//                             bevelOffset: -0.2,
//                             bevelSize: 0.2,
//                             bevelSegments: 16,  // Minimal segments to reduce seams
//                             curveSegments: 64
//                         }
//                     ]}
//                 />
//                 <meshStandardMaterial
//                     {...leatherTexture}
//                     color="#1d1d1d"
//                     roughness={0.5} // Fully matte
//                     // flatShading
//                     metalness={0.0}
//                     normalScale={new Vector2(1.5, 1.5)} // Slightly reduced normal scale
//                     displacementScale={0.001}
//                 />
//             </mesh>

//             {/* Felt */}
//             <mesh position={[0, 0, 0.05]} receiveShadow>
//                 <shapeGeometry args={[feltShape, 64]} />
//                 <meshStandardMaterial
//                     {...linenTexture}
//                     color="#064d1b"
//                     roughness={0.6}
//                     metalness={0}
//                     normalScale={new Vector2(1, 1)}
//                     displacementScale={0}
//                 />
//             </mesh>

//             {/* Betting Line */}
//             {/* <Line
//                 points={linePoints}
//                 color="rgba(255,255,255,0.2)"
//                 lineWidth={2}
//                 dashed
//                 dashScale={20}
//                 dashSize={0.5}
//                 gapSize={0.5}
//                 position={[0, 0, 0.005]} // Relative to group (which is rotated) -> actually Line is 3D, so z is up in local space
//             /> */}

//             {/* Logo Group */}
//             <group position={[0, 0, 0.06]} rotation={[0, 0, 0]}>
//                 {/* Center Circles */}
//                 <mesh receiveShadow>
//                     <ringGeometry args={[1.8, 1.85, 64]} />
//                     <meshStandardMaterial color="#bf953f" opacity={0.5} transparent roughness={0.8} metalness={0.6} />
//                 </mesh>
//                 <mesh receiveShadow>
//                     <ringGeometry args={[1.7, 1.72, 64]} />
//                     <meshStandardMaterial color="#bf953f" opacity={0.3} transparent roughness={0.8} metalness={0.6} />
//                 </mesh>

//                 {/* Text */}
//                 <Text
//                     position={[0, 0.2, 0]}
//                     fontSize={0.6}
//                     // font="/fonts/Inter-Bold.woff" // Assuming this exists or falls back
//                     anchorX="center"
//                     anchorY="middle"
//                     letterSpacing={0.1}
//                 >
//                     ABSOLUTE
//                     <meshStandardMaterial color="#bf953f" roughness={0.8} metalness={0} />
//                 </Text>
//                 <Text
//                     position={[0, -0.4, 0]}
//                     fontSize={0.25}
//                     anchorX="center"
//                     anchorY="middle"
//                     letterSpacing={0.3}
//                 >
//                     CASINO
//                     <meshStandardMaterial color="#bf953f" roughness={0.8} metalness={0} />
//                 </Text>

//                 {/* Suits */}
//                 <group position={[0, -0.8, 0]}>
//                     <Text position={[-0.6, 0, 0]} fontSize={0.3}>
//                         ♠
//                         <meshStandardMaterial color="#bf953f" opacity={0.4} transparent roughness={0.8} metalness={0} />
//                     </Text>
//                     <Text position={[-0.2, 0, 0]} fontSize={0.3}>
//                         ♥
//                         <meshStandardMaterial color="#bf953f" opacity={0.4} transparent roughness={0.8} metalness={0} />
//                     </Text>
//                     <Text position={[0.2, 0, 0]} fontSize={0.3}>
//                         ♣
//                         <meshStandardMaterial color="#bf953f" opacity={0.4} transparent roughness={0.8} metalness={0} />
//                     </Text>
//                     <Text position={[0.6, 0, 0]} fontSize={0.3}>
//                         ♦
//                         <meshStandardMaterial color="#bf953f" opacity={0.4} transparent roughness={0.8} metalness={0} />
//                     </Text>
//                 </group>
//             </group>

//             {/* Bottom Cover */}
//             <mesh position={[0, 0, -0.05]}>
//                 <shapeGeometry args={[railShape]} />
//                 <meshStandardMaterial color="#1a0f08" />
//             </mesh>
//         </group>
//     );
// };

// export default Table;
