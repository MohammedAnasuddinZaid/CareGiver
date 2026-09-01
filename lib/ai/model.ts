import { GAME_TITLES } from "@/components/games/game-meta";
import { GAME_META, type GameId } from "@/lib/games/types";
import { bestDoc, TOPIC_QUESTIONS } from "./knowledge";
import type { AIProfile } from "./store";
import type { DeviceContext } from "./context";

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
  for (const id of Object.keys(GAME_META) as GameId[]) {
    if (GAME_META[id].domain === key) return id;
  }
  return null;
}

function cap(word: string): string {
  return word[0].toUpperCase() + word.slice(1);
}

function nameCallout(profile: AIProfile): string {
  return profile.name ? `, ${profile.name}` : "";
}

/**
 * Builds an accurate answer for "my …" questions from the live device
 * context. Returns null when the context isn't ready (so the caller falls
 * back to the static knowledge-base reply).
 */
function personalAnswer(
  kind: "people" | "reminders" | "progress" | "plan" | "reports" | "suggest",
  ctx: DeviceContext,
): string | null {
  if (!ctx.ready) return null;

  if (kind === "people") {
    const p = ctx.people;
    if (p.total === 0) {
      return "You haven't added anyone to People yet. When you add a few clear photos of family or friends, Companion Mode can recognise them and say their name.";
    }
    const nameList =
      p.names.length > 0 ? ` I know ${p.names.join(", ")}${p.names.length > 1 ? "" : ""}.` : "";
    const recognizedNote =
      p.recognized < p.total
        ? ` ${p.total - p.recognized} of them ${p.total - p.recognized === 1 ? "doesn't" : "don't"} have photos yet, so I might not recognise ${
            p.total - p.recognized === 1 ? "them" : "those"
          } in Companion Mode just yet.`
        : "";
    return `You have ${p.total} ${p.total === 1 ? "person" : "people"} saved on this device.${nameList}${recognizedNote}`;
  }

  if (kind === "reminders") {
    const r = ctx.reminders;
    if (r.total === 0) {
      return "You don't have any reminders set yet. The Reminders page lets you set gentle prompts for medicine, meals, calls or walks — all kept on this device.";
    }
    const enabledNote =
      r.enabled < r.total
        ? ` ${r.total - r.enabled} of them ${r.total - r.enabled === 1 ? "is" : "are"} paused for now.`
        : "";
    const list =
      r.titles.length > 0 ? ` They are: ${r.titles.join(", ")}.` : "";
    const next =
      r.nextFew.length > 0
        ? ` Next up: ${r.nextFew.map((n) => `${n.title} (${n.time})`).join(", ")}.`
        : "";
    return `You have ${r.total} ${r.total === 1 ? "reminder" : "reminders"} on this device.${list}${next}${enabledNote}`;
  }

  if (kind === "progress") {
    const g = ctx.progress;
    if (g.totalSessions === 0) {
      return "You haven't played any games yet. The Games page has gentle exercises for memory, attention, thinking and finding — start on Easy whenever you like.";
    }
    const recent =
      g.recentGames.length > 0 ? ` Lately you've been playing ${g.recentGames.join(", ")}.` : "";
    return `You've played ${g.gamesPlayed} ${g.gamesPlayed === 1 ? "session" : "sessions"} across ${
      g.uniqueGames
    } ${g.uniqueGames === 1 ? "game" : "games"}, with ${g.totalTrials} ${g.totalTrials === 1 ? "turn" : "turns"} all stored privately here.${recent}`;
  }

  if (kind === "plan") {
    const rem = ctx.reminders;
    const sug = ctx.progress.suggestedGameIds;
    const parts: string[] = [];
    if (rem.nextFew.length > 0) {
      parts.push(
        `Here's a gentle plan for today: first, ${rem.nextFew
          .map((r) => `${r.title} at ${r.time}`)
          .join(", ")}.`,
      );
    } else if (rem.total > 0) {
      parts.push(
        `You have ${rem.total} ${rem.total === 1 ? "reminder" : "reminders"} on this device but nothing upcoming today, so the day is yours.`,
      );
    } else {
      parts.push(
        "Today is wide open — no reminders are set, so the time is yours to spend gently.",
      );
    }
    if (sug.length > 0) {
      const titles = sug.map((id) => GAME_TITLES[id] ?? id);
      parts.push(
        `For a few quiet minutes of exercise, I'd suggest ${titles.join(" or ")} on Easy.`,
      );
    } else {
      parts.push(
        "For a few quiet minutes of exercise, any game on Easy is a lovely start — Faces is always a warm choice.",
      );
    }
    parts.push("Short and steady beats long and rare — even five minutes nourishes the mind.");
    return parts.join(" ");
  }

  if (kind === "reports") {
    const g = ctx.progress;
    if (g.totalSessions === 0) {
      return "I don't have a report yet because there are no completed sessions to read. Play any game on Easy — even a couple of minutes — and I'll have something warm to report back to you.";
    }
    const s = (n: number) => (n === 1 ? "" : "s");
    const byGame =
      g.byGame.length > 0
        ? ` Your most-played: ${g.byGame
            .slice(0, 3)
            .map((b) => `${b.title} (${b.sessions}×)`)
            .join(", ")}.`
        : "";
    const strength = g.strengthDomain
      ? ` Your strongest area so far is ${g.strengthDomain}.`
      : "";
    return `Here's your report: ${g.gamesPlayed} session${s(g.gamesPlayed)} across ${
      g.uniqueGames
    } game${s(g.uniqueGames)} and ${g.totalTrials} turn${s(g.totalTrials)} in total — all kept privately here.${byGame}${strength} Remember: every choice is a step, and nothing here is judged.`;
  }

  if (kind === "suggest") {
    const sug = ctx.progress.suggestedGameIds;
    if (sug.length === 0) {
      return "Every game can help on Easy. Why not start with Faces — it keeps the names we love closest.";
    }
    const titles = sug.map((id) => GAME_TITLES[id] ?? id);
    return `Reading your sessions, I'd suggest ${titles.join(", ")} on Easy — ${
      sug.length === 1 ? "it" : "they"
    } touch the areas that have had the least practice lately. No hurry, no marks — just a gentle stretch.`;
  }

  return null;
}

/**
 * The on-device companion "brain". A compact, explainable intent + affect
 * model layered on top of a retrieval knowledge base: it answers real
 * questions about CareGiver (privacy, games, Companion Mode, reminders,
 * progress, settings) from a fixed, reviewed set — so it can never invent
 * facts or call a server — and it stays warm and personal the rest of the time.
 *
 * `ctx` carries the person's actual on-device data (people, reminders,
 * progress) so the companion can answer "my …" questions accurately.
 */
export function respond(
  input: CompanionInput,
  profile: AIProfile,
  ctx?: DeviceContext | null,
): { reply: CompanionReply; patch: LearningPatch } {
  const patch: LearningPatch = { turns: profile.turns + 1 };
  const lower = (input.message ?? "").toLowerCase();
  const mentioned = input.message ? matchGame(input.message) : null;
  const doc = input.message ? bestDoc(lower) : null;

  // --- Contextual opening (no typed message) ---
  if (!input.message || input.message.trim().length === 0) {
    return { reply: routeTip(input.route, profile, input.lastOutcome), patch };
  }

  // --- Personal-data questions answered from live on-device state. ---
  if (doc?.personal && ctx) {
    const personal = personalAnswer(doc.personal, ctx);
    if (personal) {
      return {
        reply: {
          text: personal,
          tone: doc.personal === "reports" ? "coach" : "suggest",
          quick: TOPIC_QUESTIONS.slice(0, 3),
          suggestGame:
            doc.personal === "people"
              ? "faces"
              : (ctx.progress.suggestedGameIds[0] ?? undefined),
        },
        patch,
      };
    }
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
  if (intent === "greeting") {
    const m = lower.match(/call me (\w+)/);
    if (m) patch.name = cap(m[1]);
  }
  patch.notes = [input.message.slice(0, 140)];

  const suggested = gameFromKey(topKey(profile.struggles)) ?? mentioned ?? doc?.suggest ?? null;
  const loved = gameFromKey(topKey(profile.loves));

  // --- Emotional intents: empathy first, then an answer if one fits. ---
  if (intent === "sad") {
    const ans = doc
      ? ` ${doc.answer}`
      : loved
        ? ` How about ${GAME_TITLES[loved]}? You said you enjoy it.`
        : ` A gentle game like ${GAME_TITLES.faces} can lift the moment — no pressure.`;
    return {
      reply: {
        text: `I hear you${nameCallout(profile)}, and you're not alone — I'm sitting right here with you.${ans}`,
        tone: "empathize",
        quick: ["I feel a little better", "Tell me something nice", "Let's play"],
        suggestGame: loved ?? doc?.suggest ?? "faces",
      },
      patch,
    };
  }
  if (intent === "anxious") {
    const ans = doc ? ` ${doc.answer}` : ` A short, easy round can settle the mind.`;
    return {
      reply: {
        text: `That's okay — let's slow down together. Take one calm breath.${ans}`,
        tone: "calm",
        quick: ["I'm ready now", "Stay with me", "Make it easy"],
        suggestGame: doc?.suggest ?? "reaction",
      },
      patch,
    };
  }
  if (intent === "greeting") {
    const tail = doc
      ? ` ${doc.answer}`
      : suggested
        ? ` Want to try ${GAME_TITLES[suggested]} together?`
        : ` What would you like to do today?`;
    return {
      reply: {
        text: `Hello${nameCallout(profile)}! I'm right here with you.${tail}`,
        tone: "greet",
        quick: doc ? TOPIC_QUESTIONS.slice(0, 3) : ["I'm a bit forgetful today", "Something fun please", "Tell me about CareGiver"],
        suggestGame: suggested ?? undefined,
      },
      patch,
    };
  }
  if (intent === "bye") {
    return {
      reply: {
        text: `Take good care${nameCallout(profile)}. I'll be right here whenever you come back. 💚`,
        tone: "greet",
        quick: ["See you soon"],
      },
      patch,
    };
  }
  if (intent === "gratitude") {
    return {
      reply: {
        text: `That means a lot${nameCallout(profile)}. I'm happy to be here with you, always. 💚`,
        tone: "celebrate",
        quick: ["Let's play something", "Tell me a tip"],
      },
      patch,
    };
  }
  if (intent === "compliment") {
    const g = loved ?? mentioned ?? "memorylane";
    return {
      reply: {
        text: `I'm so glad${nameCallout(profile)}! That warmth is good for the brain. Let's keep that feeling going with ${GAME_TITLES[g]}.`,
        tone: "celebrate",
        quick: ["Let's go", "Tell me more", "I feel happy"],
        suggestGame: g,
      },
      patch,
    };
  }

  // --- Question / help / unknown: answer from the knowledge base. ---
  if (doc) {
    const lead =
      intent === "frustrated"
        ? "I get it — that can feel annoying. "
        : intent === "forgetful"
          ? "Forgetting things is completely normal — these games are here to keep you company, never to test you. "
          : "";
    return {
      reply: {
        text: `${lead}${doc.answer}`,
        tone: doc.tone,
        quick: TOPIC_QUESTIONS.slice(0, 3),
        suggestGame: doc.suggest,
      },
      patch,
    };
  }

  if (intent === "askHelp") {
    return {
      reply: {
        text: `Of course${nameCallout(profile)}. I can tell you about privacy, the games, Companion Mode, reminders and your progress. What would you like to know?`,
        tone: "suggest",
        quick: TOPIC_QUESTIONS,
      },
      patch,
    };
  }

  // Fallback: listen, and offer real topics.
  const tail = suggested
    ? ` Lately ${GAME_TITLES[suggested]} seemed tricky — want to try it the easy way?`
    : "";
  return {
    reply: {
      text: `I'm listening${nameCallout(profile)}.${tail}`,
      tone: "chat",
      quick: TOPIC_QUESTIONS,
      suggestGame: suggested ?? undefined,
    },
    patch,
  };
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
      quick: TOPIC_QUESTIONS.slice(0, 3),
    };
  }
  if (lastOutcome === "miss") {
    return {
      text: `No worry about that miss — every try helps. Take a breath, and let's try the next one together.`,
      tone: "coach",
      quick: TOPIC_QUESTIONS.slice(0, 3),
    };
  }
  const path = route ?? "/";
  if (path.startsWith("/assistant")) {
    return {
      text: `Welcome to my home page. Ask me to plan your day, read your reports or suggest a game — or type any question about how CareGiver works.`,
      tone: "greet",
      quick: [
        "Plan my day",
        "Read my reports",
        "Suggest a game",
        "Is my data private?",
      ],
    };
  }
  if (path.startsWith("/play/")) {
    const id = path.split("/play/")[1].split("?")[0] as GameId;
    const title = GAME_TITLES[id];
    if (title) {
      return {
        text: `Playing ${title}? I'll quietly cheer you on. If it feels hard, just say the word and I'll suggest an easier step.`,
        tone: "coach",
        quick: TOPIC_QUESTIONS.slice(0, 3),
        suggestGame: id,
      };
    }
  }
  if (path.startsWith("/play")) {
    return {
      text: `This is your games garden. The AI picks a small daily plan up top — but you can play anything. What feels good today?`,
      tone: "suggest",
      quick: TOPIC_QUESTIONS,
    };
  }
  if (path.startsWith("/caregiver") || path.startsWith("/recognition")) {
    return {
      text: `Companion Mode learns faces privately on this device. Add a few photos in good light and it gets gentler and quicker.`,
      tone: "suggest",
      quick: TOPIC_QUESTIONS,
    };
  }
  if (path.startsWith("/analytics")) {
    return {
      text: `Your progress stays here on this device. Even small, steady steps are wins — I'll help you notice them.`,
      tone: "coach",
      quick: TOPIC_QUESTIONS,
    };
  }
  if (path.startsWith("/reminders")) {
    return {
      text: `Gentle reminders can ease the day. Want help wording one so it feels kind, not bossy?`,
      tone: "suggest",
      quick: TOPIC_QUESTIONS,
    };
  }
  if (path.startsWith("/settings")) {
    return {
      text: `Here you can make CareGiver calm and readable — light or dark, larger text, voice and the in-game coach. Ask me anything about a setting.`,
      tone: "suggest",
      quick: TOPIC_QUESTIONS,
    };
  }
  return {
    text: `Hi${nameCallout(profile)}! I'm your CareGiver companion — I listen, learn what helps you, and can answer questions about privacy, the games and more. Ask me anything.`,
    tone: "greet",
    quick: TOPIC_QUESTIONS,
  };
}
