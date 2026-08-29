"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import type { ThemeSetting } from "@/lib/settings/settings";

const ORDER: ThemeSetting[] = ["light", "dark", "system"];
const ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const LABEL = { light: "Light", dark: "Dark", system: "Auto" } as const;

/**
 * Compact theme switcher for the header. Cycles light → dark → auto so a
 * single tap flips the whole UI (the `.dark` class is toggled by
 * applyTheme). Auto follows the OS preference.
 */
export function ThemeToggle() {
  const { settings, update } = useSettings();
  const current = settings.theme;
  const Icon = ICON[current];

  const cycle = (): void => {
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    update({ theme: next });
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${LABEL[current]}. Tap to change.`}
      title={`Theme: ${LABEL[current]}`}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
