import { useLoader } from "@react-three/fiber";
import { TextureLoader, Texture } from "three";
import { CardKey } from "../../shared";

const suits = ["H", "D", "C", "S"] as const;
const values = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;

// We need to preload these imports to get the URLs
const cardUrls: Record<string, string> = {};

// This is a bit of a hack to get all imports working with Vite's glob import if possible, 
// but since the original used dynamic imports in a loop, we might need to do the same or use a glob.
// For now, let's try to map them similarly but we can't use await in top level easily for the hook.
// Actually, useLoader can take an array of urls.

// Let's use a glob import to get all card SVG URLs
const cardModules = import.meta.glob('@/assets/cards/*.svg', { eager: true, query: '?url', import: 'default' });

export const useCardTextures = () => {
  const textures: Record<CardKey, Texture> = {} as Record<CardKey, Texture>;
  
  // Construct the list of keys and URLs to load
  const keys: CardKey[] = [];
  const urls: string[] = [];

  for (const suit of suits) {
    for (const value of values) {
      const key = `${value.toUpperCase()}${suit}` as CardKey;
      // The glob keys are like "/src/assets/cards/2H.svg"
      // We need to find the matching module.
      // Assuming the structure is consistent.
      const moduleKey = Object.keys(cardModules).find(k => k.includes(`/${key}.svg`));
      if (moduleKey) {
        keys.push(key);
        urls.push(cardModules[moduleKey] as string);
      }
    }
  }

  // Backs
  const bbKey = Object.keys(cardModules).find(k => k.includes(`/1B.svg`));
  if (bbKey) {
    keys.push("BB");
    urls.push(cardModules[bbKey] as string);
  }
  
  const brKey = Object.keys(cardModules).find(k => k.includes(`/2B.svg`));
  if (brKey) {
    keys.push("BR");
    urls.push(cardModules[brKey] as string);
  }

  const loadedTextures = useLoader(TextureLoader, urls);

  keys.forEach((key, index) => {
    textures[key] = loadedTextures[index];
    // Fix for SVGs loaded as textures sometimes needing flipY false or encoding changes
    textures[key].colorSpace = "srgb"; 
  });

  return textures;
};
