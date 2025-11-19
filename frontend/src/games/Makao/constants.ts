// Pozycje jako proporcje wymiarów tła (0-1)
export const POSITIONS = {
  deck: { xRatio: 0.73, yRatio: 0.19 }, // Talia w prawym górnym obszarze
  table: { xRatio: 0.5, yRatio: 0.6 }, // Środek stołu
  playerHand: { xRatio: 0.1, yRatio: 0.52 }, // Dolna część ekranu dla gracza
  computerHand: { xRatio: 0.1, yRatio: 0.15 }, // Górny lewy róg dla przeciwnika
} as const;
