import bg from "@/assets/mummy/tlo.png?url";
import m from "@/assets/mummy/M_trans.png";
import u from "@/assets/mummy/U_trans.png";
import y from "@/assets/mummy/Y_trans.png";
import gold from "@/assets/mummy/ZlotaMumia.jpg";
import mumia1 from "@/assets/mummy/mumia1.png";
import mumia2 from "@/assets/mummy/mumia2.png";
import mumia3 from "@/assets/mummy/mumia3.png";
import { Assets } from "pixi.js";

export const getTextures = async () => {
  return await Assets.load([m, u, y, mumia1, mumia2, mumia3, gold]);
};

export enum Symbol {
  M = 0,
  U = 1,
  Y = 2,
  MUMIA1 = 3,
  MUMIA2 = 4,
  MUMIA3 = 5,
  GOLD = 6,
}

export type SymbolTexture = {
  [key in Symbol]: string;
};
