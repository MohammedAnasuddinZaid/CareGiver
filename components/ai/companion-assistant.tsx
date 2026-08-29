"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
} from "framer-motion";
import { Heart, Send, Sparkles, X } from "lucide-react";
import {
  respond,
  routeTip,
  type CompanionReply,
  type CompanionTone,
} from "@/lib/ai/model";
import {
  applyPatch,
  loadProfile,
  resetProfile,
  saveProfile,
  type AIProfile,
} from "@/lib/ai/store";
import { GAME_ROUTES, GAME_TITLES } from "@/components/games/game-meta";
import type { GameId } from "@/lib/games/types";
import { loadDragPos, saveDragPos } from "@/lib/ui/drag-pos";

interface Msg {
  id: number;
  from: "ai" | "user";
  text: string;
  tone?: CompanionTone;
  quick?: string[];
  suggestGame?: string;
}

const TONE_BUBBLE: Record<CompanionTone, string> = {
  greet: "from-teal-400 to-emerald-500",
  empathize: "from-violet-400 to-fuchsia-500",
  calm: "from-sky-400 to-cyan-500",
  coach: "from-amber-400 to-orange-500",
  suggest: "from-emerald-400 to-teal-500",
  celebrate: "from-pink-400 to-rose-500",
  chat: "from-teal-400 to-cyan-500",
};

export function CompanionAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<AIProfile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load memory once.
  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  // Greet when first opened (and once memory has loaded).
  useEffect(() => {
    if (open && profile && messages.length === 0) {
      const tip = routeTip(pathname, profile);
      setMessages([toMsg("ai", tip)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile]);

  // Autoscroll + focus.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    if (open) inputRef.current?.focus();
  }, [messages, typing, open]);

  const toMsg = (from: Msg["from"], r: CompanionReply | string): Msg => ({
    id: idRef.current++,
    from,
    text: typeof r === "string" ? r : r.text,
    tone: typeof r === "string" ? undefined : r.tone,
    quick: typeof r === "string" ? undefined : r.quick,
    suggestGame: typeof r === "string" ? undefined : r.suggestGame,
  });

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !profile) return;
      setMessages((m) => [...m, toMsg("user", trimmed)]);
      setInput("");
      setTyping(true);
      const current = profile;
      timerRef.current = setTimeout(() => {
        const { reply, patch } = respond({ message: trimmed, route: pathname }, current);
        const next = applyPatch(current, patch);
        saveProfile(next);
        setProfile(next);
        setTyping(false);
        setMessages((m) => [...m, toMsg("ai", reply)]);
      }, 520);
    },
    [pathname, profile],
  );

  const forget = () => {
    setProfile(resetProfile());
    setMessages([toMsg("ai", routeTip(pathname, resetProfile()))]);
  };

  const last = messages[messages.length - 1];

  // Draggable launcher — park it anywhere; position is remembered on-device.
  const dragControls = useDragControls();
  const launchBounds = useRef<HTMLDivElement>(null);
  const startPos = loadDragPos("ma.companion.pos.v1");
  const lx = useMotionValue(startPos.x);
  const ly = useMotionValue(startPos.y);

  return (
    <>
      {/* Full-viewport drag boundary (does not capture pointer events). */}
      <div ref={launchBounds} aria-hidden className="pointer-events-none fixed inset-0 z-[55]" />

      {/* Floating launcher */}
      <motion.button
        type="button"
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragConstraints={launchBounds}
        dragElastic={0.04}
        style={{ x: lx, y: ly }}
        onDragEnd={() => saveDragPos("ma.companion.pos.v1", { x: lx.get(), y: ly.get() })}
        onPointerDown={(e) => dragControls.start(e)}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close companion" : "Open AI companion — drag to move"}
        title="Drag to move · tap to open"
        className="fixed bottom-24 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-lift transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        <motion.span
          key={open ? "x" : "spark"}
          initial={{ rotate: -30, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
        >
          {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </motion.span>
        <span className="glow-pulse absolute inset-0 rounded-full" aria-hidden />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="fixed bottom-24 right-4 z-[60] flex h-[min(72vh,560px)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-white/40 bg-night-card/95 shadow-lift backdrop-blur-xl md:bottom-6 md:right-6"
            role="dialog"
            aria-label="AI companion chat"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-accent/20 to-transparent px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-soft">
                <Heart className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">Companion</p>
                <p className="truncate text-xs text-white/60">
                  Listens · learns · helps · on this device
                </p>
              </div>
              <button
                type="button"
                onClick={forget}
                className="rounded-full px-2 py-1 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Forget what I've learned"
              >
                Forget me
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="ma-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <div key={m.id}>
                  {m.from === "ai" ? (
                    <div className="flex items-end gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white">
                        <Heart className="h-3.5 w-3.5" />
                      </span>
                      <div
                        className={`rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2.5 text-sm leading-snug text-white`}
                      >
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
                        {m.text}
                      </div>
                    </div>
                  )}
                  {/* Quick replies only on the latest AI message */}
                  {m.from === "ai" && m === last && m.quick && m.quick.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-9">
                      {m.quick.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => send(q)}
                          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:border-accent/60 hover:bg-accent/20"
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
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white">
                    <Heart className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-3">
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-white/70"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                    />
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-white/70"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0.15 }}
                    />
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-white/70"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0.3 }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-white/10 p-3"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Talk to your companion…"
                aria-label="Message your companion"
                className="min-h-[44px] flex-1 rounded-full border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-accent/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-soft transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
