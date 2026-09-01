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
  personal?: "people" | "reminders" | "progress" | "plan" | "reports" | "suggest" | "improving";
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
      "company",
      "purpose",
      "designed for",
      "carer",
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
    id: "plan-my-day",
    keywords: [
      "plan my day",
      "plan our day",
      "daily plan",
      "today's plan",
      "plan today",
      "what should i do today",
      "what to do today",
      "plan a day",
      "my day",
      "today's routine",
    ],
    personal: "plan",
    answer:
      "Here's a gentle shape for today: weave in a couple of short games (5–10 minutes on Easy) around any reminders you've set — medicine, meals, walks or calls. Small, steady steps are what nourish the mind.",
    tone: "suggest",
  },
  {
    id: "my-reports",
    keywords: [
      "read my reports",
      "my reports",
      "my report",
      "report",
      "summary of my",
      "progress report",
      "show my report",
      "tell me my report",
      "how did i do",
    ],
    personal: "reports",
    answer:
      "I don't have a report yet because there are no completed sessions to read. Play any game on Easy — even a couple of minutes — and I'll have something warm to report back to you.",
    tone: "coach",
  },
  {
    id: "suggest-game",
    keywords: [
      "suggest a game",
      "suggest",
      "recommend",
      "which game should i",
      "which game today",
      "what should i play",
      "pick a game",
      "good game for me",
      "what to play",
      "game for today",
    ],
    personal: "suggest",
    answer:
      "Today I'd suggest starting on Easy — the exact game depends on which area has had the least practice this week. Ask me to suggest a game and I'll read your recent sessions first.",
    tone: "suggest",
  },
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
  // --- Personal progress: is the person improving? (answered from live data) ---
  {
    id: "is-improving",
    keywords: [
      "am i improving",
      "am i getting better",
      "is my report good",
      "is my report ok",
      "am i doing good",
      "am i doing well",
      "improving",
      "getting better",
      "has my memory improved",
      "progress trend",
      "how is my progress",
      "improved",
    ],
    personal: "improving",
    answer:
      "I can't tell you yet — there are no completed sessions to read. Play any game on Easy a few times and I'll be able to look at your progress and give you a warm, honest answer.",
    tone: "coach",
  },
  // --- Gentle daily-life guidance (short, kind, non-medical) ---
  {
    id: "how-much-play",
    keywords: [
      "how long should i play",
      "how often should i play",
      "how many times a day",
      "how much time",
      "how many games a day",
      "how long is a game",
      "best time to play",
      "too much",
      "play every day",
    ],
    answer:
      "Short and steady wins: about 5–15 minutes on Easy, a couple of times a day, is plenty — like a gentle walk for the mind. Stop whenever you want; there's no quota to meet.",
    tone: "suggest",
    suggest: "faces",
  },
  {
    id: "caregiver-support",
    keywords: [
      "how can i help my",
      "how do i help my",
      "caregiver",
      "carer",
      "taking care of someone",
      "support my family",
      "help my mom",
      "help my dad",
      "help my mum",
      "help my wife",
      "help my husband",
      "help my grandmother",
      "caregiver tips",
      "look after myself",
      "burnout",
      "caring for someone",
    ],
    answer:
      "Being a carer is a labour of love, and your own wellbeing matters too. Small wins: sit and play one Easy game together, keep the person to familiar routines, speak slowly and warmly, and give yourself rest without guilt. You can't pour from an empty cup — take a few minutes for yourself each day.",
    tone: "empathize",
  },
  {
    id: "medical-disclaimer",
    keywords: [
      "does it cure",
      "is it a cure",
      "will it fix",
      "is it medicine",
      "medical",
      "replacement for a doctor",
      "stop dementia",
      "reverse memory loss",
      "fix my memory",
      "does this heal",
    ],
    answer:
      "CareGiver is a companion tool, not a medicine. It can't cure or stop a medical condition — it gently keeps the mind active and the days steadier. Please always lean on your doctor for diagnosis, medication and anything you're unsure about.",
    tone: "coach",
  },
  {
    id: "see-doctor",
    keywords: [
      "when to see a doctor",
      "should i see a doctor",
      "go to the doctor",
      "see a doctor",
      "talk to my doctor",
      "ask my doctor",
      "medical advice",
      "new symptoms",
    ],
    answer:
      "Sudden or worsening changes in memory, confusion, mood or falls deserve a doctor's call — that's a question for a professional, and sooner is kinder. If there's ever a risk of harm, don't wait: call emergency services.",
    tone: "coach",
  },
  {
    id: "no-account",
    keywords: [
      "need an account",
      "do i need to sign in",
      "sign in",
      "log in",
      "login",
      "sign up",
      "create an account",
      "upload my data",
      "cloud",
      "is my data uploaded",
    ],
    answer:
      "You don't need an account, sign-in or the internet. Everything — people, photos, reminders, and game history — is stored locally on your device. Nothing is uploaded unless you choose to share a backup yourself.",
    tone: "greet",
  },
  {
    id: "cost-free",
    keywords: ["how much does it cost", "is it free", "price", "subscription", "pay for", "payment", "cost"],
    answer:
      "It's free to use — no subscription, no hidden charges. It's a prototype built with care, and keeping it simple and private is the whole point.",
    tone: "greet",
  },
  {
    id: "updates-better",
    keywords: [
      "update",
      "will it get better",
      "new games coming",
      "new features",
      "changelog",
      "version",
      "new things",
    ],
    answer:
      "It keeps growing — new games, gentler reminders and better answers arrive over time, always staying private to your device. Your progress is kept safe through updates.",
    tone: "greet",
  },
  {
    id: "emergency",
    keywords: [
      "emergency",
      "crisis",
      "ambulance",
      "urgent",
      "danger",
      "call someone now",
      "help me now",
      "not safe",
      "hurt myself",
      "feel like hurting",
    ],
    answer:
      "Please take a slow breath. If you or someone with you is in danger right now, call your local emergency number and stay with them until help arrives. You deserve safety and support — don't face this alone.",
    tone: "calm",
  },
  {
    id: "sleep-rest",
    keywords: [
      "sleep",
      "can't sleep",
      "insomnia",
      "rest",
      "napping",
      "wake up",
      "night",
      "tired",
    ],
    answer:
      "Sleep is the quiet healer. Gentle rituals help: a calm wind-down, soft light, a warm drink, and keeping naps short and before evening. If poor sleep lingers, a word with your doctor is a kind step — you deserve good rest.",
    tone: "calm",
  },
  {
    id: "eat-well",
    keywords: ["food", "diet", "eat well", "nutrition", "healthy eating", "drink water", "hydrate", "meals", "cooking"],
    answer:
      "A kind plate helps: regular meals, plenty of water through the day, and colourful fruit and vegetables when you can. Small, enjoyable meals beat complicated plans — and meals shared with someone you love taste even better.",
    tone: "suggest",
  },
  {
    id: "stay-active",
    keywords: [
      "walk",
      "exercise",
      "stay active",
      "move my body",
      "activity",
      "gardening",
      "outdoors",
      "dance",
      "walking",
    ],
    answer:
      "Moving a little each day — a short walk, some gentle gardening or dancing to a favourite song — lifts the body and the mind together. Ten gentle minutes outside counts as a lovely win.",
    tone: "suggest",
  },
  {
    id: "social-note",
    keywords: [
      "talk to people",
      "make friends",
      "social",
      "community",
      "join a group",
      "talk to someone",
      "stay connected",
      "see family",
    ],
    answer:
      "Connection is medicine. A short call, a shared cup of tea, or a wave to a neighbour keeps us tethered to the world. You're never too old to start a gentle new friendship.",
    tone: "empathize",
  },
  {
    id: "what-is-dementia",
    keywords: [
      "what is dementia",
      "what's dementia",
      "alzheimer",
      "alzheimer's",
      "dementia",
      "early signs",
      "causes of dementia",
      "type of dementia",
    ],
    answer:
      "Dementia is an umbrella term for conditions that gradually affect memory, thinking and daily routines — Alzheimer's is the most common. It's not a normal part of ageing. Anyone with concerns should talk to a doctor early: right care and kindness make a real difference.",
    tone: "coach",
  },
  {
    id: "area-guide",
    keywords: [
      "which game helps",
      "which game is best for",
      "game for memory",
      "game for attention",
      "improve attention",
      "improve memory",
      "help with attention",
      "help with memory",
      "best game for my memory",
      "brain game",
      "train attention",
      "train memory",
      "game helps memory",
    ],
    answer:
      "Different games warm up different areas:\n• Memory — Who Is In The Photo?, Remembering Names, Memory Lane, Word Recall\n• Attention & focus — Festival Drums, Color Trap, Quick Tap, Spot the Change\n• Thinking & planning — Morning Routine, Bazaar Maths, Pattern Loom, Odd One Out\n• Holding things in mind — Market Basket, Card Pairs, Word Builder\n• Finding things — Where Did I Keep It?, Shadow Match, Follow the Lights\nStart on Easy and let the game meet you where you are.",
    tone: "suggest",
    suggest: "faces",
  },
  // --- Simple, everyday moments: presence before information ---
  {
    id: "i-feel",
    keywords: [
      "i am feeling",
      "i'm feeling",
      "im feeling",
      "i am feeling now",
      "how am i feeling",
      "feeling now",
      "not feeling well",
      "i feel so",
      "i feel really",
      "i feel lost",
      "i feel helpless",
    ],
    answer:
      "Thank you for telling me — that takes courage. Whatever feels heavy right now, you don't have to carry it alone. Sit with me for a moment: one slow breath in, and one slow breath out. Then a small, easy thing — a warm drink, a favourite song, or a gentle game — can soften the day. I'm right here with you.",
    tone: "empathize",
    suggest: "faces",
  },
  {
    id: "memory-lapse",
    keywords: [
      "i don't remember",
      "i dont remember",
      "i can't remember",
      "i cant remember",
      "cannot remember",
      "i keep forgetting",
      "i forgot",
      "keep forgetting",
      "forgetting things",
      "forget everything",
      "why am i forgetting",
      "my memory is",
      "everything is blank",
      "i have a blank",
      "forgot where i",
      "where did i put",
    ],
    answer:
      "That happens to everyone now and then — and when it does, the very best thing is not to fight it alone. Forgetting a word or a place doesn't mean you're losing ground; it means today is asking a lot of your mind. Let me be your gentle second memory: we can keep names and faces on this device, set kind reminders so the day writes itself, and play a short memory game like Names to keep the mind nimble. And whenever a worry lingers, a word with your doctor is a brave step too.",
    tone: "calm",
    suggest: "memorylane",
  },
  {
    id: "cheer-up",
    keywords: [
      "tell me something nice",
      "cheer me up",
      "make me feel better",
      "i need a smile",
      "something kind",
      "encourage me",
      "say something nice",
      "i'm having a hard day",
      "im having a hard day",
      "it's been a hard day",
      "its been a hard day",
      "i feel down today",
    ],
    answer:
      "Here's something true: you are braver and steadier than you feel right now. Look at the small victories around you — you reached out, you're caring for your mind, you showed up today. That is quietly powerful. If it helps, let's turn one small thing into a win together — a short gentle game, a favourite memory, or simply a slow breath. I'm glad you're here.",
    tone: "empathize",
    suggest: "faces",
  },
  {
    id: "who-are-you",
    keywords: [
      "who made you",
      "who built you",
      "are you real",
      "are you a robot",
      "are you an ai",
      "are you human",
      "do you sleep",
      "are you alive",
      "where do you live",
      "who are you",
      "what are you",
      "how are you",
    ],
    answer:
      "I'm the CareGiver Assistant — a friendly helper that lives right inside this app, on this very device. Nothing I say goes through the internet; I'm powered by a small built-in brain that only knows about your games, people and reminders here. I don't sleep, and I never leave your home. Ask me anything — that's what I'm here for.",
    tone: "greet",
  },
  {
    id: "feeling-proud",
    keywords: [
      "i did it",
      "i won",
      "i won the game",
      "won the game",
      "i beat",
      "i am proud",
      "i'm proud",
      "im proud",
      "proud of myself",
      "i feel proud",
      "congratulate me",
      "did you see me",
      "i finished",
    ],
    answer:
      "And you should be proud — that's a genuine win! Moments like this are exactly what steady practice is for. Let's enjoy it for a beat, and when you're ready, we can keep the good rhythm going with another session on Easy.",
    tone: "celebrate",
    suggest: "faces",
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
