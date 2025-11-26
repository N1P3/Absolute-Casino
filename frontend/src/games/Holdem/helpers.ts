export const getRelativeCenter = (position: number): [number, number, number] => {
  if (position === 1 || position === 2) return [2.1, 0, 0];
  if (position === 4 || position === 5) return [-2.1, 0, 0];
  return [0, 0, 0];
};
