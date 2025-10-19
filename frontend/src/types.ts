export type GameConfig = {
  gameId: string;
  name: string;
  thumbnail: string;
  component: React.LazyExoticComponent<any>;
  type: GameType;
};

export enum GameType {
  SLOT,
  CARD,
}
