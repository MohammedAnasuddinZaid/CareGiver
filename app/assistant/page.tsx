"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bot,
  Brain,
  CalendarClock,
  Heart,
  LineChart,
  Send,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { respond, routeTip, type CompanionReply, type CompanionTone } from "@/lib/ai/model";
import {
  applyPatch,
  loadProfile,
  resetProfile,
  saveProfile,
  type AIProfile,
} from "@/lib/ai/store";
import { gatherContext, type DeviceContext } from "@/lib/ai/context";
import {
  appendChat,
  clearMemory,
  extractFacts,
  loadMemory,
  rememberFacts,
  recallFacts,
  type AIMemory,
} from "@/lib/ai/memory";
import { GAME_ROUTES, GAME_TITLES } from "@/components/games/game-meta";
import { GAME_META, type GameId } from "@/lib/games/types";

interface Msg {
  id: number;
  from: "ai" | "user";
  text: string;
  tone?: CompanionTone;
  quick?: string[];
  suggestGame?: string;
}

const TONE_GRADIENT: Record<CompanionTone, string> = {
  greet: "from-teal-400 to-emerald-500",
  empathize: "from-violet-400 to-fuchsia-500",
  calm: "from-sky-400 to-cyan-500",
  coach: "from-amber-400 to-orange-500",
  suggest: "from-emerald-400 to-teal-500",
  celebrate: "from-pink-400 to-rose-500",
  chat: "from-teal-400 to-cyan-500",
};

const DOMAIN_SHORT: Record<string, string> = {
  memory: "Memory",
  working: "Working memory",
  attention: "Attention",
  executive: "Planning",
  spatial: "Spatial",
};

const QUICK_STARTERS = [
  "Plan my day",
  "Am I improving?",
  "Read my reports",
  "Suggest a game",
  "I don't remember things",
  "Cheer me up",
];

export default function AssistantPage() {
  const [profile, setProfile] = useState<AIProfile | null>(null);
  const [ctx, setCtx] = useState<DeviceContext | null>(null);
  const [memory, setMemory] = useState<AIMemory>({ facts: [], chats: [] });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    setProfile(loadProfile());
    void gatherContext().then(setCtx);
    // Long-term memory (IndexedDB) — facts + chat history across sessions.
    void loadMemory().then((mem) => {
      setMemory(mem);
      if (mem.chats.length > 0) {
        restoredRef.current = true;
        setMessages(
          mem.chats.map((c) =>
            toMsg(c.role as Msg["from"], {
              text: c.text,
              tone: (c.tone ?? "chat") as CompanionTone,
            }),
          ),
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open with a warm greeting once memory and live data are both in.
  // restoredRef is true when loadMemory brought back old chats — skip greeting.
  useEffect(() => {
    if (!profile || !ctx || messages.length > 0 || restoredRef.current) return;
    const nameFact = memory.facts.find((f) => f.key === "name");
    const displayName = nameFact ? nameFact.value : profile.name;
    const name = displayName ? `, ${displayName}` : "";
    setMessages([
      toMsg("ai", {
        text: `Hi${name}! I'm your CareGiver Assistant, here to help. Ask me to plan your day, read your progress, suggest a game, or explain anything about the app — I answer from what's on your device alone.`,
        tone: "greet",
        quick: QUICK_STARTERS,
      }),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, ctx]);

  // Autoscroll the message list only (never jump the page on load).
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => () => void (timerRef.current && clearTimeout(timerRef.current)), []);

  const toMsg = (from: Msg["from"], r: CompanionReply | string): Msg => ({
    id: idRef.current++,
    from,
    text: typeof r === "string" ? r : r.text,
    tone: typeof r === "string" ? undefined : r.tone,
    quick: typeof r === "string" ? undefined : r.quick,
    suggestGame: typeof r === "string" ? undefined : r.suggestGame,
  });

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !profile) return;
      setMessages((m) => [...m, toMsg("user", trimmed)]);
      setInput("");
      setTyping(true);
      const current = profile;
      const currentMemory = memory;

      // Extract and remember any facts the person shared (name, family, hobbies).
      const extracted = extractFacts(trimmed);
      if (extracted.length > 0) {
        void rememberFacts(extracted).then(() => {
          setMemory((prev) => {
            const byKey = new Map(prev.facts.map((f) => [f.key, f]));
            for (const f of extracted) byKey.set(f.key, { key: f.key, value: f.value, ts: Date.now() });
            return { ...prev, facts: Array.from(byKey.values()) };
          });
        });
      }

      // Persist the user message to long-term chat history.
      void appendChat({ role: "user", text: trimmed });

      timerRef.current = setTimeout(async () => {
        let device: DeviceContext | null = null;
        try {
          device = await gatherContext();
          setCtx(device);
        } catch {
          device = null;
        }
        const { reply, patch } = respond(
          { message: trimmed, route: "/assistant" },
          current,
          device,
          {
            facts: recallFacts(currentMemory.facts),
            chats: currentMemory.chats.slice(-6),
          },
        );
        const next = applyPatch(current, patch);
        saveProfile(next);
        setProfile(next);
        setTyping(false);
        setMessages((m) => [...m, toMsg("ai", reply)]);

        // Persist the AI reply + updated facts so next session has full context.
        void appendChat({ role: "ai", text: reply.text, tone: reply.tone });
        const aiFacts = extracted.filter((f) => f.key === "name");
        if (aiFacts.length > 0) {
          void rememberFacts(aiFacts);
        }
      }, 380);
    },
    [profile, memory],
  );

  const forget = () => {
    setProfile(resetProfile());
    setCtx(null);
    setMemory({ facts: [], chats: [] });
    restoredRef.current = false;
    void gatherContext().then(setCtx);
    void clearMemory();
    setMessages([toMsg("ai", routeTip("/assistant", resetProfile()))]);
  };

  const last = messages[messages.length - 1];
  const busy = !profile || typing;
  const ready = profile !== null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14 animate-fade-up">
      {/* Header */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Your private assistant
          </p>
          <h1 className="text-shimmer mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
            Assistant
          </h1>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">
            Plans your day, understands the whole app, reads your progress and
            points you to the right game — all privately on this device.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_STARTERS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => void send(q)}
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-accent disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </header>

      {/* Live dashboard */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Your overview">
        <StatCard
          icon={<Heart className="h-5 w-5" aria-hidden />}
          label="People"
          value={ctx ? String(ctx.people.total) : "…"}
          hint={
            ctx
              ? ctx.people.total === 0
                ? "Add someone to get started"
                : `${ctx.people.recognized} with recognition`
              : "loading"
          }
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" aria-hidden />}
          label="Reminders"
          value={ctx ? `${ctx.reminders.enabled}/${ctx.reminders.total}` : "…"}
          hint={ctx ? (ctx.reminders.total === 0 ? "None set yet" : "Enabled / total") : "loading"}
        />
        <StatCard
          icon={<LineChart className="h-5 w-5" aria-hidden />}
          label="Sessions"
          value={ctx ? String(ctx.progress.gamesPlayed) : "…"}
          hint={
            ctx
              ? ctx.progress.gamesPlayed === 0
                ? "Play a game to begin"
                : `${ctx.progress.uniqueGames} games explored`
              : "loading"
          }
        />
        <StatCard
          icon={<Brain className="h-5 w-5" aria-hidden />}
          label="Strongest area"
          value={
            ctx
              ? ctx.progress.strengthDomain
                ? DOMAIN_SHORT[ctx.progress.strengthDomain] ?? "—"
                : "—"
              : "…"
          }
          hint={ctx ? (ctx.progress.strengthDomain ? "Best practiced" : "Play to discover") : "loading"}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Today's plan */}
        <section className="lg:col-span-2" aria-label="Today's plan">
          <Card className="flex h-full flex-col p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Sparkles className="h-5 w-5 text-accent" aria-hidden />
              Your day
            </h2>
            <p className="mt-1 text-base text-ink-soft">
              A gentle shape for today, from what&rsquo;s on this device right now.
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-surface-muted p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
                  Upcoming reminders
                </p>
                {ctx && ctx.reminders.nextFew.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {ctx.reminders.nextFew.map((r) => (
                      <li key={r.title + r.time} className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold text-ink">{r.title}</span>
                        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-bold text-accent">
                          {r.time}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-base text-ink-soft">
                    {ctx && ctx.reminders.total === 0
                      ? "No reminders set — the day is yours."
                      : "Nothing upcoming right now."}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
                  Games worth a few minutes
                </p>
                {ctx && ctx.progress.suggestedGameIds.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {ctx.progress.suggestedGameIds.map((id) => {
                      const title = GAME_TITLES[id];
                      const route = GAME_ROUTES[id];
                      const domain = GAME_META[id]?.domain ?? "memory";
                      if (!route) return null;
                      return (
                        <li key={id}>
                          <Link
                            href={`${route}?level=easy`}
                            className="group flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface-muted px-3.5 py-2.5 text-ink transition-colors hover:border-accent/70 hover:bg-accent-soft"
                          >
                            <span className="text-base font-semibold group-hover:text-accent">
                              {title}
                            </span>
                            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent">
                              {DOMAIN_SHORT[domain] ?? domain}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-base text-ink-soft">
                    Play any game on Easy — ask me below and I&rsquo;ll pick one.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button
                type="button"
                disabled={busy}
                onClick={() => void send("Plan my day")}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-base font-bold text-white shadow-soft transition-all hover:bg-accent-strong active:scale-[0.98] disabled:opacity-50"
              >
                <Sparkles className="h-5 w-5" aria-hidden />
                Plan my day in chat
              </button>
            </div>
          </Card>
        </section>

        {/* Chat */}
        <section className="lg:col-span-3" aria-label="Chat with the assistant">
          <div className="flex h-[560px] flex-col overflow-hidden rounded-3xl border border-line bg-canvas shadow-lift">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-accent-soft to-transparent px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-soft">
                <Bot className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold tracking-tight text-ink">
                  CareGiver Assistant
                </p>
                <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                  Online · answers from your device only
                </p>
              </div>
              {ready && (
                <button
                  type="button"
                  onClick={forget}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                  title="Forget what I've learned about you"
                >
                  Forget me
                </button>
              )}
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="ma-scroll flex-1 space-y-4 overflow-y-auto px-4 py-5"
            >
              {messages.map((m) => (
                <div key={m.id}>
                  {m.from === "ai" ? (
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-soft ${TONE_GRADIENT[m.tone ?? "chat"]}`}
                      >
                        <Bot className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-surface-muted px-4 py-3 text-[15px] leading-relaxed text-ink">
                        <RichText text={m.text} />
                        {m.suggestGame && GAME_ROUTES[m.suggestGame as GameId] && (
                          <Link
                            href={`${GAME_ROUTES[m.suggestGame as GameId]}?level=easy`}
                            className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-strong"
                          >
                            Open {GAME_TITLES[m.suggestGame as GameId]}
                            <span aria-hidden>→</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-snug text-white">
                        {m.text}
                      </div>
                    </div>
                  )}
                  {m.from === "ai" && m === last && m.quick && m.quick.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-10">
                      {m.quick.map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={busy}
                          onClick={() => void send(q)}
                          className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-accent disabled:opacity-50"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {typing && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-soft">
                    <Bot className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-surface-muted px-4 py-3.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-2 w-2 rounded-full bg-accent"
                        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-center gap-2 border-t border-line p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me to plan your day, check your progress, explain anything…"
                aria-label="Message your assistant"
                className="min-h-[44px] flex-1 rounded-full border border-line bg-surface-muted px-4 text-[15px] text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="Send"
                title="Send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-soft transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Renders AI answers: `•` bullets become tidy lists, blank lines split
 *  paragraphs — so answers feel readable instead of one long wall of text. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;
  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="my-1.5 space-y-1">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-[0.62em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            <span>{b}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      flush();
      continue;
    }
    if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
      bullets.push(trimmed.replace(/^[•\-*]\s*/, ""));
    } else if (bullets.length > 0) {
      // A non-bullet line between bullets ends the list.
      flush();
      bullets.push(trimmed);
    } else {
      blocks.push(
        <p key={`p-${key++}`} className="my-1">
          {trimmed}
        </p>,
      );
    }
  }
  flush();
  return <>{blocks}</>;
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4 md:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">{label}</p>
        <p className="truncate text-2xl font-extrabold tracking-tight">{value}</p>
        <p className="truncate text-sm text-ink-soft">{hint}</p>
      </div>
    </Card>
  );
}