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

// Calculate the world position and rotation for cards dealt to a player at `seatPosition`,
// so that the cards are slightly moved toward the table center and rotated to face it.
export const calculateHandPosition = (
  seatPosition: Coord,
  tableCenter: Coord,
  cardIndex: number,
  totalCards: number,
  faceDown?: boolean
): PositionAndRotation => {
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

  // Spacing between cards
  const spacing = 1; 
  
  // Calculate offset for this specific card to center the hand
  const totalWidth = (totalCards - 1) * spacing;
  const startOffset = -totalWidth / 2;
  const currentOffset = startOffset + cardIndex * spacing;

  const basePos: Coord = [
    seatPosition[0] + perpX * currentOffset,
    0, // Height will be adjusted by moveTowardsCenter or caller
    seatPosition[2] + perpZ * currentOffset
  ];

  const worldPos = moveTowardsCenter(basePos, tableCenter, 1.5);

  // Calculate angle to face center
  const angle = Math.atan2(tableCenter[0] - worldPos[0], tableCenter[2] - worldPos[2]);

  return {
    positon: worldPos,
    rotation: [((faceDown ? 1 : -1) * Math.PI) / 2, 0, angle],
  };
};
