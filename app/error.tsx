"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RefreshCcw, TriangleAlert } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in devtools; never shown raw to users.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 md:px-6">
      <EmptyState
        icon={<TriangleAlert className="h-8 w-8" aria-hidden />}
        title="Something went wrong"
        body="We couldn't load this part of MemoryAssist. Your saved people are safe on this device."
        action={
          <>
            <Button onClick={reset} size="lg">
              <RefreshCcw className="h-5 w-5" aria-hidden />
              Try again
            </Button>
            <ButtonLink href="/" variant="secondary" size="lg">
              Return home
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
