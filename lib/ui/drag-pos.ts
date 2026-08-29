"use client";

/** Persists a draggable element's offset so it stays where the user parks it. */

export interface DragPos {
  x: number;
  y: number;
}

export function loadDragPos(key: string): DragPos {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw) as Partial<DragPos>;
      if (typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
    }
  } catch {
    /* ignore */
  }
  return { x: 0, y: 0 };
}

export function saveDragPos(key: string, pos: DragPos): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}
