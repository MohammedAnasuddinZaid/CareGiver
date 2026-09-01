/**
 * Localized game content.
 *
 * Two concerns live here:
 *  1. Every game's name and the instruction banner shown before play.
 *  2. The full Memory Lane (reminiscence) card bank — the one game whose
 *     questions, answers, stories and conversation prompts must read
 *     naturally in the player's own language. Scene emoji and gradients
 *     are locale-invariant and kept only on the English source cards.
 *
 * English is the canonical set; every other locale overrides it. Any
 * missing or blank field falls back to English — the same policy already
 * documented in lib/i18n/locales.ts ("until then English remains the
 * fallback for any gap"). A native-speaker review pass is planned before
 * field deployment, especially for the brx and mni packs.
 */

import type { GameId } from "@/lib/games/types";
import type { Locale } from "./locales";

export interface GamePhrases {
  title: string;
  instruction: string;
}

/** Locale-invariant part of a Memory Lane card. */
export interface MemoryCardShell {
  id: string;
  scene: string;
  tint: string;
}

/** Localized text for one Memory Lane card. All fields may be partial;
 *  the merge in `memoryCards()` falls back to English for any gap. */
export interface CardText {
  title?: string;
  question?: string;
  correct?: string;
  distractors?: readonly string[];
  story?: string;
  ask?: string;
}

export interface MemoryLaneTexts {
  takeMeBack: string;
  talkTogether: string;
  /** Same length & order as the English card bank. */
  cards: readonly CardText[];
}

const EN_GAMES: Record<GameId, GamePhrases> = {
  faces: {
    title: "Who Is In The Photo?",
    instruction: "Look at the photo — who is this person?",
  },
  names: {
    title: "Remembering Names",
    instruction: "Remember each face and name — they will ask you after a while.",
  },
  memorylane: {
    title: "Memory Lane",
    instruction: "Travel back in time — remember the old, happy days.",
  },
  market: {
    title: "Market Basket",
    instruction: "First remember the basket. Then find every item on the shelf.",
  },
  routine: {
    title: "Morning Routine",
    instruction: "Tap the cards in the order they happen in your morning.",
  },
  loom: {
    title: "Pattern Loom",
    instruction: "The strip follows a pattern. Choose what comes next.",
  },
  drums: {
    title: "Festival Drums",
    instruction: "Tap when you hear the drum 🥁 — stay still for the horn 📣",
  },
  soundmatch: {
    title: "Sound Match",
    instruction: "Listen to the sound, then tap what made it.",
  },
  spatial: {
    title: "Where Did I Keep It?",
    instruction: "Watch where things are placed, then find the one asked for.",
  },
  pairs: {
    title: "Card Pairs",
    instruction: "Flip two cards at a time and find every matching pair.",
  },
  bazaar: {
    title: "Bazaar Maths",
    instruction: "Add the prices, then choose the correct change.",
  },
  oddone: {
    title: "Odd One Out",
    instruction: "One picture does not belong with the rest — tap it.",
  },
  sortit: {
    title: "Sorting Station",
    instruction: "Send each item to its right basket.",
  },
  stroop: {
    title: "Color Trap",
    instruction: "Tap the COLOR of the text, not what the word says.",
  },
  trail: {
    title: "Number Trail",
    instruction: "Tap the numbers in order: 1, 2, 3…",
  },
  melody: {
    title: "Repeat the Tune",
    instruction: "Listen to the tune, then tap the same notes back.",
  },
  sequence: {
    title: "Pattern Sequence",
    instruction: "Watch the order, then tap the items in the same order.",
  },
  clock: {
    title: "Telling the Time",
    instruction: "Read the clock and tap the matching time.",
  },
  spot: {
    title: "Spot the Change",
    instruction: "One tile changed after you looked away — tap the one that changed.",
  },
  wordrecall: {
    title: "Word Recall",
    instruction: "These words were shown earlier — tap the ones you saw.",
  },
  follow: {
    title: "Follow the Lights",
    instruction: "Watch the lights, then tap the pads in the same order.",
  },
  shadow: {
    title: "Shadow Match",
    instruction: "Tap the shape that matches the target.",
  },
  reaction: {
    title: "Quick Tap",
    instruction: "Tap the moment the screen turns green — not before.",
  },
  wordbuilder: {
    title: "Word Builder",
    instruction: "Build the word by tapping the letters in order.",
  },
  category: {
    title: "Category Sort",
    instruction: "Drop each item into the group it belongs to.",
  },
  emotion: {
    title: "Feelings Match",
    instruction: "Choose the feeling that matches the face.",
  },
  target: {
    title: "Find the Target",
    instruction: "Scan the grid and tap the one that matches the target.",
  },
  order: {
    title: "Put in Order",
    instruction: "Tap the steps in their natural order.",
  },
};

/** English Memory Lane bank — carries id/scene/tint plus the canonical text. */
type EnglishCard = MemoryCardShell & {
  title: string;
  question: string;
  correct: string;
  distractors: readonly string[];
  story: string;
  ask: string;
};

const EN_MEMORY: readonly EnglishCard[] = [
  {
    id: "radio",
    scene: "📻",
    tint: "from-amber-100 via-orange-50 to-rose-100",
    title: "Evenings around the radio",
    question: "When the family radio played in the evening, what did everyone do?",
    correct: "Sat together and listened",
    distractors: ["Went to bed early", "Switched it off", "Ran outside to play"],
    story:
      "The whole room grew quiet — one story at a time, carried into every home by a small wooden box.",
    ask: "Ask your family: which radio show did they love most?",
  },
  {
    id: "diya",
    scene: "🪔",
    tint: "from-orange-100 via-amber-50 to-yellow-100",
    title: "Lamps at dusk",
    question: "At dusk, what was lit first at the doorstep?",
    correct: "A little lamp",
    distractors: ["The television", "A torch", "The streetlight"],
    story:
      "One small flame at the doorway meant the day was closing — and tomorrow would be welcomed the same way.",
    ask: "Ask your family: who lit the lamp at home each evening?",
  },
  {
    id: "tea",
    scene: "🫖",
    tint: "from-stone-100 via-amber-50 to-orange-100",
    title: "Tea time",
    question: "In the evening, what did visitors almost always get first?",
    correct: "A cup of tea",
    distractors: ["Cold water", "A letter", "An umbrella"],
    story:
      "The kettle knew before anyone did — guests were coming, and the talk could begin.",
    ask: "Ask your family: who made the best tea in the house?",
  },
  {
    id: "cycle",
    scene: "🚲",
    tint: "from-sky-100 via-cyan-50 to-teal-100",
    title: "The first bicycle",
    question: "Learning to ride a bicycle, who usually ran alongside holding the seat?",
    correct: "An elder brother or father",
    distractors: ["Nobody at all", "The postman", "A neighbour's dog"],
    story:
      "Somewhere between wobbles and laughter came that sudden magic — riding alone, wind in the face.",
    ask: "Ask your family: who taught them to ride a bicycle?",
  },
  {
    id: "monsoon",
    scene: "🌧️",
    tint: "from-slate-100 via-sky-50 to-indigo-100",
    title: "Monsoon mornings",
    question: "After the first rain, what did children race to sail in the water?",
    correct: "Paper boats",
    distractors: ["Wooden elephants", "Kites", "Clay lamps"],
    story:
      "Newspaper folded just so, puddles turned into oceans — and rain became the best toy of all.",
    ask: "Ask your family: what did they do on rainy afternoons?",
  },
  {
    id: "storytime",
    scene: "🌙",
    tint: "from-indigo-100 via-violet-50 to-purple-100",
    title: "Bedtime stories",
    question: "At night, who told the stories that ended with 'and they lived happily'?",
    correct: "Grandmother",
    distractors: ["The milkman", "The school teacher", "Nobody"],
    story:
      "Demons, kings and clever sparrows — every night promised one more story, and one more reason to sleep fast.",
    ask: "Ask your family: which story do they still remember?",
  },
  {
    id: "wedding",
    scene: "💃",
    tint: "from-rose-100 via-pink-50 to-fuchsia-100",
    title: "Wedding songs",
    question: "At family weddings, what filled the courtyard all night?",
    correct: "Songs and dancing",
    distractors: ["Silence", "Homework", "Rain"],
    story:
      "Drums in the corner, aunties leading the line — weddings were measured in songs, not hours.",
    ask: "Ask your family: which wedding song gets them dancing even now?",
  },
  {
    id: "village",
    scene: "🥭",
    tint: "from-lime-100 via-green-50 to-emerald-100",
    title: "Summer holidays",
    question: "School summer holidays were most often spent…",
    correct: "At grandparents' village",
    distractors: ["In the classroom", "At the office", "Alone at home"],
    story:
      "Mangoes straight off the tree, cousins by the dozen, and two months that felt like years.",
    ask: "Ask your family: where did they spend summer as children?",
  },
  {
    id: "market",
    scene: "🧺",
    tint: "from-yellow-100 via-amber-50 to-lime-100",
    title: "Market mornings",
    question: "What did grandmother carry to the vegetable market?",
    correct: "A cloth basket",
    distractors: ["A suitcase", "A bucket", "An umbrella stand"],
    story:
      "Bargaining was an art, fresh coriander came free with goodwill, and the basket came home heavy.",
    ask: "Ask your family: what was always bought fresh, never stored?",
  },
  {
    id: "festival",
    scene: "🎆",
    tint: "from-purple-100 via-fuchsia-50 to-rose-100",
    title: "Festival nights",
    question: "During festivals, what did the whole sky wear?",
    correct: "Sparkling lights",
    distractors: ["Grey clouds", "Snow", "Rainbow flags"],
    story:
      "New clothes, sweets passed hand to hand, and lights bright enough to make the whole lane glow.",
    ask: "Ask your family: which festival do they remember most fondly?",
  },
  {
    id: "letters",
    scene: "✉️",
    tint: "from-teal-100 via-emerald-50 to-cyan-100",
    title: "Letters from far away",
    question: "Before telephones were common, how did families share good news?",
    correct: "By post — a letter",
    distractors: ["By video call", "By text message", "By email"],
    story:
      "The postman's bicycle was the internet of its day — one envelope could make the whole street celebrate.",
    ask: "Ask your family: do they remember waiting for a letter?",
  },
  {
    id: "swing",
    scene: "🌳",
    tint: "from-green-100 via-teal-50 to-emerald-100",
    title: "Under the old tree",
    question: "In the afternoon heat, where did elders gather to talk?",
    correct: "Under the shady tree",
    distractors: ["On the rooftop in the sun", "Inside the fridge", "At the bus stop"],
    story:
      "One big tree, a few cots, endless tea — the neighbourhood's parliament, open all afternoon.",
    ask: "Ask your family: where did neighbours gather in their street?",
  },
];

const HI: Record<GameId, GamePhrases> = {
  faces: { title: "फोटो में कौन है?", instruction: "फोटो देखें — यह कौन हैं?" },
  names: {
    title: "नाम याद रखें",
    instruction: "हर चेहरा और नाम याद रखें — थोड़ी देर बाद पूछा जाएगा।",
  },
  memorylane: {
    title: "यादों की गली",
    instruction: "समय में पीछे जाइए — पुराने खुशी के दिन याद कीजिए।",
  },
  market: {
    title: "बाज़ार की टोकरी",
    instruction: "पहले टोकरी याद करें। फिर शेल्फ़ पर हर चीज़ खोजें।",
  },
  routine: {
    title: "सुबह की दिनचर्या",
    instruction: "सुबह की दिनचर्या के क्रम में कार्ड पर टैप करें।",
  },
  loom: {
    title: "बुनाई का पैटर्न",
    instruction: "पट्टी एक पैटर्न पर चलती है। आगे क्या आएगा, चुनें।",
  },
  drums: {
    title: "त्योहार के ढोल",
    instruction: "ढोल (🥁) सुनते ही टैप करें — भोंपू (📣) पर रुके रहें।",
  },
  soundmatch: {
    title: "आवाज़ का मेल",
    instruction: "आवाज़ सुनें, फिर बताएँ किसने बनाई।",
  },
  spatial: {
    title: "कहाँ रखा था?",
    instruction: "ध्यान से देखें चीज़ें कहाँ रखी गईं, फिर पूछी गई चीज़ खोजें।",
  },
  pairs: {
    title: "ताश के जोड़े",
    instruction: "एक बार में दो कार्ड पलटें और हर जोड़ा ढूँढें।",
  },
  bazaar: {
    title: "बाज़ार का हिसाब",
    instruction: "दाम जोड़ें, फिर सही बचत चुनें।",
  },
  oddone: {
    title: "बेमेल खोजें",
    instruction: "एक चित्र बाकियों से मेल नहीं खाता — उस पर टैप करें।",
  },
  sortit: {
    title: "छंटाई केंद्र",
    instruction: "हर चीज़ अपनी सही टोकरी में डालें।",
  },
  stroop: {
    title: "रंग का जाल",
    instruction: "शब्द के कहने को नहीं, लिखे रंग को टैप करें।",
  },
  trail: {
    title: "संख्या पथ",
    instruction: "संख्या क्रम में टैप करें: १, २, ३…",
  },
  melody: {
    title: "धुन दोहराएँ",
    instruction: "धुन सुनें, फिर वही संगीत दोहराएँ।",
  },
  sequence: {
    title: "पैटर्न क्रम",
    instruction: "क्रम देखें, फिर उसी क्रम में चीज़ें टैप करें।",
  },
  clock: {
    title: "समय बताइए",
    instruction: "घड़ी पढ़ें और मिलता हुआ समय चुनें।",
  },
  spot: {
    title: "परिवर्तन पहचानें",
    instruction: "नज़र हटते ही एक टाइल बदल गई — बदली हुई टाइल पर टैप करें।",
  },
  wordrecall: {
    title: "शब्द याद करें",
    instruction: "ये शब्द पहले दिखाए गए थे — जो देखे थे उन्हें टैप करें।",
  },
  follow: {
    title: "बत्तियों का पीछा",
    instruction: "बत्तियाँ देखें, फिर उसी क्रम में पैड टैप करें।",
  },
  shadow: {
    title: "परछाई का मेल",
    instruction: "लक्ष्य से मिलती परछाई पर टैप करें।",
  },
  reaction: {
    title: "फटाफट टैप",
    instruction: "स्क्रीन हरी होते ही टैप करें — पहले नहीं।",
  },
  wordbuilder: {
    title: "शब्द बनाएँ",
    instruction: "अक्षरों को क्रम में टैप करके शब्द बनाएँ।",
  },
  category: {
    title: "समूह में छाँटें",
    instruction: "हर चीज़ उसके समूह में डालें।",
  },
  emotion: {
    title: "भावनाओं का मेल",
    instruction: "चेहरे से मिलती भावना चुनें।",
  },
  target: {
    title: "निशाना खोजें",
    instruction: "ग्रिड देखें और लक्ष्य से मेल खाती चीज़ पर टैप करें।",
  },
  order: {
    title: "क्रम में लगाएँ",
    instruction: "कदमों को प्राकृतिक क्रम में टैप करें।",
  },
};

const HI_MEMORY: MemoryLaneTexts = {
  takeMeBack: "अपने आप को पीछे ले जाइए…",
  talkTogether: "परिवार के साथ इस पर बात कीजिए ♥",
  cards: [
    {
      title: "रेडियो वाली शामें",
      question: "शाम को परिवार का रेडियो बजने पर सब क्या करते थे?",
      correct: "साथ बैठकर सुनते थे",
      distractors: ["जल्दी सो जाते थे", "बंद कर देते थे", "बाहर खेलने भाग जाते थे"],
      story:
        "पूरा कमरा शांत हो जाता था — लकड़ी के छोटे डिब्बे से हर घर तक पहुँचती थीं कहानियाँ।",
      ask: "अपने परिवार से पूछें: उन्हें कौन सा रेडियो कार्यक्रम सबसे अच्छा लगता था?",
    },
    {
      title: "शाम का दीया",
      question: "शाम को दरवाज़े पर सबसे पहले क्या जलाया जाता था?",
      correct: "एक छोटा दीया",
      distractors: ["टेलीविज़न", "टॉर्च", "सड़क की बत्ती"],
      story:
        "दरवाज़े पर एक छोटी सी लौ का मतलब था कि दिन बीत रहा है — और कल का भी इसी तरह स्वागत होगा।",
      ask: "अपने परिवार से पूछें: घर पर शाम को दीया कौन जलाता था?",
    },
    {
      title: "चाय का समय",
      question: "शाम को मेहमानों को लगभग हमेशा सबसे पहले क्या मिलता था?",
      correct: "एक प्याली चाय",
      distractors: ["ठंडा पानी", "एक चिट्ठी", "छाता"],
      story:
        "केतली किसी और से पहले जानती थी — मेहमान आ रहे हैं, और बातचीत शुरू हो सकती है।",
      ask: "अपने परिवार से पूछें: घर की सबसे अच्छी चाय कौन बनाता था?",
    },
    {
      title: "पहली साइकिल",
      question: "साइकिल चलाना सीखते समय सीट पकड़कर साथ कौन दौड़ता था?",
      correct: "बड़ा भाई या पिता",
      distractors: ["कोई नहीं", "डाकिया", "पड़ोसी का कुत्ता"],
      story:
        "डगमगाहट और हँसी के बीच आता था वह अचानक चमत्कार — अकेले चलना, चेहरे पर हवा।",
      ask: "अपने परिवार से पूछें: उन्हें साइकिल चलाना किसने सिखाया?",
    },
    {
      title: "बरसात की सुबहें",
      question: "पहली बारिश के बाद बच्चे पानी में क्या चलाते थे?",
      correct: "कागज़ की नावें",
      distractors: ["लकड़ी के हाथी", "पतंगें", "मिट्टी के दीये"],
      story:
        "अखबार को ऐसे मोड़ो, गड्ढे समंदर बन गए — और बारिश सबसे अच्छा खिलौना।",
      ask: "अपने परिवार से पूछें: बरसात की दोपहरों में वे क्या करते थे?",
    },
    {
      title: "सोने की कहानियाँ",
      question: "रात में 'फिर वे सुखी रहे' पर खत्म होने वाली कहानियाँ कौन सुनाता था?",
      correct: "दादी",
      distractors: ["दूधवाला", "स्कूल की मैडम", "कोई नहीं"],
      story:
        "राक्षस, राजा और चालाक गौरैया — हर रात एक और कहानी, और जल्दी सोने की एक और वजह।",
      ask: "अपने परिवार से पूछें: उन्हें कौन सी कहानी आज भी याद है?",
    },
    {
      title: "शादी के गीत",
      question: "पारिवारिक शादियों में पूरी रात आँगन में क्या भरा रहता था?",
      correct: "गीत और नाच",
      distractors: ["ख़ामोशी", "होमवर्क", "बारिश"],
      story:
        "कोने में ढोल, आगे बुआओं की कतार — शादियाँ घंटों में नहीं, गीतों में नापी जाती थीं।",
      ask: "अपने परिवार से पूछें: कौन सा शादी वाला गीत आज भी उन्हें नचा देता है?",
    },
    {
      title: "गर्मी की छुट्टियाँ",
      question: "स्कूल की गर्मी की छुट्टियाँ अक्सर कहाँ बीतती थीं?",
      correct: "नाना-दादी के गाँव में",
      distractors: ["कक्षा में", "दफ़्तर में", "घर पर अकेले"],
      story:
        "पेड़ से सीधे तोड़े आम, गिनती से ज़्यादा चचेरे भाई-बहन, और दो महीने जो सालों जैसे लगते थे।",
      ask: "अपने परिवार से पूछें: बचपन में वे गर्मी कहाँ बिताते थे?",
    },
    {
      title: "बाज़ार की सुबहें",
      question: "दादी सब्ज़ी बाज़ार क्या लेकर जाती थीं?",
      correct: "कपड़े की टोकरी",
      distractors: ["सूटकेस", "बाल्टी", "छाते का स्टैंड"],
      story:
        "मोलभाव एक कला था, ताज़ा धनिया स्नेह के साथ मुफ़्त मिलता था, और टोकरी घर भारी आती थी।",
      ask: "अपने परिवार से पूछें: क्या हमेशा ताज़ा खरीदा जाता था, कभी जमा नहीं रखा जाता?",
    },
    {
      title: "त्योहार की रातें",
      question: "त्योहारों पर पूरा आसमान क्या पहनता था?",
      correct: "जगमगाती रोशनी",
      distractors: ["भूरे बादल", "बर्फ़", "रंगीन झंडे"],
      story:
        "नए कपड़े, हाथ-से-हाथ मिठाइयाँ, और लाइटें इतनी चमकदार कि पूरी गली जगमगा उठे।",
      ask: "अपने परिवार से पूछें: कौन सा त्योहार सबसे प्रिय है?",
    },
    {
      title: "दूर से आए खत",
      question: "टेलीफ़ोन के आम होने से पहले परिवार अच्छी ख़बर कैसे साझा करते थे?",
      correct: "डाक से — एक खत",
      distractors: ["वीडियो कॉल से", "मैसेज से", "ईमेल से"],
      story:
        "डाकिए की साइकिल उस ज़माने का इंटरनेट थी — एक लिफाफा पूरी गली को खुश कर सकता था।",
      ask: "अपने परिवार से पूछें: क्या उन्हें खत का इंतज़ार याद है?",
    },
    {
      title: "पुराने पेड़ के नीचे",
      question: "दोपहर की गर्मी में बड़े लोग बातें करने कहाँ जुटते थे?",
      correct: "छायादार पेड़ के नीचे",
      distractors: ["धूप में छत पर", "फ्रिज के अंदर", "बस स्टॉप पर"],
      story:
        "एक बड़ा पेड़, कुछ चारपाइयाँ, अंतहीन चाय — पड़ोस की संसद, दोपहर भर खुली।",
      ask: "अपने परिवार से पूछें: उनके मोहल्ले में पड़ोसी कहाँ जुटते थे?",
    },
  ],
};

const BN: Record<GameId, GamePhrases> = {
  faces: { title: "ফটোতে কে আছেন?", instruction: "ফটোটি দেখুন — এঁরা কে?" },
  names: {
    title: "নাম মনে রাখা",
    instruction: "প্রতিটি মুখ ও নাম মনে রাখুন — কিছুক্ষণ পরে জিজ্ঞেস করা হবে।",
  },
  memorylane: {
    title: "স্মৃতির গলি",
    instruction: "সময়ে পিছিয়ে যান — পুরোনো আনন্দের দিনগুলো মনে করুন।",
  },
  market: {
    title: "বাজারের ঝুড়ি",
    instruction: "প্রথমে ঝুড়িটি মনে রাখুন। তারপর শেলফে প্রতিটি জিনিস খুঁজুন।",
  },
  routine: {
    title: "সকালের রুটিন",
    instruction: "সকালে যে ক্রমে কাজ হয়, সেই ক্রমে কার্ডে চাপ দিন।",
  },
  loom: {
    title: "বুননের প্যাটার্ন",
    instruction: "ফিতাটি একটি প্যাটার্নে চলে। এরপর কী আসবে, বেছে নিন।",
  },
  drums: {
    title: "উৎসবের ঢোল",
    instruction: "ঢোল (🥁) শুনলেই চাপ দিন — ভেরি (📣) বুঝলে স্থির থাকুন।",
  },
  soundmatch: {
    title: "শব্দ মেলানো",
    instruction: "শব্দটি শুনুন, তারপর বলুন কোন বস্তুটি বাজল।",
  },
  spatial: {
    title: "কোথায় রেখেছি?",
    instruction: "বস্তুগুলো কোথায় রাখা হল ভালো করে দেখুন, তারপর জিজ্ঞেস করা বস্তুটি খুঁজুন।",
  },
  pairs: {
    title: "তাসের জোড়া",
    instruction: "একবারে দুটি কার্ড উল্টান এবং প্রতিটি জোড়া খুঁজে বের করুন।",
  },
  bazaar: {
    title: "বাজারের হিসাব",
    instruction: "দামগুলো যোগ করুন, তারপর সঠিক খুচরো বেছে নিন।",
  },
  oddone: {
    title: "বেমানানটি খুঁজুন",
    instruction: "একটি ছবি বাকিগুলোর সঙ্গে মেলে না — সেটিতে চাপ দিন।",
  },
  sortit: {
    title: "সাজানোর কেন্দ্র",
    instruction: "প্রতিটি জিনিস তার সঠিক ঝুড়িতে রাখুন।",
  },
  stroop: {
    title: "রঙের ফাঁদ",
    instruction: "শব্দটি যা বলছে তা নয় — লেখাটির রঙ টিপুন।",
  },
  trail: {
    title: "সংখ্যার পথ",
    instruction: "সংখ্যা ক্রমে চাপ দিন: ১, ২, ৩…",
  },
  melody: {
    title: "সুরটি আবার বাজান",
    instruction: "সুরটি শুনুন, তারপর একই সুর ফিরিয়ে বাজান।",
  },
  sequence: {
    title: "প্যাটার্নের ক্রম",
    instruction: "ক্রমটি দেখুন, তারপর একই ক্রমে বস্তুগুলো চাপুন।",
  },
  clock: {
    title: "সময় বলে দিন",
    instruction: "ঘড়ি পড়ুন এবং মিলে যাওয়া সময়টি বেছে নিন।",
  },
  spot: {
    title: "পরিবর্তন খুঁজুন",
    instruction: "দৃষ্টি সরানোর পর একটি টাইল বদলে গেছে — বদলে যাওয়া টাইলটিতে চাপ দিন।",
  },
  wordrecall: {
    title: "শব্দ মনে রাখা",
    instruction: "এই শব্দগুলো আগে দেখানো হয়েছিল — যা দেখেছিলেন সেগুলো চাপুন।",
  },
  follow: {
    title: "আলোর পিছনে চলুন",
    instruction: "আলোগুলো দেখুন, তারপর একই ক্রমে প্যাডগুলো চাপুন।",
  },
  shadow: {
    title: "ছায়ার মিল",
    instruction: "লক্ষ্যের সঙ্গে মিলে যাওয়া ছায়াটিতে চাপ দিন।",
  },
  reaction: {
    title: "দ্রুত চাপ",
    instruction: "স্ক্রিন সবুজ হওয়া মাত্র চাপ দিন — আগে নয়।",
  },
  wordbuilder: {
    title: "শব্দ গঠন",
    instruction: "অক্ষরগুলো ক্রমে চেপে শব্দটি তৈরি করুন।",
  },
  category: {
    title: "দল অনুযায়ী সাজান",
    instruction: "প্রতিটি জিনিস তার দলে রাখুন।",
  },
  emotion: {
    title: "অনুভূতির মিল",
    instruction: "মুখের সঙ্গে মিলে যাওয়া অনুভূতিটি বেছে নিন।",
  },
  target: {
    title: "লক্ষ্য খুঁজুন",
    instruction: "গ্রিডটি দেখুন এবং লক্ষ্যের সঙ্গে মিলে যাওয়া টি চাপুন।",
  },
  order: {
    title: "ক্রমে সাজান",
    instruction: "পদক্ষেপগুলো স্বাভাবিক ক্রমে চাপুন।",
  },
};

const BN_MEMORY: MemoryLaneTexts = {
  takeMeBack: "নিজেকে সময়ে পিছিয়ে নিয়ে আসুন…",
  talkTogether: "পরিবারের সঙ্গে এ নিয়ে কথা বলুন ♥",
  cards: [
    {
      title: "রেডিওর সন্ধ্যা",
      question: "সন্ধ্যায় পরিবারের রেডিও বাজলে সবাই কী করত?",
      correct: "একসঙ্গে বসে শুনত",
      distractors: ["তাড়াতাড়ি ঘুমোতে যেত", "বন্ধ করে দিত", "বাইরে খেলতে ছুটত"],
      story:
        "গোটা ঘর নিঃশব্দ হয়ে যেত — ছোট্ট কাঠের বাক্স থেকে একেকটা করে গল্প পৌঁছে যেত প্রতিটি ঘরে।",
      ask: "পরিবারকে জিজ্ঞেস করুন: কোন রেডিও অনুষ্ঠানটা তাদের সবচেয়ে ভালো লাগত?",
    },
    {
      title: "গোধূলির প্রদীপ",
      question: "সন্ধ্যায় দোরগোড়ায় সবার আগে কী জ্বালানো হত?",
      correct: "একটি ছোট প্রদীপ",
      distractors: ["টেলিভিশন", "টর্চ", "রাস্তার বাতি"],
      story:
        "দরজায় একটি ছোট্ট শিখা মানে দিন শেষ হচ্ছে — আর আগামীকালও একইভাবে স্বাগত জানানো হবে।",
      ask: "পরিবারকে জিজ্ঞেস করুন: বাড়িতে সন্ধ্যায় প্রদীপ কে জ্বালাত?",
    },
    {
      title: "চায়ের সময়",
      question: "সন্ধ্যায় অতিথিদের প্রায় সবসময় সবার আগে কী দেওয়া হত?",
      correct: "এক কাপ চা",
      distractors: ["ঠান্ডা জল", "একটি চিঠি", "ছাতা"],
      story:
        "কেটলি সবার আগে জেনে যেত — অতিথিরা আসছেন, আর আলোচনা শুরু হতে পারে।",
      ask: "পরিবারকে জিজ্ঞেস করুন: বাড়ির সবচেয়ে ভালো চা কে বানাত?",
    },
    {
      title: "প্রথম সাইকেল",
      question: "সাইকেল চালানো শেখার সময় সিট ধরে পাশে কে দৌড়াত?",
      correct: "বড় ভাই বা বাবা",
      distractors: ["কেউ না", "ডাকপিয়ন", "প্রতিবেশীর কুকুর"],
      story:
        "দোল খাওয়া আর হাসির মাঝেই আসত সেই হঠাৎ ম্যাজিক — একা চালানো, মুখে বাতাস।",
      ask: "পরিবারকে জিজ্ঞেস করুন: তাদের সাইকেল চালানো কে শিখিয়েছিল?",
    },
    {
      title: "বর্ষার সকাল",
      question: "প্রথম বৃষ্টির পরে বাচ্চারা জলে দৌড়ে কী ভাসাত?",
      correct: "কাগজের নৌকো",
      distractors: ["কাঠের হাতি", "ঘুড়ি", "মাটির প্রদীপ"],
      story:
        "খবরের কাগজ মোড়া হত ঠিক করে, ডোবা হয়ে যেত সাগর — আর বৃষ্টি হয়ে যেত সেরা খেলনা।",
      ask: "পরিবারকে জিজ্ঞেস করুন: বৃষ্টির বিকেলে তারা কী করত?",
    },
    {
      title: "ঘুমের গল্প",
      question: "রাতে 'শেষে তারা সুখে ছিল' দিয়ে শেষ হওয়া গল্প কে বলত?",
      correct: "দিদিমা",
      distractors: ["দুধওয়ালা", "স্কুলের শিক্ষিকা", "কেউ না"],
      story:
        "দৈত্য, রাজা আর চালাক চড়ুই — প্রতিরাতের প্রতিশ্রুতি ছিল আরও একটা গল্প, আর তাড়াতাড়ি ঘুমোনোর আরও একটা কারণ।",
      ask: "পরিবারকে জিজ্ঞেস করুন: কোন গল্পটা তাদের এখনও মনে আছে?",
    },
    {
      title: "বিয়ের গান",
      question: "পারিবারিক বিয়েতে সারারাত উঠোনে কী ভরে থাকত?",
      correct: "গান ও নাচ",
      distractors: ["নীরবতা", "বাড়ির কাজ", "বৃষ্টি"],
      story:
        "কোণে ঢোল, সামনে পিসিদের সারি — বিয়ে মাপা হত ঘণ্টায় নয়, গানে গানে।",
      ask: "পরিবারকে জিজ্ঞেস করুন: কোন বিয়ের গান আজও তাদের নাচিয়ে তোলে?",
    },
    {
      title: "গ্রীষ্মের ছুটি",
      question: "স্কুলের গ্রীষ্মের ছুটি প্রায়শই কোথায় কাটত?",
      correct: "দাদু-দিদির গ্রামে",
      distractors: ["ক্লাসরুমে", "অফিসে", "বাড়িতে একা"],
      story:
        "গাছ থেকে নেমে আসা আম, অগুনতি কাজিন, আর দু'মাস যেন কয়েক বছর হয়ে যেত।",
      ask: "পরিবারকে জিজ্ঞেস করুন: ছোটবেলায় তারা গ্রীষ্ম কোথায় কাটাত?",
    },
    {
      title: "বাজারের সকাল",
      question: "ঠাকুমা সবজি বাজারে কী নিয়ে যেতেন?",
      correct: "একটি কাপড়ের ঝুড়ি",
      distractors: ["সুটকেস", "বালতি", "ছাতার স্ট্যান্ড"],
      story:
        "দরদাম ছিল এক শিল্প, স্নেহের সঙ্গে ধনে বিনামূল্যে মিলত, আর ঝুড়ি বাড়ি ফিরত ভারী হয়ে।",
      ask: "পরিবারকে জিজ্ঞেস করুন: কী সবসময় তাজা কিনতে হত, কখনও জমিয়ে রাখা যেত না?",
    },
    {
      title: "উৎসবের রাত",
      question: "উৎসবের সময় গোটা আকাশ কী পরে থাকত?",
      correct: "ঝলমলে আলো",
      distractors: ["ধূসর মেঘ", "তুষার", "রঙিন পতাকা"],
      story:
        "নতুন জামা, হাতে হাতে মিষ্টি, আর এমন আলো যাতে গোটা গলি জ্বলজ্বল করে উঠত।",
      ask: "পরিবারকে জিজ্ঞেস করুন: কোন উৎসবটি তাদের সবচেয়ে প্রিয়?",
    },
    {
      title: "দূর থেকে আসা চিঠি",
      question: "টেলিফোন প্রচলিত হওয়ার আগে পরিবার ভালো খবর কীভাবে ভাগ করে নিত?",
      correct: "ডাকযোগে — একটি চিঠি",
      distractors: ["ভিডিও কল করে", "মেসেজ করে", "ইমেল করে"],
      story:
        "ডাকপিয়নের সাইকেলই ছিল সেই সময়ের ইন্টারনেট — একটি খাম গোটা গলিকে খুশি করে দিতে পারত।",
      ask: "পরিবারকে জিজ্ঞেস করুন: চিঠির অপেক্ষা করার কথা মনে আছে কি?",
    },
    {
      title: "পুরোনো গাছের নীচে",
      question: "দুপুরের গরমে বড়রা কথা বলতে কোথায় জড়ো হত?",
      correct: "ছায়াময় গাছের নীচে",
      distractors: ["রোদে ছাদে", "ফ্রিজের ভেতরে", "বাসস্টপে"],
      story:
        "একটি বড় গাছ, কয়েকটা খাট, শেষহীন চা — প্রতিবেশীর সংসদ, সারাদুপুর খোলা।",
      ask: "পরিবারকে জিজ্ঞেস করুন: তাদের পাড়ায় প্রতিবেশীরা কোথায় জড়ো হত?",
    },
  ],
};

/**
 * Assamese. Follows the script of the as pack in locales.ts (as-IN).
 */
const AS: Record<GameId, GamePhrases> = {
  faces: { title: "ফটোখনত কোন আছে?", instruction: "ফটোখন চাওক — এইজন কোন?" },
  names: {
    title: "নাম মনত ৰাখক",
    instruction: "প্ৰতিটো মুখ আৰু নাম মনত ৰাখক — কিছু পৰৰ পিছত সুধিব।",
  },
  memorylane: {
    title: "স্মৃতিৰ বাট",
    instruction: "সময়ত পিছুৱাই যাওক — পুৰণি আনন্দৰ দিনবোৰ মনত পেলাওক।",
  },
  market: {
    title: "বজাৰৰ টোকোনা",
    instruction: "আগে টোকোনাখন মনত ৰাখক। তাৰ পিছত শেলফত প্ৰতিটো বস্তু বিচাৰক।",
  },
  routine: {
    title: "পুৱাৰ ৰুটিন",
    instruction: "পুৱা যি ক্ৰমত হয়, সেই ক্ৰমত কাৰ্ডবোৰত টিপক।",
  },
  loom: {
    title: "বোৱণিৰ ফুটকি",
    instruction: "পট্টিখন এটা ফুটকিত চলে। ইয়াৰ পিছত কি আহিব, বাছি লওক।",
  },
  drums: {
    title: "বিহু ঢোল",
    instruction: "ঢোল (🥁) শুনিলেই টিপক — ভেৰি (📣) শুনিলে স্থিৰ থাকক।",
  },
  soundmatch: {
    title: "শব্দ মিলোৱা",
    instruction: "শব্দটো শুনক, তাৰ পিছত ক'ক কিয়াই বজালে।",
  },
  spatial: {
    title: "ক'ত ৰাখিলোঁ?",
    instruction: "বস্তুবোৰ ক'ত ৰখা হ'ল ভালকৈ চাওক, তাৰ পিছত খোজা বস্তুটো বিচাৰক।",
  },
  pairs: {
    title: "কাৰ্ডৰ যোৰা",
    instruction: "এবাৰতে দুটা কাৰ্ড পলটাওক আৰু প্ৰতিটো যোৰা বিচাৰক।",
  },
  bazaar: {
    title: "বজাৰৰ হিচাপ",
    instruction: "দামবোৰ যোগ কৰক, তাৰ পিছত শুদ্ধ খুচৰা বাছি লওক।",
  },
  oddone: {
    title: "বেমেলাটো বিচাৰক",
    instruction: "এটা ছবি বাকীবোৰৰ লগত নিমিলে — তাত টিপক।",
  },
  sortit: {
    title: "সজোৱা কেন্দ্ৰ",
    instruction: "প্ৰতিটো বস্তু তাৰ শুদ্ধ টোকোনাত থওক।",
  },
  stroop: {
    title: "ৰঙৰ জাল",
    instruction: "শব্দই যি কয় সেয়া নহয় — লিখিত ৰঙটো টিপক।",
  },
  trail: {
    title: "সংখ্যাৰ পথ",
    instruction: "ক্ৰমে সংখ্যা টিপক: ১, ২, ৩…",
  },
  melody: {
    title: "সুৰটো আকৌ বজাওক",
    instruction: "সুৰটো শুনক, তাৰ পিছত একেখিনি সুৰ ঘূৰাই বজাওক।",
  },
  sequence: {
    title: "ফুটকিৰ ক্ৰম",
    instruction: "ক্ৰমটো চাওক, তাৰ পিছত একে ক্ৰমতে বস্তুবোৰ টিপক।",
  },
  clock: {
    title: "সময় কওক",
    instruction: "ঘড়ীটো পঢ়ক আৰু মিলি যোৱা সময়টো বাছি লওক।",
  },
  spot: {
    title: "সলনি বিচাৰক",
    instruction: "দৃষ্টি আঁতৰোৱাৰ পিছত এটা টাইল সলনি হ'ল — সলনি হোৱা টাইলটোত টিপক।",
  },
  wordrecall: {
    title: "শব্দ মনত ৰখা",
    instruction: "এই শব্দবোৰ আগতে দেখুওৱা হৈছিল — যিবোৰ দেখিছিল সেয়া টিপক।",
  },
  follow: {
    title: "জোনাকৰ পিছে পিছে",
    instruction: "জোনাকবোৰ চাওক, তাৰ পিছত একে ক্ৰমতে পেডবোৰ টিপক।",
  },
  shadow: {
    title: "ছাঁৰ মিল",
    instruction: "লক্ষ্যৰ লগত মিলি যোৱা ছাঁটোত টিপক।",
  },
  reaction: {
    title: "খৰখৰীয়া টিপ",
    instruction: "স্ক্ৰীন সেউজীয়া হোৱা মাত্ৰ টিপক — আগতে নহয়।",
  },
  wordbuilder: {
    title: "শব্দ গঠন",
    instruction: "আখৰবোৰ ক্ৰমে টিপি শব্দটো বনাওক।",
  },
  category: {
    title: "দল অনুযায়ী সজাওক",
    instruction: "প্ৰতিটো বস্তু তাৰ দলত থওক।",
  },
  emotion: {
    title: "অনুভূতিৰ মিল",
    instruction: "মুখখনৰ লগত মিলি যোৱা অনুভূতিটো বাছি লওক।",
  },
  target: {
    title: "লক্ষ্য বিচাৰক",
    instruction: "গ্ৰিডখন চাওক আৰু লক্ষ্যৰ লগত মিলি যোৱাটো টিপক।",
  },
  order: {
    title: "ক্ৰমত সজাওক",
    instruction: "কদমবোৰ স্বাভাৱিক ক্ৰমত টিপক।",
  },
};

const AS_MEMORY: MemoryLaneTexts = {
  takeMeBack: "নিজকে সময়ত পিছুৱাই নিয়ক…",
  talkTogether: "পৰিয়ালৰ লগত ইয়াৰ বিষয়ে কথা কওক ♥",
  cards: [
    {
      title: "ৰেডিঅ'ৰ গধূলি",
      question: "গধূলি পৰিয়ালৰ ৰেডিঅ' বজালে সকলোৱে কি কৰিছিল?",
      correct: "একেলগে বহি শুনিছিল",
      distractors: ["সোনকালে শুই পৰিছিল", "বন্ধ কৰি দিছিল", "বাহিৰত খেলিবলৈ গৈছিল"],
      story:
        "গোটেই কোঠাটো নিস্তব্ধ হৈ পৰিছিল — ছোট্ট কাঠৰ বাকচৰ পৰা এটাকৈ কাহিনী প্ৰতিটো ঘৰলৈ গৈছিল।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: কোনখন ৰেডিঅ' অনুষ্ঠান ভাল লাগিছিল?",
    },
    {
      title: "গধূলিৰ সাকী",
      question: "গধূলি দুৱাৰমুখত সৰ্বপ্ৰথম কি জ্বলাইছিল?",
      correct: "এটা সৰু সাকী",
      distractors: ["টেলিভিছন", "টৰ্চ", "ৰাস্তাৰ বাতি"],
      story:
        "দুৱাৰত এটা সৰু শিখাই বুজাইছিল দিন শেষ হৈছে — আৰু কাইলৈও একেদৰেই আদৰণি হ'ব।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: ঘৰত গধূলি সাকী কোনে জ্বলাইছিল?",
    },
    {
      title: "চাহৰ সময়",
      question: "গধূলি অতিথিসকলক প্ৰায় সদায় সৰ্বপ্ৰথম কি দিয়া হৈছিল?",
      correct: "এটা বাটি চাহ",
      distractors: ["থাণ্ডা পানী", "এখন চিঠি", "ছাতি"],
      story:
        "কেটলীয়ে বাকী সকলোৰে আগত জানিব পাৰিছিল — অতিথি আহি আছে, আৰু কথা আৰম্ভ হ'ব পাৰে।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: ঘৰৰ আটাইতকৈ ভাল চাহ কোনে বনাইছিল?",
    },
    {
      title: "প্ৰথম ছাইকেল",
      question: "ছাইকেল চলাবলৈ শিকোতে চিট ধৰি কাষত কোনে দৌৰাইছিল?",
      correct: "দেউতা বা বৰ ভাই",
      distractors: ["কোনোৱেই নহয়", "ডাকঘৰীয়া", "চুবুৰীয়াৰ কুকুৰ"],
      story:
        "দোলনি আৰু হাঁহিৰ মাজতে আহিছিল সেই হঠাৎ আচৰিত মুহূৰ্ত — অকলে চলোৱা, মুখত বতাহ।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: ছাইকেল চলাবলৈ কোনে শিকাইছিল?",
    },
    {
      title: "বৰষুণৰ পুৱা",
      question: "প্ৰথম বৰষুণৰ পিছত ল'ৰাবোৰে পানীত দৌৰি কি ভটিয়াইছিল?",
      correct: "কাকতৰ নাৱঁ",
      distractors: ["কাঠৰ হাতী", "ঘুৰি", "মাটিৰ সাকী"],
      story:
        "খবৰৰ কাকত ঠিককৈ ভাঁজো, গাঁতবোৰ হৈ পৰিছিল সাগৰ — আৰু বৰষুণ হৈছিল আটাইতকৈ ভাল খেলনা।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: বৰষুণৰ আবেলি তেওঁলোকে কি কৰিছিল?",
    },
    {
      title: "শোৱাৰ সময়ৰ সাধু",
      question: "ৰাতি 'আৰু তেওঁলোক সুখেৰে থাকিল' বুলি শেষ হোৱা সাধুবোৰ কোনে কৈছিল?",
      correct: "আইতা",
      distractors: ["গাখীৰওয়ালা", "স্কুলৰ মাই", "কোনোৱেই নহয়"],
      story:
        "দৈত্য, ৰজা আৰু চতুৰ চৰাই — প্ৰতিটো ৰাতি এটা নতুন সাধু, আৰু সোনকালে শুবলৈ এটা নতুন কাৰণ।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: কোন সাধুটো এতিয়াও মনত আছে?",
    },
    {
      title: "বিয়াৰ গীত",
      question: "পৰিয়ালৰ বিয়াত গোটেই ৰাতি চোতালখনত কি ভৰি থাকিছিল?",
      correct: "গীত আৰু নাচ",
      distractors: ["নিস্তব্ধতা", "ঘৰৰ কাম", "বৰষুণ"],
      story:
        "কোণত ঢোল, আগত পেহীসকলৰ শাৰী — বিয়া ঘণ্টাত নহয়, গীতেৰে জুখি হৈছিল।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: কোন গীতটোৱে এতিয়াও তেওঁলোকক নচুৱায়?",
    },
    {
      title: "গ্ৰীষ্মৰ বন্ধ",
      question: "স্কুলৰ গ্ৰীষ্মকালীন বন্ধ প্ৰায়ে ক'ত কটাইছিল?",
      correct: "আইতা-ককাৰ গাঁৱত",
      distractors: ["শ্ৰেণীত", "অফিচত", "ঘৰত অকলে"],
      story:
        "গছৰ পৰা নামি অহা আম, গণনাৰে অধিক মামৰ-ককাই যেন বহু বছৰ হৈ পৰিছিল।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: সৰুকালত গ্ৰীষ্ম ক'ত কটাইছিল?",
    },
    {
      title: "বজাৰৰ পুৱা",
      question: "আইতাই শাক-পাচলিৰ বজাৰলৈ কি লৈ গৈছিল?",
      correct: "এটা কাপোৰৰ টোকোনা",
      distractors: ["চুটকেছ", "বাল্টি", "ছাতিৰ থিয়"],
      story:
        "দৰ-দাম আছিল এটা শিল্প, স্নেহেৰে ধনীয়া বিনামূলীয়াই পোৱা গৈছিল, আৰু টোকোনাখন ঘৰলৈ ভাৰী হৈ গৈছিল।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: কি সদায় সতেজ কিনা হৈছিল, কেতিয়াও জমা ৰখা নহৈছিল?",
    },
    {
      title: "উৎসৱৰ ৰাতি",
      question: "উৎসৱৰ সময়ত গোটেই আকাশখনে কি পিন্ধি আছিল?",
      correct: "চিকমিকিয়া পোহৰ",
      distractors: ["মেঘ", "বৰফ", "ৰঙীন পতাকা"],
      story:
        "নতুন কাপোৰ, হাত লাগি হাত মিঠাই, আৰু এনে পোহৰ যাতে গোটেই গলিখন জিলিকি উঠে।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: কোন উৎসৱটো সৰ্বাধিক পছন্দ?",
    },
    {
      title: "দূৰৰ পৰা অহা চিঠি",
      question: "টেলিফোন সাধাৰণ হোৱাৰ আগতে পৰিয়ালে ভাল খবৰ কেনেকৈ ভাগ-বতৰা কৰিছিল?",
      correct: "ডাকযোগে — এখন চিঠি",
      distractors: ["ভিডিঅ' কলৰে", "মেছেজৰে", "ইমেইলৰে"],
      story:
        "ডাকঘৰীয়াৰ চাইকেলখনেই আছিল সেই সময়ৰ ইন্টাৰনেট — এটা খাম গোটেই গলিৰে উৎসৱ কৰিব পাৰিছিল।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: চিঠিৰ বাবে অপেক্ষা কৰা মনত আছে নে?",
    },
    {
      title: "পুৰণি গছৰ তলত",
      question: "দুপৰীয়াৰ গৰমত ডাঙৰ মানুহবোৰ কথা পাতিবলৈ ক'ত জমা হৈছিল?",
      correct: "ছাঁ দিয়া গছৰ তলত",
      distractors: ["ৰ'দত ঘৰৰ চালত", "ফ্ৰিজৰ ভিতৰত", "বাছ ষ্টপত"],
      story:
        "এটা ডাঙৰ গছ, কেইখন খাট, অন্তহীন চাহ — চুবুৰীৰ সংসদ, গোটেই দুপৰীয়া খোলা।",
      ask: "আপোনাৰ পৰিয়ালক সোধক: তেওঁলোকৰ গলিত চুবুৰীয়াসকল ক'ত জমা হৈছিল?",
    },
  ],
};

/**
 * Bodo (brx). Short, best-effort strings aligned with the vocabulary of
 * the brx pack in locales.ts; any gap falls back to English until the
 * planned native-speaker review pass.
 */
const BRX: Record<GameId, GamePhrases> = {
  faces: { title: "फोटोयाव सोर?", instruction: "फोटोखौ नुथि — बेबिलि सोर?" },
  names: {
    title: "मुं मोननाय",
    instruction: "गासै आखानि आरो मुंखौ गोसांएर — सोमयनि उनाव नागिरनाय जागोन।",
  },
  memorylane: {
    title: "गोसांनि दिन",
    instruction: "सोमयनि उनाफै लिर — गुबुन हारिनि दिनफोरखौ गोसांएर।",
  },
  market: {
    title: "बजारनि बांसि",
    instruction: "थाआन बांसिखौ गोसांएर। उनाव शेल्फजोंनि गासै खोलबिखौ नागिर।",
  },
  routine: {
    title: "गाज्रिनांनि रादाब",
    instruction: "पुबा सोमयाव जाबलैयै फैयो, बे क्रमनो कार्डफोरखौ टिप हो।",
  },
  loom: {
    title: "सथिनि नोखोद",
    instruction: "पट्टियानि नोखोद गोसोंनै फैयो। उनाव मा गाबग्रा, बासिख।",
  },
  drums: {
    title: "बिस्नुनि ख्रोम",
    instruction: "ख्रोम (🥁) मोनज्लायब्ला टिप हो — भेरि (📣) मोनज्लायब्ला थादेर।",
  },
  soundmatch: {
    title: "रोखोमनि सिनाय",
    instruction: "रोखोमखौ मोनज्ला, उनाव मा खालामदों बुं।",
  },
  spatial: {
    title: "माब्लैयाव थानाय?",
    instruction: "जाथावफोर माब्लैयाव थानो नुथि, उनाव नागिरनाय खोलबिखौ नागिर।",
  },
  pairs: {
    title: "कार्डनि जोड़ा",
    instruction: "सोमाव गन्नै कार्डखौ फेरा, आरो गासै जोड़ाखौ नागिर।",
  },
  bazaar: {
    title: "बजारनि हिसाब",
    instruction: "मोलफोरखौ सुब्लनाय, उनाव गोजौ खुचराखौ बासिख।",
  },
  oddone: {
    title: "मोनगासिना सिनाय",
    instruction: "मोनसे थैनाय बेनिखायफोरजों मोनगासिना नङा — बेयाव टिप हो।",
  },
  sortit: {
    title: "स्रांनाय जागा",
    instruction: "गासै खोलबिखौ आरो गोजौ बांसियाव दोन।",
  },
  stroop: {
    title: "गोजौनि गोखो",
    instruction: "आबाखौ नागिर होना, लिरनाय गोजौखौ टिप हो।",
  },
  trail: {
    title: "गेदेरनि बिह्याय",
    instruction: "गेदेरखौ क्रमनै टिप हो: 1, 2, 3…",
  },
  melody: {
    title: "गैंजाखौ फिनजाय",
    instruction: "गैंजाखौ मोनज्ला, उनाव गनसान गैंजाखौ फिनानै बायजायलाय।",
  },
  sequence: {
    title: "नोखोदनि क्रम",
    instruction: "क्रमखौ नु, उनाव गनसान क्रमजों खोलबिफोरखौ टिप हो।",
  },
  clock: {
    title: "समाय फोरियाय",
    instruction: "सन्देखौ फोरियाय, उनाव गनसान समायखौ बासिख।",
  },
  spot: {
    title: "सोलायनाय सिनाय",
    instruction: "कलानि उनाव मोनसे टाइल सोलायजादों — सोलायजानाय टाइलयाव टिप हो।",
  },
  wordrecall: {
    title: "आबो गोसांएरनाय",
    instruction: "बे आबोफोर थाखान नुहोनगोन — नुगोन आबोफोरखौ टिप हो।",
  },
  follow: {
    title: "जेनखोबनि उननि लिर",
    instruction: "जेनखोबफोरखौ नु, उनाव गनसान क्रमजों प्याडफोरखौ टिप हो।",
  },
  shadow: {
    title: "सानसोखोनि सिनाय",
    instruction: "लायनायजों मोनगासिना सानसोखोयाव टिप हो।",
  },
  reaction: {
    title: "साफायै टिप",
    instruction: "स्क्रीन हांरानि सोमाव गनसान टिप हो — थानायनि आगो नङा।",
  },
  wordbuilder: {
    title: "आबो बानाय",
    instruction: "आखरफोरखौ क्रमनै टिप होनानै आबोखौ बाय।",
  },
  category: {
    title: "खान्थियाव स्रांनाय",
    instruction: "गासै खोलबिखौ आरो खान्थियाव दोन।",
  },
  emotion: {
    title: "बेथांनि सिनाय",
    instruction: "आखाजों मोनगासिना बेथाखौ बासिख।",
  },
  target: {
    title: "लायनाय सिनाय",
    instruction: "ग्रिडखौ नुथि, उनाव लायनायजों मोनगासिना खोलबयाव टिप हो।",
  },
  order: {
    title: "क्रमनै दैथाय",
    instruction: "थुलुङफोरखौ आरो स्वभाविक क्रमनै टिप हो।",
  },
};

/** Bodo Memory Lane — only the fields needed for play are localized;
 *  stories/asks fall back to English pending native review. */
const BRX_MEMORY: MemoryLaneTexts = {
  takeMeBack: "गुबुन सोमयखियाव थानो…",
  talkTogether: "खंग्लाइजों बेनि सायाव आखियार खालाम ♥",
  cards: [
    {
      title: "रेडियोनि गाज्रि",
      question: "गाज्रि सोमयाव खंग्लाइनि रेडियो बाजायब्ला गासैसिन मा खालामो?",
      correct: "थामासे दानानै मोनज्लायो",
      distractors: ["सणहुं हारनो थांगो", "बंद खालामो", "बाहायाव खेलनो धावो"],
    },
    {
      title: "फफुनानि साकी",
      question: "फफुनानि सोमयाव दबसोलनि खुंआव आगो मा गोथो?",
      correct: "मोनसे बय साकी",
      distractors: ["टेलीभिजन", "टर्वि", "सदावनि ब्रानि"],
    },
    {
      title: "चानि सोमय",
      question: "गाज्रि सोमयाव बालोसिनिखुं आगोसोमाव मा होयो?",
      correct: "मोनसे चाबोदो चा",
      distractors: ["खेरदानि", "मोनसे खान्थि", "छाताफा"],
    },
    {
      title: "नायगोनि साइकिल",
      question: "साइकिल खालामनो सोसोननाय सोमयाव सिटखौ दोलोमानै बिनायाव सोर धावोमोन?",
      correct: "गबसिन फुखुरा बिफा",
      distractors: ["बेसेबि गासिना नङा", "हुकुसि", "बिजाबनि आगेइदा"],
    },
    {
      title: "बोरखानि गाज्रि",
      question: "नायगोनि जखगारा उनाव लोनसाइफोरा दोनयाव मा फंबाइखानो धावोमोन?",
      correct: "हाजनि दंगनाफोर",
      distractors: ["सिबनि आईसा", "जांखाफोर", "खुसनि साकी"],
    },
    {
      title: "हाराइनि सोलिनि",
      question: "हारानि सोमयाव सोर बुंमोन 'आरो बायसाया हारिनि दिनफोरनि '...",
      correct: "आनु",
      distractors: ["दुहुरासि", "बिदियालयनि मादाय", "बेसेबि गासिना नङा"],
    },
    {
      title: "दुनायनि गैंजा",
      question: "खंग्लाइनि दुनायजों गोबाइ हारानि सोमयाव फोंदामोड़ायाव मा गिबैनदों?",
      correct: "गैंजा आरो जांखुलायनाय",
      distractors: ["थाखरगंनाय", "गनायनि काम", "बोरखा"],
    },
    {
      title: "फालिकुनि बिदाब",
      question: "बिदियालयनि फालिकुनि बिदाबखौ जासाना माब्लैयाव सोननो जादोंमोन?",
      correct: "आनु-बिबोनि गांआयाव",
      distractors: ["क्लासरूमयाव", "हालियाव", "ओराइजाहाराव सगारिदब्ला"],
    },
    {
      title: "बजारनि गाज्रि",
      question: "आनुनि भाजिफोरनि बजारियाव मा लायोमोन?",
      correct: "मोनसे बाहानि बांसि",
      distractors: ["सुटकेस", "बाल्ति", "छातानि स्टेण्ड"],
    },
    {
      title: "बिस्नुनि हारि",
      question: "बिस्नु सोमयाव गासै थालियानि मा गामखोनदों?",
      correct: "रिंनांङै गोबोदानि लाङ",
      distractors: ["दारजाइनानै मेगाम", "हांरा", "गोजौत्ताई पताका"],
    },
    {
      title: "गोबां जेगानि खान्थि",
      question: "टेलिफोन मायाजानै थानायनि आगो खंग्लाइसो गोजौ मिरिनखौ माबजों खान्थियोमोन?",
      correct: "डाकजोंनि — मोनसे खान्थि",
      distractors: ["भिडियो कालजों", "मेसेजजों", "इमेलजों"],
    },
    {
      title: "गुबुन गोबांगौनि गामाय",
      question: "दानसिनि दाननि गोलानि सोमयाव सोरबो फोरियाफोरा माब्लैयाव जुमसोनो?",
      correct: "गामायनि गोबांगौनि गामायआव",
      distractors: ["साननि खियाव", "फ्रीजनि सिजाउ", "बस स्टपयाव"],
    },
  ],
};

/**
 * Meiteilon (mni). The game content pack for mni is intentionally not
 * shipped yet — hand-typed Meitei Mayek is too error-prone without a
 * native reviewer. `gameTitle()/gameInstruction()/memoryCards()` fall
 * back to English per-field, exactly the policy documented in
 * lib/i18n/locales.ts; add a `mni` entry here after the native pass.
 */

/** Per-locale game title + instruction (mni falls back to English). */
export const GAME_STRINGS: Record<"en", Record<GameId, GamePhrases>> &
  Partial<Record<Locale, Record<GameId, GamePhrases>>> = {
  en: EN_GAMES,
  as: AS,
  bn: BN,
  hi: HI,
  brx: BRX,
};

const MEMORY_TEXTS: Record<"en", MemoryLaneTexts> &
  Partial<Record<Locale, MemoryLaneTexts>> = {
  en: {
    takeMeBack: "Take yourself back…",
    talkTogether: "Talk about it together ♥",
    cards: EN_MEMORY.map(({ title, question, correct, distractors, story, ask }) => ({
      title,
      question,
      correct,
      distractors,
      story,
      ask,
    })),
  },
  as: AS_MEMORY,
  bn: BN_MEMORY,
  hi: HI_MEMORY,
  brx: BRX_MEMORY,
};

/** Full localized Memory Lane bank: same ids/scenes/tints as English,
 *  with text from the active locale falling back to English per field. */
export function memoryCards(
  locale: Locale,
): readonly (MemoryCardShell & {
  title: string;
  question: string;
  correct: string;
  distractors: readonly string[];
  story: string;
  ask: string;
})[] {
  const texts = MEMORY_TEXTS[locale] ?? MEMORY_TEXTS.en;
  return EN_MEMORY.map((shell, i) => {
    const localized = texts.cards[i] ?? {};
    return {
      ...shell,
      title: localized.title ?? shell.title,
      question: localized.question ?? shell.question,
      correct: localized.correct ?? shell.correct,
      distractors: localized.distractors ?? shell.distractors,
      story: localized.story ?? shell.story,
      ask: localized.ask ?? shell.ask,
    };
  });
}

/** Localized Memory Lane UI strings (fallbacks to English). */
export function memoryLaneTexts(locale: Locale): MemoryLaneTexts {
  const preferred = MEMORY_TEXTS[locale] ?? MEMORY_TEXTS.en;
  return {
    takeMeBack: preferred.takeMeBack || MEMORY_TEXTS.en.takeMeBack,
    talkTogether: preferred.talkTogether || MEMORY_TEXTS.en.talkTogether,
    cards: memoryCards(locale),
  };
}

/** Localized title for a game. */
export function gameTitle(id: GameId, locale: Locale): string {
  return GAME_STRINGS[locale]?.[id]?.title ?? GAME_STRINGS.en[id]?.title ?? id;
}

/** Localized instruction banner for a game. */
export function gameInstruction(id: GameId, locale: Locale): string {
  return GAME_STRINGS[locale]?.[id]?.instruction ?? GAME_STRINGS.en[id]?.instruction ?? "";
}