"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CloudOff,
  Database,
  Download,
  Eye,
  ScanFace,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { clearAllData, countPeople } from "@/lib/storage/profiles";

const FACTS = [
  {
    icon: Database,
    title: "Profiles",
    body: "Stored only in this browser on this device.",
  },
  {
    icon: ScanFace,
    title: "Recognition",
    body: "Processed locally by your browser. No cloud recognition is used.",
  },
  {
    icon: Camera,
    title: "Camera",
    body: "Used only while Companion Mode is open. Frames are never recorded or uploaded.",
  },
  {
    icon: CloudOff,
    title: "Cloud & analytics",
    body: "None. There is no account, no server database and no tracking.",
  },
];

export default function PrivacyPage() {
  const { toast } = useToast();
  const [profileCount, setProfileCount] = useState<number | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    countPeople()
      .then(setProfileCount)
      .catch(() => setProfileCount(null));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <header className="animate-fade-up">
        <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-sm font-semibold text-teal-800">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Privacy Center
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Privacy first</h1>
        <p className="mt-4 text-xl leading-relaxed text-ink-soft">
          MemoryAssist is designed to keep recognition data on your device.
          The camera experience processes video locally, and your profiles are
          never designed to leave this browser.
        </p>
      </header>

      <section aria-label="Facts" className="mt-10 grid gap-4 sm:grid-cols-2">
        {FACTS.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="p-6">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-xl font-bold">{title}</h2>
            <p className="mt-1 text-lg leading-relaxed text-ink-soft">{body}</p>
          </Card>
        ))}
      </section>

      <section className="mt-10">
        <Card className="divide-y divide-line px-6 md:px-8">
          <FactRow label={`People stored right now`} value={profileCount === null ? "—" : `${profileCount} on this device`} />
          <FactRow label="Recognition descriptors" value="Stored locally alongside each person" />
          <FactRow label="Data sharing" value="None by default" />
          <FactRow label="Offline" value="Works after first visit — no connection needed for recognition" />
        </Card>
      </section>

      <section className="mt-10 rounded-3xl border border-line bg-surface p-6 md:p-8">
        <h2 className="text-2xl font-bold tracking-tight">Current prototype vs. planned local recognition</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-surface-muted p-5">
            <h3 className="font-bold uppercase tracking-widest text-sm text-ink-soft">Today</h3>
            <ul className="mt-3 space-y-2 text-lg text-ink-soft">
              <li>• Local face analysis during enrollment</li>
              <li>• Live camera recognition on-device</li>
              <li>• Export / import as a private backup file</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-teal-50 p-5 border border-teal-100">
            <h3 className="font-bold uppercase tracking-widest text-sm text-teal-800">Planned</h3>
            <ul className="mt-3 space-y-2 text-lg text-teal-900/80">
              <li>• The same engine adapted to smart glasses</li>
              <li>• Optional encrypted device backups</li>
              <li>• Caregiver-controlled retention limits</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-label="Data controls" className="mt-10 flex flex-wrap gap-3 pb-16">
        <ButtonLink href="/settings" variant="secondary" size="lg">
          <Download className="h-5 w-5" aria-hidden />
          Export data
        </ButtonLink>
        <button
          type="button"
          onClick={() => setConfirmWipe(true)}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-danger px-7 py-3.5 text-lg font-semibold text-white shadow-soft transition-all hover:brightness-110"
        >
          <Trash2 className="h-5 w-5" aria-hidden />
          Delete all data
        </button>
        <Link
          href="/about"
          className="inline-flex min-h-[52px] items-center gap-2 rounded-full px-6 py-3.5 text-lg font-semibold text-accent hover:bg-accent-soft/60"
        >
          <Eye className="h-5 w-5" aria-hidden />
          How recognition works
        </Link>
      </section>

      <p className="pb-16 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-lg leading-relaxed text-amber-900">
        <strong>Prototype notice.</strong> MemoryAssist is a prototype assistive
        tool and should not be relied upon as the sole method of identifying
        people or making safety-critical decisions.
      </p>

      <ConfirmDialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        onConfirm={async () => {
          try {
            await clearAllData();
            setProfileCount(0);
            toast("All local profiles and recognition data were deleted.");
          } catch {
            toast("Could not delete data in this session.", "error");
          }
        }}
        title="Delete all local data?"
        body="This permanently removes all people, photos and recognition data from this device."
        confirmLabel="Delete everything"
      />
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-4">
      <span className="text-lg font-semibold">{label}</span>
      <span className="text-lg text-ink-soft">{value}</span>
    </div>
  );
}
