import React from "react";
import slotThumbnail from "./assets/thumbnail.jpg?url";
import mummyThumbnail from "./assets/mummy/thumbnail.png?url";
import blackjackThumbnail from "./assets/blackjack/thumbnail2.png?url";
import fruitogedonThumbnail from "./assets/fruitogedon/thumbnail.png?url";
import baccaratThumbnail from "./assets/baccarat/thumbnail.jpg?url";
import makaoThumbnail from "./assets/makao/thumbnail.png?url";
import holdemThumbnail from "./assets/holdem/thumbnail_holdem.png?url";
import { GameConfig, GameType } from "./types";
import Fruitogedon from "./games/Fruitogedon/Fruitogedon";
import Baccarat from "./games/Baccarat/Baccarat";

const Mummy = React.lazy(() => import("./games/Mummy/Mummy"));
const Blackjack = React.lazy(() => import("./games/Blackjack/Blackjack"));
const Makao = React.lazy(() => import("./games/Makao/Makao"));
const Holdem = React.lazy(() => import("./games/Holdem/Holdem"));

export const config = [
  {
    gameId: "mummy",
    thumbnail: mummyThumbnail,
    component: Mummy,
    name: "Mummy",
    type: GameType.SLOT,
  },
  {
    gameId: "fruitogedon",
    thumbnail: fruitogedonThumbnail,
    component: Fruitogedon,
    name: "Fruitogedon",
    type: GameType.SLOT,
  },
  {
    gameId: "blackjack",
    thumbnail: blackjackThumbnail,
    component: Blackjack,
    name: "Blackjack",
    type: GameType.CARD,
  },
  {
    gameId: "baccarat",
    thumbnail: baccaratThumbnail,
    component: Baccarat,
    name: "Baccarat",
    type: GameType.CARD,
  },
  {
    gameId: "makao",
    thumbnail: makaoThumbnail,
    component: Makao,
    name: "Makao",
    type: GameType.CARD,
  },
  {
    gameId: "holdem",
    thumbnail: holdemThumbnail,
    component: Holdem,
    name: "Texas Hold'em",
    type: GameType.CARD,
  },
] as GameConfig[];

// enum BonusType {
//   NONE = 0,
//   FREE_SPINS = 1,
// }

// const symbols = [
//   {
//     id: 1,
//     name: "M",
//     image: "MSymbol.png",
//   },
//   {
//     id: 2,
//     name: "U",
//     image: "USymbol.png",
//   },
//   {
//     id: 3,
//     name: "Y",
//     image: "YSymbol.png",
//   },
// ];

// const gameResult = {
//   symbols: [
//     [1, 1, 2, 2, 3],
//     [2, 2, 2, 3, 3],
//     [3, 3, 3, 1, 1],
//   ],
//   winningLines: [1, 2, 3],
//   winAmount: 100,
//   bonus: BonusType.NONE,
// };
