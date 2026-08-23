"use client";

import { useCallback, useRef, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, ImageUp, TriangleAlert } from "lucide-react";
import { ENROLLMENT_REASONS } from "@/lib/recognition/enrollment-reasons";

export interface PendingPhoto {
  id: string;
  blob: Blob;
  thumb: string;
  descriptor: number[];
}

type AnalyzeState =
  | { phase: "idle" }
  | { phase: "analyzing" }
  | { phase: "error"; message: string };

export function PhotoDropzone({
  onPhoto,
  maxPhotos,
  currentCount,
  compact = false,
}: {
  onPhoto: (photo: PendingPhoto) => void;
  maxPhotos?: number;
  currentCount?: number;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<AnalyzeState>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setState({ phase: "error", message: "That file isn’t an image. Please choose a JPG or PNG photo." });
        return;
      }
      setState({ phase: "analyzing" });
      try {
        const [{ enrollFromUpload }, imageUtils] = await Promise.all([
          import("@/lib/recognition/enrollment"),
          import("@/lib/utils/image"),
        ]);
        const result = await enrollFromUpload(file);
        if (!result.ok) {
          const reason = ENROLLMENT_REASONS[result.reason];
          setState({
            phase: "error",
            message: `${reason.title} — ${reason.body}`,
          });
          return;
        }
        // Store a modest thumbnail for instant UI rendering.
        let thumb: string;
        try {
          thumb = await imageUtils.makeThumb(result.canvas, 512);
        } catch {
          thumb = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("read failed"));
            reader.readAsDataURL(result.blob);
          });
        }
        onPhoto({
          id: `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          blob: result.blob,
          thumb,
          descriptor: result.descriptor,
        });
        setState({ phase: "idle" });
      } catch (error) {
        setState({
          phase: "error",
          message:
            error instanceof Error && /models/i.test(error.message)
              ? "Recognition tools couldn’t load. Please check your connection once so they can be cached."
              : "This photo couldn’t be processed. Try a different image.",
        });
      }
    },
    [onPhoto],
  );

  const disabled = (maxPhotos ?? Infinity) <= (currentCount ?? 0);

  return (
    <div>
      <button
        type="button"
        disabled={disabled || state.phase === "analyzing"}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={clsx(
          "flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed transition-all duration-200 text-center focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none",
          compact ? "px-6 py-8" : "px-8 py-14",
          dragging
            ? "border-accent bg-accent-soft/60 scale-[1.01]"
            : "border-line bg-surface-muted/60 hover:border-accent hover:bg-accent-soft/30",
        )}
        aria-label="Add a recognition photo"
      >
        {state.phase === "analyzing" ? (
          <>
            <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-accent border-t-transparent" aria-hidden />
            <span className="text-lg font-semibold">Checking photo…</span>
            <span className="text-base text-ink-soft">Running local face analysis.</span>
          </>
        ) : (
          <>
            <ImageUp className="h-10 w-10 text-accent" aria-hidden />
            <span className="text-lg font-semibold">
              {compact ? "Add another photo" : "Add a photo"}
            </span>
            {!compact && (
              <>
                <span className="max-w-sm text-base text-ink-soft leading-relaxed">
                  Choose a clear photo showing one person’s face. Good lighting helps.
                </span>
                <span className="text-sm text-ink-soft/80">
                  Drag & drop or click · JPG or PNG
                </span>
              </>
            )}
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {state.phase === "error" && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-base font-medium text-amber-900 border border-amber-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          {state.message}
        </p>
      )}
      {state.phase === "idle" && !compact && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
          Photos are analyzed privately on this device and never uploaded.
        </p>
      )}
    </div>
  );
}
