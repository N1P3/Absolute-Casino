import watermelon from "@/assets/fruitogedon/Arbuz.png";
import lemon from "@/assets/fruitogedon/Cytryna.png";
import orange from "@/assets/fruitogedon/Pomarańcz.png";
import strawberry from "@/assets/fruitogedon/Truskawka.png";
import grapes from "@/assets/fruitogedon/Winogrona.png";
import wild from "@/assets/fruitogedon/Wild.png";
import cherry from "@/assets/fruitogedon/wisnie.png";
import { Assets } from "pixi.js";

export const getTextures = async () => {
  return await Assets.load([cherry, lemon, orange, strawberry, grapes, watermelon, wild]);
};
