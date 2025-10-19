import React from "react";
import slotThumbnail from "./assets/thumbnail.jpg?url";
import mummyThumbnail from "./assets/mummy/thumbnail.png?url";
import blackjackThumbnail from "./assets/blackjack/thumbnail2.png?url";
import fruitogedonThumbnail from "./assets/fruitogedon/thumbnail.png?url";
import baccaratThumbnail from "./assets/baccarat/thumbnail.jpg?url";
import { GameConfig, GameType } from "./types";
import Fruitogedon from "./games/Fruitogedon/Fruitogedon";
import Baccarat from "./games/Baccarat/Baccarat";

const Mummy = React.lazy(() => import("./games/Mummy/Mummy"));
const Blackjack = React.lazy(() => import("./games/Blackjack/Blackjack"));

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
