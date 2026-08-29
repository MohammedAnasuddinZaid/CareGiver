import { GAME_TITLES } from "@/components/games/game-meta";
import { GAME_META, type GameId } from "@/lib/games/types";
import type { AIProfile } from "./store";

export type CompanionTone =
  | "greet"
  | "empathize"
  | "calm"
  | "coach"
  | "suggest"
  | "celebrate"
  | "chat";

export interface CompanionReply {
  text: string;
  tone: CompanionTone;
  /** Tap-to-send suggested follow-ups. */
  quick?: string[];
  /** A game we think would help right now (for a quick link). */
  suggestGame?: GameId;
}

export interface CompanionInput {
  /** What the person typed, if anything. */
  message?: string;
  /** Current route, e.g. "/play/faces". */
  route?: string;
  /** Recent game outcome, surfaced by the in-game coach. */
  lastOutcome?: "win" | "miss" | "streak";
}

/** A small learning patch the component folds back into the profile. */
export interface LearningPatch {
  name?: string | null;
  mood?: number;
  struggles?: Record<string, number>;
  loves?: Record<string, number>;
  notes?: string[];
  turns?: number;
}

const INTENTS: Record<string, string[]> = {
  greeting: ["hi", "hello", "hey", "good morning", "good evening", "namaste", "hare"],
  sad: ["sad", "lonely", "alone", "tired", "upset", "cry", "depressed", "low", "blue", "down"],
  anxious: ["worried", "anxious", "scared", "afraid", "nervous", "stress", "panic"],
  forgetful: ["forget", "forgot", "memory", "remember", "confused", "lost", "blank"],
  frustrated: ["hard", "difficult", "can't", "cant", "cannot", "struggle", "frustrated", "annoying", "hate", "stuck"],
  askHelp: ["help", "how", "what", "why", "suggest", "tip", "advice", "guide", "do i"],
  gratitude: ["thanks", "thank you", "appreciate", "grateful", "cheers"],
  compliment: ["love", "like", "great", "good", "nice", "wonderful", "amazing", "happy", "enjoy", "fun"],
  bye: ["bye", "goodnight", "good night", "see you", "take care"],
};

const DOMAIN_WORDS: Record<string, string> = {
  memory: "memory",
  working: "attention",
  attention: "focus",
  executive: "planning",
  spatial: "where",
};

function scoreIntents(text: string): { intent: string; score: number } {
  const lower = ` ${text.toLowerCase()} `;
  let best = "chat";
  let bestScore = 0;
  for (const [intent, words] of Object.entries(INTENTS)) {
    let s = 0;
    for (const w of words) {
      if (lower.includes(` ${w}`) || lower.includes(w)) s += 1;
    }
    if (s > bestScore) {
      bestScore = s;
      best = intent;
    }
  }
  return { intent: best, score: bestScore };
}

/** Map free text to a known game id by title or domain keyword. */
function matchGame(text: string): GameId | null {
  const lower = text.toLowerCase();
  for (const id of Object.keys(GAME_TITLES) as GameId[]) {
    if (lower.includes(GAME_TITLES[id].toLowerCase())) return id;
  }
  for (const id of Object.keys(GAME_META) as GameId[]) {
    const meta = GAME_META[id];
    const words = [meta.domain, ...meta.secondaryDomains, id];
    if (words.some((w) => lower.includes(w))) return id;
  }
  return null;
}

function topKey(rec: Record<string, number>): string | null {
  let best: string | null = null;
  let bestV = 0;
  for (const [k, v] of Object.entries(rec)) {
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  }
  return best;
}

function gameFromKey(key: string | null): GameId | null {
  if (!key) return null;
  if (key in GAME_TITLES) return key as GameId;
  // domain key -> first game of that domain
  for (const id of Object.keys(GAME_META) as GameId[]) {
    if (GAME_META[id].domain === key) return id;
  }
  return null;
}

function nameCallout(profile: AIProfile): string {
  return profile.name ? `, ${profile.name}` : "";
}

/**
 * The on-device companion "brain". No network, no model download — a compact,
 * explainable intent + affect model that reflects back warmth and offers a
 * concrete, personalised next step drawn from the person's own history.
 */
export function respond(
  input: CompanionInput,
  profile: AIProfile,
): { reply: CompanionReply; patch: LearningPatch } {
  const patch: LearningPatch = { turns: profile.turns + 1 };
  const lower = (input.message ?? "").toLowerCase();
  const mentioned = input.message ? matchGame(input.message) : null;

  // --- Contextual opening (no typed message) ---
  if (!input.message || input.message.trim().length === 0) {
    return { reply: routeTip(input.route, profile, input.lastOutcome), patch };
  }

  const { intent } = scoreIntents(input.message);

  // Learn from what they said.
  if (mentioned) {
    if (intent === "frustrated" || intent === "forgetful" || intent === "anxious") {
      patch.struggles = { [mentioned]: 1 };
    } else if (intent === "compliment") {
      patch.loves = { [mentioned]: 1 };
    }
  }
  if (intent === "sad" || intent === "anxious") patch.mood = profile.mood - 0.25;
  if (intent === "compliment" || intent === "gratitude") patch.mood = profile.mood + 0.2;
  if (intent === "greeting" && /call me (\w+)/.test(lower)) {
    const m = lower.match(/call me (\w+)/);
    if (m) patch.name = m[1][0].toUpperCase() + m[1].slice(1);
  }
  patch.notes = [input.message.slice(0, 140)];

  const suggested = gameFromKey(topKey(profile.struggles)) ?? mentioned ?? null;
  const loved = gameFromKey(topKey(profile.loves));

  switch (intent) {
    case "greeting": {
      const tail = suggested
        ? ` Want to try ${GAME_TITLES[suggested]} together?`
        : ` What would you like to do today?`;
      return {
        reply: {
          text: `Hello${nameCallout(profile)}! I'm right here with you.${tail}`,
          tone: "greet",
          quick: ["I'm a bit forgetful today", "Something fun please", "Tell me about the games"],
          suggestGame: suggested ?? undefined,
        },
        patch,
      };
    }
    case "sad": {
      const tail = loved
        ? ` How about ${GAME_TITLES[loved]}? You said you enjoy it.`
        : ` A gentle game like ${GAME_TITLES.faces} can lift the moment — no pressure.`;
      return {
        reply: {
          text: `I hear you${nameCallout(profile)}, and you're not alone — I'm sitting right here with you.${tail}`,
          tone: "empathize",
          quick: ["I feel a little better", "Tell me something nice", "Let's play"],
          suggestGame: loved ?? "faces",
        },
        patch,
      };
    }
    case "anxious": {
      return {
        reply: {
          text: `That's okay — let's slow down together. Take one calm breath. When you're ready, a short, easy round can settle the mind.`,
          tone: "calm",
          quick: ["I'm ready now", "Stay with me", "Make it easy"],
          suggestGame: "reaction",
        },
        patch,
      };
    }
    case "forgetful": {
      const g = suggested ?? "names";
      return {
        reply: {
          text: `Forgetting things is completely normal — these games are here to keep you company, never to test you. ${GAME_TITLES[g as GameId]} is a kind place to start; small steps, no rush.`,
          tone: "coach",
          quick: ["Start easy", "Remind me how it works", "I'll try"],
          suggestGame: g as GameId,
        },
        patch,
      };
    }
    case "frustrated": {
      const g = suggested ?? mentioned ?? "pairs";
      return {
        reply: {
          text: `I get it — that can feel annoying. Let's make it gentler: try ${GAME_TITLES[g as GameId]} on Easy, and just enjoy the moment. There are no wrong moves here.`,
          tone: "coach",
          quick: ["Make it easier", "I'll try again", "Something else"],
          suggestGame: g as GameId,
        },
        patch,
      };
    }
    case "askHelp": {
      if (mentioned) {
        const meta = GAME_META[mentioned];
        return {
          reply: {
            text: `${GAME_TITLES[mentioned]} builds your ${meta.domain} gently. Go at your own pace — and if a round feels long, it's fine to stop. Want me to open it on Easy?`,
            tone: "suggest",
            quick: ["Open on easy", "How do I get better?", "Not now"],
            suggestGame: mentioned,
          },
          patch,
        };
      }
      return {
        reply: {
          text: `Of course${nameCallout(profile)}. Tell me what's on your mind — a game, a memory, or just to talk. I'll find the kindest next step for you.`,
          tone: "suggest",
          quick: ["I forget names", "Help me relax", "What should I play?"],
        },
        patch,
      };
    }
    case "gratitude": {
      return {
        reply: {
          text: `That means a lot${nameCallout(profile)}. I'm happy to be here with you, always. 💚`,
          tone: "celebrate",
          quick: ["Let's play something", "Tell me a tip"],
        },
        patch,
      };
    }
    case "compliment": {
      const g = loved ?? mentioned ?? "memorylane";
      return {
        reply: {
          text: `I'm so glad${nameCallout(profile)}! That warmth is good for the brain. Let's keep that feeling going with ${GAME_TITLES[g as GameId]}.`,
          tone: "celebrate",
          quick: ["Let's go", "Tell me more", "I feel happy"],
          suggestGame: g as GameId,
        },
        patch,
      };
    }
    case "bye": {
      return {
        reply: {
          text: `Take good care${nameCallout(profile)}. I'll be right here whenever you come back. 💚`,
          tone: "greet",
          quick: ["See you soon"],
        },
        patch,
      };
    }
    default: {
      const tail = suggested
        ? ` Lately ${GAME_TITLES[suggested]} seemed tricky — want to try it the easy way?`
        : ` I'm listening.`;
      return {
        reply: {
          text: `I'm listening${nameCallout(profile)}.${tail}`,
          tone: "chat",
          quick: ["I'm a bit forgetful", "Something fun", "Help me relax"],
          suggestGame: suggested ?? undefined,
        },
        patch,
      };
    }
  }
}

/** Proactive, page-aware tip shown when the companion first opens. */
export function routeTip(
  route: string | undefined,
  profile: AIProfile,
  lastOutcome?: "win" | "miss" | "streak",
): CompanionReply {
  if (lastOutcome === "streak") {
    return {
      text: `You're on a lovely roll right now — enjoy it! I'm proud of you. 💚`,
      tone: "celebrate",
      quick: ["Keep going", "Tell me a tip"],
    };
  }
  if (lastOutcome === "miss") {
    return {
      text: `No worry about that miss — every try helps. Take a breath, and let's try the next one together.`,
      tone: "coach",
      quick: ["I'm okay", "Make it easier", "A kind word?"],
    };
  }
  const path = route ?? "/";
  if (path.startsWith("/play/")) {
    const id = path.split("/play/")[1].split("?")[0] as GameId;
    const title = GAME_TITLES[id];
    if (title) {
      return {
        text: `Playing ${title}? I'll quietly cheer you on. If it feels hard, just say the word and I'll suggest an easier step.`,
        tone: "coach",
        quick: ["Make it easier", "I'm stuck", "A tip please"],
        suggestGame: id,
      };
    }
  }
  if (path.startsWith("/play")) {
    return {
      text: `This is your games garden. The AI picks a small daily plan up top — but you can play anything. What feels good today?`,
      tone: "suggest",
      quick: ["What should I play?", "Something easy", "I'm forgetful"],
    };
  }
  if (path.startsWith("/caregiver") || path.startsWith("/recognition")) {
    return {
      text: `Companion Mode learns faces privately on this device. Add a few photos in good light and it gets gentler and quicker.`,
      tone: "suggest",
      quick: ["How does it work?", "Add a person", "Privacy?"],
    };
  }
  if (path.startsWith("/analytics")) {
    return {
      text: `Your progress stays here on this device. Even small, steady steps are wins — I'll help you notice them.`,
      tone: "coach",
      quick: ["What should I improve?", "Celebrate me", "Tips"],
    };
  }
  if (path.startsWith("/reminders")) {
    return {
      text: `Gentle reminders can ease the day. Want help wording one so it feels kind, not bossy?`,
      tone: "suggest",
      quick: ["Add a reminder", "Make it gentle", "How?"],
    };
  }
  return {
    text: `Hi${nameCallout(profile)}! I'm your companion — I listen, learn what helps you, and stay by your side. Ask me anything, or just talk.`,
    tone: "greet",
    quick: ["What can you do?", "I'm a bit forgetful", "Something fun"],
  };
}
