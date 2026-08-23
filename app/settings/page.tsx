"use client";

import { useState } from "react";
import {
  Download,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, SegmentedControl, Switch } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/modal";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/components/ui/toast";
import {
  clearAllData,
  getAllAssets,
  getPeople,
  putAsset,
  createPerson,
} from "@/lib/storage/profiles";
import {
  EXPORT_SCHEMA_VERSION,
  validateAndParseImport,
} from "@/lib/storage/data-transfer";
import type { PersonProfile } from "@/lib/types/person";

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const people = await getPeople();
      if (people.length === 0) {
        toast("There’s nothing to export yet.", "info");
        return;
      }
      const assets = await getAllAssets();
      const assetsByPerson = new Map<string, typeof assets>();
      for (const asset of assets) {
        const list = assetsByPerson.get(asset.personId) ?? [];
        list.push(asset);
        assetsByPerson.set(asset.personId, list);
      }

      const profiles: unknown[] = [];
      for (const person of people) {
        const photos: Record<string, string> = {};
        if (person.photoThumb && person.photoThumb.length < 400_000) {
          photos.profile = person.photoThumb;
        }
        for (const asset of assetsByPerson.get(person.id) ?? []) {
          try {
            const { blobToDataURL } = await import("@/lib/utils/image");
            photos[asset.id] = await blobToDataURL(asset.blob);
          } catch {
            // skip undecodable blobs — export continues
          }
        }
        profiles.push(serializeProfile(person, photos));
      }

      const bundle = {
        app: "MemoryAssist" as const,
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        profiles,
      };
      const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memoryassist-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast("Backup saved. Keep this file private.");
    } catch {
      toast("Export failed in this browser session.", "error");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast("That file isn’t valid JSON.", "error");
        return;
      }
      const result = validateAndParseImport(parsed);
      let added = 0;
      for (const profile of result.profiles) {
        try {
          await createPerson(profile);
          for (const asset of result.assets.filter((a) => a.personId === profile.id)) {
            await putAsset({
              id: asset.assetId,
              personId: profile.id,
              role: asset.role,
              blob: asset.blob,
              createdAt: new Date().toISOString(),
            });
          }
          added++;
        } catch {
          result.skipped.push(`${profile.name}: could not be written to storage.`);
        }
      }
      if (added > 0) {
        toast(`Restored ${added} ${added === 1 ? "person" : "people"} from backup.`);
      } else {
        toast("Nothing could be imported from that backup.", "error");
      }
      for (const issue of result.skipped.slice(0, 3)) toast(issue, "info");
    } catch {
      toast("Import failed unexpectedly.", "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <header className="animate-fade-up">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Settings</h1>
        <p className="mt-3 text-xl text-ink-soft">Gentle defaults, chosen carefully.</p>
      </header>

      <section aria-labelledby="recognition-heading" className="mt-10">
        <span id="recognition-heading" className="sr-only">Recognition</span>
        <SectionTitle title="Recognition" subtitle="How Companion Mode behaves." />
        <Card className="divide-y divide-line px-6 py-2 md:px-8">
          <Switch
            checked={settings.recognitionEnabled}
            onChange={(v) => update({ recognitionEnabled: v })}
            label="Recognition"
            description="Identify familiar people in Companion Mode."
          />
          <div className="py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">Recognition sensitivity</p>
                <p className="text-base text-ink-soft">More cautious means fewer mistaken identities.</p>
              </div>
              <SegmentedControl
                label="Recognition sensitivity"
                value={settings.sensitivity}
                onChange={(v) => update({ sensitivity: v })}
                options={[
                  { value: "cautious", label: "Cautious" },
                  { value: "balanced", label: "Balanced" },
                  { value: "permissive", label: "Permissive" },
                ]}
              />
            </div>
          </div>
        </Card>
      </section>

      <section aria-labelledby="voice-heading" className="mt-12">
        <SectionTitle title="Voice guidance" subtitle="Spoken locally by your browser." />
        <Card className="divide-y divide-line px-6 py-2 md:px-8">
          <Switch
            checked={settings.voiceEnabled}
            onChange={(v) => update({ voiceEnabled: v })}
            label="Voice announcements"
            description="Say the person's name and relationship when recognized."
          />
          <div className="border-t border-line py-5">
            <Field label="Speaking speed">
              <SegmentedControl
                label="Speaking speed"
                value={settings.speechRate}
                onChange={(v) => update({ speechRate: v })}
                options={[
                  { value: "slow", label: "Slow" },
                  { value: "normal", label: "Normal" },
                  { value: "fast", label: "Fast" },
                ]}
              />
            </Field>
          </div>
          <Switch
            checked={settings.soundCues}
            onChange={(v) => update({ soundCues: v })}
            label="Soft sound cue"
            description="A gentle tone when someone becomes recognized."
          />
        </Card>
      </section>

      <section aria-labelledby="accessibility-heading" className="mt-12">
        <SectionTitle title="Accessibility" />
        <span id="accessibility-heading" className="sr-only">Accessibility settings</span>
        <Card className="divide-y divide-line px-6 py-2 md:px-8">
          <Switch
            checked={settings.largeText}
            onChange={(v) => update({ largeText: v })}
            label="Large text"
            description="Bigger names and words in Companion Mode."
          />
          <Switch
            checked={settings.highContrast}
            onChange={(v) => update({ highContrast: v })}
            label="High contrast"
            description="Maximum contrast colors throughout the app."
          />
          <Switch
            checked={settings.reduceMotion}
            onChange={(v) => update({ reduceMotion: v })}
            label="Reduce motion"
            description="Minimize animations and transitions."
          />
        </Card>
      </section>

      <section className="mt-12 rounded-3xl border border-teal-200 bg-teal-50/60 p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-xl font-bold text-teal-900">
          <ShieldCheck className="h-6 w-6 shrink-0" aria-hidden />
          Privacy mode is always on
        </h2>
        <p className="mt-2 text-lg leading-relaxed text-teal-900/80">
          Camera frames never leave this device and profiles live in local browser storage.
        </p>
      </section>

      <section aria-labelledby="data-heading" className="mt-12 pb-16">
        <SectionTitle
          title="Your data"
          subtitle="Backups contain sensitive recognition data — keep them private."
        />
        <span id="data-heading" className="sr-only">Your data</span>
        <Card className="space-y-5 p-6 md:p-8">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="lg" onClick={() => void handleExport()} disabled={exporting}>
              <Download className="h-5 w-5" aria-hidden />
              {exporting ? "Preparing backup…" : "Export data"}
            </Button>
            <label className="inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-surface px-7 py-3.5 text-lg font-semibold shadow-soft transition-all hover:border-accent hover:text-accent disabled:opacity-50">
              <Upload className="h-5 w-5" aria-hidden />
              {importing ? "Restoring…" : "Import backup"}
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void handleImportFile(f);
                }}
              />
            </label>
          </div>
          <p className="flex items-start gap-2 text-base text-ink-soft">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
            Import validates every record and skips malformed entries safely.
          </p>
          <div className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
            <p className="text-lg font-semibold text-danger">Delete everything on this device</p>
            <Button variant="danger" className="mt-4" onClick={() => setConfirmWipe(true)}>
              <Trash2 className="h-5 w-5" aria-hidden />
              Delete all local data
            </Button>
          </div>
        </Card>
      </section>

      <section className="pb-20">
        <SectionTitle title="Advanced" />
        <Card className="px-6 py-2 md:px-8">
          <Switch
            checked={settings.developerMode}
            onChange={(v) => update({ developerMode: v })}
            label="Developer diagnostics"
            description="Shows technical recognition stats inside Companion Mode."
          />
        </Card>
      </section>

      <ConfirmDialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        onConfirm={async () => {
          try {
            await clearAllData();
            toast("All profiles and recognition data were deleted from this device.");
          } catch {
            toast("Could not delete data in this session.", "error");
          }
        }}
        title="Delete all local data?"
        body="This permanently removes every person, photo and recognition descriptor from this device. This cannot be undone."
        confirmLabel="Delete everything"
      />
    </div>
  );
}

function serializeProfile(person: PersonProfile, photos: Record<string, string>) {
  return {
    id: person.id,
    name: person.name,
    age: person.age,
    relationship: person.relationship,
    description: person.description,
    enrollmentPhotos: person.enrollmentPhotos.map((ep) => ({
      id: ep.id,
      addedAt: ep.addedAt,
    })),
    descriptors: person.descriptors,
    isDemo: person.isDemo === true,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    photoAssetId: person.photoAssetId,
    photos:
      person.photoThumb && person.photoThumb.length < 400_000 && !photos.profile
        ? { ...photos, profile: person.photoThumb }
        : photos,
  };
}
