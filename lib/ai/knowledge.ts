import { GAME_TITLES, GAME_CATEGORIES } from "@/components/games/game-meta";
import { GAME_META, type GameId } from "@/lib/games/types";
import type { CompanionTone } from "./model";

export interface KBDoc {
  id: string;
  /** Lowercased phrases that signal this answer is relevant. */
  keywords: string[];
  /** Static answer text (used directly, or as the fallback when no live
   *  personal data answers a "my …" question). */
  answer: string;
  tone: CompanionTone;
  suggest?: GameId;
  /** When set, this doc is answered from live on-device data instead of the
   *  static `answer`. The answer string serves as a no-data fallback. */
  personal?: "people" | "reminders" | "progress";
}

/**
 * Curated, on-device knowledge for the CareGiver companion. The chatbot is a
 * retrieval model over these entries — it only ever answers from this fixed,
 * reviewed set, so it can never invent facts or leak anything (there is no
 * network call). Everything here is accurate to the app's privacy-first design.
 */
const DOCS: KBDoc[] = [
  {
    id: "privacy",
    keywords: [
      "private",
      "privacy",
      "data",
      "upload",
      "cloud",
      "internet",
      "online",
      "safe",
      "secure",
      "shared",
      "track",
      "sell",
      "server",
      "leave",
      "stored",
      "store",
      "local",
      "device",
      "confidential",
    ],
    answer:
      "Everything stays on this device. CareGiver never uploads, tracks or shares anything — no photos, faces, scores or chats ever leave your phone or computer. Recognition runs locally, and you can export or erase all your data anytime in Settings.",
    tone: "suggest",
  },
  {
    id: "companion",
    keywords: [
      "companion",
      "recogni",
      "face",
      "faces",
      "who is",
      "identify",
      "identify",
      "enroll",
      "enrolled",
      "photo",
      "camera",
      "familiar",
      "know who",
    ],
    answer:
      "Companion Mode learns to recognise familiar faces privately on your device. Add a few clear, well-lit photos of each person, and it will gently say their name when they're near. Nothing is sent anywhere — it all runs offline, and you can forget a person whenever you like.",
    tone: "suggest",
    suggest: "faces",
  },
  {
    id: "enroll-tips",
    keywords: [
      "enroll",
      "enrolled",
      "add photo",
      "add a photo",
      "bad photo",
      "not recognising",
      "not recognizing",
      "wrong name",
      "improve recogni",
      "lighting",
    ],
    answer:
      "For the gentlest results: add 3–4 photos of each person in good, even light, facing the camera, with no sunglasses or heavy shadows. The more consistent the lighting, the quicker and steadier Companion Mode becomes.",
    tone: "coach",
  },
  {
    id: "games-overview",
    keywords: [
      "game",
      "games",
      "play",
      "exercise",
      "which game",
      "best game",
      "brain game",
      "what game",
      "mind games",
      "train my",
      "keep my mind",
    ],
    answer:
      "There are gentle games for every skill — memory (Names, Faces, Memory Lane), attention (Stroop, Festival Drums), executive (Bazaar Maths, Pattern Loom) and spatial (Where Did I Keep It?, Shadow Match). Start on Easy; short daily sessions help most.",
    tone: "suggest",
    suggest: "faces",
  },
  {
    id: "reminders",
    keywords: [
      "remind",
      "reminder",
      "alert",
      "forget to",
      "schedule",
      "medicine",
      "medication",
      "appointment",
      "take my",
      "pill",
    ],
    answer:
      "The Reminders page lets you set kind, gentle prompts — for medicine, meals, calls or walks. They stay on this device and can ping with a soft tone, so the day feels calmer.",
    tone: "suggest",
  },
  {
    id: "progress",
    keywords: [
      "progress",
      "analytics",
      "improve",
      "getting better",
      "score",
      "report",
      "trend",
      "stats",
      "how am i doing",
      "getting worse",
    ],
    answer:
      "Your Progress page shows gentle trends from the games you've played — all stored locally. Small, steady steps are real wins. You can also print or export a plain-language report for a doctor or family member.",
    tone: "coach",
  },
  {
    id: "settings",
    keywords: [
      "setting",
      "settings",
      "theme",
      "dark mode",
      "light mode",
      "voice",
      "sound",
      "language",
      "sensitivity",
      "large text",
      "contrast",
      "reduce motion",
    ],
    answer:
      "In Settings you can switch light/dark, turn voice or sound cues on or off, change the language, and make text larger or higher-contrast. You'll also find the switch to turn the in-game coach off if you'd rather play quietly.",
    tone: "suggest",
  },
  {
    id: "export-backup",
    keywords: [
      "export",
      "backup",
      "import",
      "save my data",
      "transfer",
      "move to another",
      "new phone",
    ],
    answer:
      "Settings → Export saves a private backup file to your own device. Import it on another device to bring people, photos and progress across. The file never touches our servers.",
    tone: "suggest",
  },
  {
    id: "voice",
    keywords: ["voice", "speak", "speaking", "read aloud", "announce", "speech"],
    answer:
      "Voice announcements are spoken by your own browser, on this device. Turn them on in Settings to hear a person's name when Companion Mode recognises them, or off for a quieter experience.",
    tone: "suggest",
  },
  {
    id: "accessibility",
    keywords: [
      "accessib",
      "hard to see",
      "bigger text",
      "can't read",
      "vision",
      "low vision",
      "keyboard",
    ],
    answer:
      "CareGiver is built to be calm and readable: large tap targets, high-contrast and large-text modes in Settings, and reduced-motion support. Tell me if anything is still hard to use.",
    tone: "coach",
  },
  {
    id: "offline",
    keywords: ["offline", "no internet", "without wifi", "disconnected", "not working online"],
    answer:
      "CareGiver works fully offline. Once loaded, games, recognition and reminders all run on your device — no internet needed. You can even install it to your home screen.",
    tone: "suggest",
  },
  {
    id: "about",
    keywords: [
      "about",
      "caregiver",
      "what is",
      "who are you",
      "company",
      "help",
      "purpose",
      "designed for",
      "carer",
      "dementia",
      "memory loss",
    ],
    answer:
      "CareGiver is a privacy-first companion for families living with memory loss. It offers gentle brain games, private face recognition, and kind reminders — made for people with memory impairment and the people who care for them. It's a prototype assistive tool, not a medical device.",
    tone: "greet",
  },
  {
    id: "how-to",
    keywords: [
      "how do i",
      "how to",
      "how can i",
      "start",
      "begin",
      "use",
      "guide",
      "tutorial",
      "get started",
      "where do i",
    ],
    answer:
      "A nice place to begin is the Games page — pick one that feels good and play on Easy. Add family in People so Companion Mode can learn them, and set a reminder or two. I'm here any time you'd like a nudge.",
    tone: "suggest",
    suggest: "faces",
  },
  // --- Personal, device-specific questions (answered from live data) ---
  {
    id: "my-people",
    keywords: [
      "how many people",
      "my people",
      "my family",
      "who do i know",
      "who is saved",
      "who have i added",
      "how many do i know",
      "my contacts",
      "people i saved",
      "who is enrolled",
      "list my people",
      "who's saved",
      "who are my people",
    ],
    personal: "people",
    answer:
      "You haven't added anyone to People yet. When you add a few photos of family or friends, Companion Mode can recognise them and say their name. Go to the People page to get started.",
    tone: "suggest",
    suggest: "faces",
  },
  {
    id: "my-reminders",
    keywords: [
      "my reminders",
      "list my reminders",
      "what reminders",
      "do i have any reminders",
      "my alerts",
      "what alerts",
      "my medicines",
      "my appointments",
      "what do i have scheduled",
      "my schedule",
      "show my reminders",
    ],
    personal: "reminders",
    answer:
      "You don't have any reminders set yet. The Reminders page lets you set gentle prompts for medicine, meals, calls or walks — all kept on this device.",
    tone: "suggest",
  },
  {
    id: "my-progress",
    keywords: [
      "my progress",
      "my games",
      "how many games",
      "what have i played",
      "games have i played",
      "my scores",
      "how am i doing",
      "my activity",
      "show my progress",
      "games played",
      "how much have i played",
      "my history",
    ],
    personal: "progress",
    answer:
      "You haven't played any games yet. The Games page has gentle exercises for memory, attention, thinking and finding — start on Easy whenever you like.",
    tone: "coach",
  },
  // --- More small-answer facts about the app ---
  {
    id: "what-games",
    keywords: [
      "how many games",
      "what games are there",
      "all the games",
      "list games",
      "game list",
      "how many",
    ],
    answer:
      "There are 28 gentle games across four areas: memory, focus, thinking and finding — covering faces, names, patterns, maths, music, colours, routines and more. Head to the Games page to browse them; most can be played on Easy, Moderate or Hard.",
    tone: "suggest",
    suggest: "faces",
  },
  {
    id: "what-people",
    keywords: ["people page", "what is people", "add a person", "add person", "new person", "add family"],
    answer:
      "The People page is where you keep the familiar people in your life — family, friends and caregivers — along with a few clear photos of each. Companion Mode uses those photos to recognise someone and gently say their name.",
    tone: "suggest",
    suggest: "faces",
  },
  {
    id: "why-games",
    keywords: [
      "why games",
      "why play",
      "do these help",
      "is this good for me",
      "does it work",
      "actually help",
      "any point",
      "why should i",
    ],
    answer:
      "These games are gentle, everyday exercises for the kinds of thinking we use all the time — remembering names, staying on task, planning a routine and finding things. There's no pass or fail; keeping your mind active in small, steady steps is what matters.",
    tone: "coach",
  },
];

// One doc per game, built from the registry (no manual drift).
for (const id of Object.keys(GAME_TITLES) as GameId[]) {
  const title = GAME_TITLES[id];
  const meta = GAME_META[id];
  const extras = meta.secondaryDomains.length ? ` and ${meta.secondaryDomains.join(", ")}` : "";
  DOCS.push({
    id: `game-${id}`,
    keywords: [title.toLowerCase(), id, meta.domain, `play ${id}`, ...meta.secondaryDomains],
    answer: `${title} is a gentle exercise that builds your ${meta.domain}${extras}. You can play it on Easy, Moderate or Hard — there's no wrong move, just practice.`,
    tone: "suggest",
    suggest: id,
  });
}

/** Categories help the chatbot point to the right shelf of games. */
export const CATEGORY_HINTS = GAME_CATEGORIES.map((c) => c.titleKey);

/** Example questions shown as tappable suggestions. */
export const TOPIC_QUESTIONS = [
  "Is my data private?",
  "How does Companion Mode work?",
  "Which game helps memory?",
  "How do reminders work?",
  "Tell me about CareGiver",
];

/**
 * Retrieve the best-matching knowledge entry for a message. Returns null when
 * nothing clears the bar, so the caller can fall back to empathetic listening.
 */
export function bestDoc(text: string): KBDoc | null {
  let best: KBDoc | null = null;
  let bestScore = 0;
  for (const doc of DOCS) {
    let score = 0;
    for (const kw of doc.keywords) {
      if (text.includes(kw)) {
        // Longer, more specific phrases are stronger signals.
        score += kw.length >= 6 ? 3 : kw.length >= 4 ? 2 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }
  return bestScore >= 2 ? best : null;
}
