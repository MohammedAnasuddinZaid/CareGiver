import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 md:px-6">
      <EmptyState
        icon={<Compass className="h-8 w-8" aria-hidden />}
        title="This page doesn’t exist"
        body="The link may be old, but your people are exactly where you left them."
        action={
          <ButtonLink href="/" size="lg">
            Return home
          </ButtonLink>
        }
      />
    </div>
  );
}
