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
  Terminal,
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

const QUICK_STARTERS = [
  "Plan my day",
  "Read my reports",
  "Suggest a game",
  "Which game helps memory?",
];

export default function AssistantPage() {
  const [profile, setProfile] = useState<AIProfile | null>(null);
  const [ctx, setCtx] = useState<DeviceContext | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setProfile(loadProfile());
    void gatherContext().then(setCtx);
  }, []);

  // Open with a warm, helpful greeting once both memory and live data are in.
  useEffect(() => {
    if (!profile || !ctx || messages.length > 0) return;
    const name = profile.name ? `, ${profile.name}` : "";
    setMessages([
      toMsg("ai", {
        text: `Hi${name}! I'm your CareGiver Assistant — welcome to my home page. I can plan your day, read your progress reports, suggest games, and answer anything about how the app works. Everything I know stays on this device.`,
        tone: "greet",
        quick: QUICK_STARTERS,
      }),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, ctx]);

  // Autoscroll the message list only (never focus the input on load, so the
  // page never jumps).
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
        );
        const next = applyPatch(current, patch);
        saveProfile(next);
        setProfile(next);
        setTyping(false);
        setMessages((m) => [...m, toMsg("ai", reply)]);
      }, 480);
    },
    [profile],
  );

  const forget = () => {
    setProfile(resetProfile());
    setCtx(null);
    void gatherContext().then(setCtx);
    setMessages([toMsg("ai", routeTip("/assistant", resetProfile()))]);
  };

  const last = messages[messages.length - 1];
  const busy = !profile || typing;
  const ready = profile !== null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14 animate-fade-up">
      {/* Header */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent">
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
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent/60 hover:bg-accent-soft disabled:opacity-50"
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
          value={ctx ? (ctx.progress.strengthDomain ?? "—") : "…"}
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
                        <span className="text-base font-semibold">{r.title}</span>
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
                            className="group flex items-center justify-between gap-2 rounded-2xl border border-line bg-night-card px-3.5 py-2.5 transition-colors hover:border-accent/60 hover:bg-accent-soft/50"
                          >
                            <span className="text-base font-semibold group-hover:text-accent">
                              {title}
                            </span>
                            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent">
                              {domain}
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

        {/* Chat terminal */}
        <section className="lg:col-span-3" aria-label="Chat with the assistant">
          <div className="gradient-ring flex h-[560px] flex-col overflow-hidden rounded-3xl border border-white/40 bg-night-card/95 shadow-lift backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-accent/20 to-transparent px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-soft">
                <Bot className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-bold tracking-tight text-white">
                  care-giver ~ assistant
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                  Online · answers from your device only
                </p>
              </div>
              {ready && (
                <button
                  type="button"
                  onClick={forget}
                  className="rounded-full px-2.5 py-1.5 font-mono text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
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
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white ${TONE_GRADIENT[m.tone ?? "chat"]}`}
                      >
                        <Terminal className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 font-mono text-[13px] leading-relaxed text-white">
                        <span className="mr-1 select-none text-white/40">›</span>
                        {m.text}
                        {m.suggestGame && GAME_ROUTES[m.suggestGame as GameId] && (
                          <Link
                            href={`${GAME_ROUTES[m.suggestGame as GameId]}?level=easy`}
                            className="mt-2 block w-fit rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-strong"
                          >
                            Open {GAME_TITLES[m.suggestGame as GameId]} →
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm leading-snug text-white">
                        <span className="mr-1 select-none opacity-60">you:</span>
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
                          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:border-accent/60 hover:bg-accent/20 disabled:opacity-50"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {typing && (
                <div className="flex items-end gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white">
                    <Terminal className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-white/70"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
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
              className="flex items-center gap-2 border-t border-white/10 p-3"
            >
              <span className="select-none font-mono text-sm text-teal-300">$</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me to plan your day, find a game, explain anything…"
                aria-label="Message your assistant"
                className="min-h-[44px] flex-1 rounded-full border border-white/15 bg-white/5 px-4 font-mono text-sm text-white placeholder:text-white/40 focus:border-accent/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="Send"
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