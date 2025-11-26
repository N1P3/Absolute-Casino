import { animated, useSpring, config } from "@react-spring/three";
import React from "react";
import * as THREE from "three";
import { Shape, Texture } from "three";
import { CardKey } from "../../shared";

interface CardProps {
  cardKey: CardKey;
  textures: Record<CardKey, Texture>;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  flipped?: boolean;
  fromPosition?: [number, number, number];
  fromRotation?: [number, number, number];
  delay?: number;
}

const Card: React.FC<CardProps> = ({ cardKey, textures, position, rotation = [0, 0, 0], scale = 1, flipped = false, fromPosition, fromRotation, delay = 0 }) => {
  const { springPosition, springRotation } = useSpring({
    from: {
      springPosition: fromPosition || [position[0], position[1] + 5, position[2]], // Default fly from sky
      springRotation: fromRotation || [rotation[0], rotation[1] + Math.PI * 4, rotation[2]], // Spin 2 times
    },
    to: {
      springPosition: position,
      springRotation: [rotation[0] + (flipped ? Math.PI : 0), rotation[1], rotation[2]],
    },
    delay,
    config: { mass: 1, tension: 170, friction: 26 },
  });

  // Card dimensions (standard poker card ratio 2.5 x 3.5)
  const width = 2.5 * scale;
  const height = 3.5 * scale;
  const radius = 0.15 * scale;

  const frontTexture = textures[cardKey];
  const backTexture = textures["BB"];

  // Create rounded rectangle shape
  const shape = React.useMemo(() => {
    const s = new Shape();
    const x = -width / 2;
    const y = -height / 2;
    s.moveTo(x + radius, y);
    s.lineTo(x + width - radius, y);
    s.quadraticCurveTo(x + width, y, x + width, y + radius);
    s.lineTo(x + width, y + height - radius);
    s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    s.lineTo(x + radius, y + height);
    s.quadraticCurveTo(x, y + height, x, y + height - radius);
    s.lineTo(x, y + radius);
    s.quadraticCurveTo(x, y, x + radius, y);
    return s;
  }, [width, height, radius]);

  // Create geometry with fixed UVs for texture mapping
  const faceGeometry = React.useMemo(() => {
    const g = new THREE.ShapeGeometry(shape);
    // Fix UVs to map 0..1 across the shape
    const pos = g.attributes.position;
    const uvs = g.attributes.uv;
    const padding = 0.01; // Crop 2% from edges to remove potential borders/transparency artifacts

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // Map x from [-width/2, width/2] to [0, 1]
      // Map y from [-height/2, height/2] to [0, 1]
      const u = (x + width / 2) / width;
      const v = (y + height / 2) / height;

      // Apply padding/crop
      uvs.setXY(i, padding + u * (1 - 2 * padding), padding + v * (1 - 2 * padding));
    }
    return g;
  }, [shape, width, height]);

  return (
    <animated.group position={springPosition as any} rotation={springRotation as any}>
      {/* Front Face */}
      <mesh position={[0, 0, 0.006]} geometry={faceGeometry} receiveShadow castShadow>
        <meshStandardMaterial
          map={frontTexture}
          transparent
          color="#cccccc" // Dimmed to prevent blowout
          roughness={0.1}
        />
      </mesh>

      {/* Back Face */}
      <mesh position={[0, 0, -0.006]} rotation={[0, Math.PI, 0]} geometry={faceGeometry} receiveShadow castShadow>
        <meshStandardMaterial
          map={backTexture}
          transparent
          color="#cccccc" // Dimmed to prevent blowout
          roughness={0.1}
        />
      </mesh>

      {/* Card Body (Thickness) */}
      <mesh position={[0, 0, -0.005]} receiveShadow castShadow>
        <extrudeGeometry args={[shape, { depth: 0.01, bevelEnabled: false, curveSegments: 16 }]} />
        <meshStandardMaterial color="#dddddd" roughness={0.1} />
      </mesh>
    </animated.group>
  );
};

export default Card;
