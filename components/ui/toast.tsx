"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";

type ToastKind = "success" | "info" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++counter.current;
    setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-8"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="animate-fade-up pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-ink px-5 py-3 text-base font-medium text-canvas shadow-lift"
          >
            {item.kind === "success" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />}
            {item.kind === "info" && <Info className="h-5 w-5 shrink-0 text-teal-300" />}
            {item.kind === "error" && <TriangleAlert className="h-5 w-5 shrink-0 text-rose-300" />}
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
