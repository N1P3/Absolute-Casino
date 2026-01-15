// ...existing code...
type Coord = [number, number, number];

type PositionAndRotation = {
  positon: Coord;
  rotation: Coord;
};

// Move the `pos` toward the table center by an absolute `distance` value (in world units).
// The function moves only on the XZ plane and preserves Y (height).
// If the requested distance is longer than the distance from `pos` to the center,
// the function will clamp the movement to the center so it does not overshoot.
export const moveTowardsCenter = (pos: Coord, center: Coord, distance: number) => {
  const [x, y, z] = pos;
  const [cx, cy, cz] = center;
  const dx = cx - x;
  const dz = cz - z;
  const len = Math.hypot(dx, dz);
  if (len === 0 || distance === 0) return pos;
  const move = Math.min(Math.abs(distance), len);
  const nx = dx / len;
  const nz = dz / len;
  return [x + nx * move, y, z + nz * move] as Coord;
};

// Calculate the world position and rotation for two cards dealt to a player at `seatPosition`,
// so that the cards are slightly moved toward the table center and rotated to face it.
export const calculateCardsPosition = (seatPosition: Coord, tableCenter: Coord, faceDown?: boolean): [PositionAndRotation, PositionAndRotation] => {
  // Compute direction from seat to center on XZ plane
  const dx = tableCenter[0] - seatPosition[0];
  const dz = tableCenter[2] - seatPosition[2];
  const dirLen = Math.hypot(dx, dz);

  // Normalized forward direction (toward center); fallback if seat == center
  const fx = dirLen === 0 ? 0 : dx / dirLen;
  const fz = dirLen === 0 ? 1 : dz / dirLen;

  // Perpendicular on XZ plane for lateral card spacing
  const perpX = -fz;
  const perpZ = fx;

  // Half-distance between the two card centers (keeps cards next to each other)
  const halfSeparation = 0.2; // adjust this value to increase/decrease spacing

  const leftBase: Coord = [seatPosition[0] + perpX * -halfSeparation, 0, seatPosition[2] + perpZ * -halfSeparation];
  const rightBase: Coord = [seatPosition[0] + perpX * halfSeparation, 0.01, seatPosition[2] + perpZ * halfSeparation];

  const leftWorld = moveTowardsCenter(leftBase, tableCenter, 1.5);
  const rightWorld = moveTowardsCenter(rightBase, tableCenter, 1.5);

  const leftAngle = Math.atan2(tableCenter[0] - leftWorld[0], tableCenter[2] - leftWorld[2]);
  const rightAngle = Math.atan2(tableCenter[0] - rightWorld[0], tableCenter[2] - rightWorld[2]);
  const avgAngle = (leftAngle + rightAngle) / 2 + Math.PI;

  return [
    {
      positon: leftWorld,
      rotation: [-Math.PI / 2, 0, avgAngle],
    },
    {
      positon: rightWorld,
      rotation: [-Math.PI / 2, 0, avgAngle],
    },
  ];
};
// ...existing code...
