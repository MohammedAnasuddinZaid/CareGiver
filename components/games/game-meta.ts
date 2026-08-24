import {
  Drum,
  Eye,
  Footprints,
  Images,
  IndianRupee,
  Layers,
  LayoutGrid,
  Music,
  Palette,
  Search,
  ShoppingBasket,
  Sun,
} from "lucide-react";
import type { GameId } from "@/lib/games/types";

/** Shared icon mapping so play hub and host route stay consistent. */
export const GAME_ICONS: Record<GameId, React.ComponentType<{ className?: string }>> = {
  faces: Images,
  market: ShoppingBasket,
  pairs: LayoutGrid,
  melody: Music,
  drums: Drum,
  stroop: Palette,
  trail: Footprints,
  routine: Sun,
  loom: Layers,
  oddone: Search,
  bazaar: IndianRupee,
  spatial: Eye,
};

export const GAME_ROUTES: Record<GameId, string> = {
  faces: "/play/faces",
  market: "/play/market",
  pairs: "/play/pairs",
  melody: "/play/melody",
  drums: "/play/drums",
  stroop: "/play/stroop",
  trail: "/play/trail",
  routine: "/play/routine",
  loom: "/play/loom",
  oddone: "/play/oddone",
  bazaar: "/play/bazaar",
  spatial: "/play/spatial",
};

export const GAME_TITLES: Record<GameId, string> = {
  faces: "Who Is In The Photo?",
  market: "Market Basket",
  pairs: "Card Pairs",
  melody: "Repeat the Tune",
  drums: "Festival Drums",
  stroop: "Color Trap",
  trail: "Number Trail",
  routine: "Morning Routine",
  loom: "Pattern Loom",
  oddone: "Odd One Out",
  bazaar: "Bazaar Maths",
  spatial: "Where Did I Keep It?",
};

export interface GameCategory {
  id: "remember" | "focus" | "think" | "find";
  /** Locale phrase key for the category heading. */
  titleKey: "catRemember" | "catFocus" | "catThink" | "catFind";
  blurb: string;
}

/** Hub sections, in display order. */
export const GAME_CATEGORIES: readonly GameCategory[] = [
  { id: "remember", titleKey: "catRemember", blurb: "Faces, lists and tunes held in mind" },
  { id: "focus", titleKey: "catFocus", blurb: "Attention, speed and steady hands" },
  { id: "think", titleKey: "catThink", blurb: "Ordering, patterns and everyday thinking" },
  { id: "find", titleKey: "catFind", blurb: "Locations and visual memory" },
];
