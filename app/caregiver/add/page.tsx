"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheckBig,
  ScanFace,
  Trash2,
  UserCheck,
} from "lucide-react";
import clsx from "clsx";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PhotoDropzone, type PendingPhoto } from "@/components/people/photo-dropzone";
import { CameraCapture } from "@/components/people/camera-capture";
import { Avatar } from "@/components/people/avatar";
import { useToast } from "@/components/ui/toast";
import { RELATIONSHIPS } from "@/lib/types/person";
import type { PersonProfile } from "@/lib/types/person";
import {
  appendEnrollmentPhotos,
  createPerson,
  getPeople,
  putAssetsBulk,
} from "@/lib/storage/profiles";
import { recognitionConfig, thresholdFor } from "@/lib/recognition/config";
import { findLookalikeProfiles } from "@/lib/recognition/matching";

type Step = 0 | 1 | 2 | 3 | 4;

const STEP_LABELS = ["Who", "About", "Photos", "Review", "Ready"] as const;

export default function AddPersonPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [relationshipChoice, setRelationshipChoice] = useState<string>("Mother");
  const [customRelationship, setCustomRelationship] = useState("");
  const [age, setAge] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [errors, setErrors] = useState<{ name?: string; relationship?: string; age?: string }>({});
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // People already enrolled — used to catch the "same face, second profile"
  // mistake that breaks recognition for that person.
  const [people, setPeople] = useState<PersonProfile[]>([]);
  const [lookalike, setLookalike] = useState<PersonProfile | null>(null);
  const [processedLookalike, setProcessedLookalike] = useState(false);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPeople().then((all) => {
      if (!cancelled) setPeople(all);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Whenever a new photo arrives (or is removed), re-check whether the
  // whole set clearly matches someone who is already enrolled.
  useEffect(() => {
    let cancelled = false;
    setProcessedLookalike(false);
    setLookalike(null);
    if (photos.length === 0 || people.length === 0) return;
    void (async () => {
      const result = await findLookalikeProfiles(
        photos.map((p) => p.descriptor),
        people,
        thresholdFor(recognitionConfig.defaultSensitivity),
      );
      if (cancelled || !result) return;
      const match = people.find((p) => p.id === result.personId);
      if (match) setLookalike(match);
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, people]);

  const relationship =
    relationshipChoice === "Other"
      ? customRelationship.trim()
      : relationshipChoice;

  const maxPhotos = recognitionConfig.maxEnrollmentPhotos;

  // Show the "looks like an existing person" warning until the caregiver
  // acts on it — merge the photos in or explicitly keep a separate profile.
  const showLookalikeBanner = lookalike !== null && !processedLookalike;

  const validateWho = useCallback((): boolean => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "A name helps everyone feel recognized.";
    else if (name.trim().length > 80) next.name = "Please keep the name under 80 characters.";
    if (!relationship) next.relationship = "Choose a relationship or type your own.";
    if (age && !/^\d{1,3}$/.test(age)) next.age = "Enter an age between 0 and 130.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, relationship, age]);

  const addPhoto = useCallback(
    (photo: PendingPhoto) => {
      setPhotos((prev) => (prev.length >= maxPhotos ? prev : [...prev, photo]));
    },
    [maxPhotos],
  );

  const canContinue = useMemo(() => {
    if (lookalike && !processedLookalike) return false;
    if (step === 0) return true;
    if (step === 2) return photos.length > 0;
    return true;
  }, [step, photos.length, lookalike, processedLookalike]);

  async function handleMergeToExisting() {
    if (!lookalike || merging) return;
    setMerging(true);
    try {
      await appendEnrollmentPhotos(
        lookalike.id,
        photos.map((p) => ({ id: p.id, blob: p.blob, descriptor: p.descriptor })),
      );
      setSavedId(lookalike.id);
      setProcessedLookalike(true);
      setStep(4);
      toast(`Photos added to ${lookalike.name} — old AND new angles will recognize them.`);
    } catch {
      toast("Couldn't update the existing profile in this browser session. Is private browsing on?", "error");
    } finally {
      setMerging(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Profile first, then ALL blobs in a single all-or-nothing write.
      // (The old order stored orphan blobs with personId:"" and patched
      // them in a loop — a crash mid-loop stranded photos with no owner.)
      const profile = await createPerson({
        name: name.trim(),
        age: age ? Number(age) : undefined,
        relationship,
        description: description.trim() || undefined,
        enrollmentPhotos: photos.map((p) => ({ id: p.id, addedAt: new Date().toISOString() })),
        descriptors: photos.map((p) => p.descriptor),
        photoThumb: photos[0]?.thumb,
      });
      await putAssetsBulk(
        photos.map((p) => ({
          id: p.id,
          personId: profile.id,
          role: "enrollment" as const,
          blob: p.blob,
          createdAt: new Date().toISOString(),
        })),
      );
      setSavedId(profile.id);
      setStep(4);
      toast("Person added — stored locally.");
    } catch {
      toast("Couldn’t save in this browser session. Is private browsing on?", "error");
    } finally {
      setSaving(false);
    }
  }

  if (step === 4 && savedId) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center animate-fade-up">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CircleCheckBig className="h-12 w-12" aria-hidden />
        </span>
        <h1 className="mt-8 text-4xl font-extrabold tracking-tight">{name} is ready to be recognized.</h1>
        <p className="mt-4 text-xl text-ink-soft">
          A local recognition profile was created from {photos.length}{" "}
          {photos.length === 1 ? "photo" : "photos"}. Nothing was uploaded.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href={`/caregiver/person/${savedId}`} variant="secondary">
            View profile
          </ButtonLink>
          <ButtonLink href="/caregiver">Go to dashboard</ButtonLink>
          <ButtonLink href="/recognition" size="lg">
            <ScanFace className="h-5 w-5" aria-hidden />
            Open Companion Mode
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-6 md:py-14">
      <Link
        href="/caregiver"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-2 text-base font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
        Dashboard
      </Link>

      {/* Progress */}
      <ol aria-label={`Step ${step + 1} of ${STEP_LABELS.length}`} className="mt-6 flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={i === step ? "step" : undefined}
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                i < step || step === 4
                  ? "bg-accent text-white"
                  : i === step
                    ? "bg-accent text-white ring-4 ring-accent/20"
                    : "bg-surface-muted text-ink-soft",
              )}
            >
              {i < step || step === 4 ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
            <span className="hidden text-sm font-semibold text-ink-soft sm:block">{label}</span>
            {i < STEP_LABELS.length - 1 && (
              <span aria-hidden className={clsx("h-0.5 flex-1 rounded", i <= step ? "bg-accent/40" : "bg-line")} />
            )}
          </li>
        ))}
      </ol>

      <Card className="mt-8 p-6 md:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
        {step === 0 && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Who is this person?</h1>
            <p className="mt-2 text-lg text-ink-soft">Create a profile CareGiver can use to recognize them later.</p>
            <div className="mt-8 space-y-6">
              <Field label="Name" htmlFor="name" error={errors.name}>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sam"
                  maxLength={80}
                  autoComplete="off"
                />
              </Field>
              <Field label="Relationship" htmlFor="relationship" error={errors.relationship}>
                <Select
                  id="relationship"
                  value={relationshipChoice}
                  onChange={(e) => setRelationshipChoice(e.target.value)}
                >
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel === "Other" ? "Other…" : rel}
                    </option>
                  ))}
                </Select>
              </Field>
              {relationshipChoice === "Other" && (
                <Field label="Describe the relationship" htmlFor="customRel">
                  <Input
                    id="customRel"
                    value={customRelationship}
                    onChange={(e) => setCustomRelationship(e.target.value)}
                    placeholder="Uncle, neighbor, doctor…"
                    maxLength={60}
                  />
                </Field>
              )}
              <Field label="Age (optional)" htmlFor="age" error={errors.age} hint="Shown gently on their card.">
                <Input id="age" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="52" />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Tell CareGiver about them</h1>
            <p className="mt-2 text-lg text-ink-soft">One kind sentence is perfect — it appears when they’re recognized.</p>
            <div className="mt-8">
              <Field
                label="Description (optional)"
                htmlFor="description"
                hint="Keep this short and familiar."
              >
                <Textarea
                  id="description"
                  value={description}
                  maxLength={240}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Your mother. She loves gardening and usually wears glasses."
                />
              </Field>
              <p className="mt-2 text-right text-sm text-ink-soft">{description.length}/240</p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Add a recognition photo</h1>
            <p className="mt-2 text-lg text-ink-soft">
              1–{maxPhotos} clear photos are enough. Each one is analyzed privately on this device.
            </p>
            <div className="mt-8 space-y-6">
              <PhotoDropzone onPhoto={addPhoto} currentCount={photos.length} maxPhotos={maxPhotos} />
              <div className="flex items-center gap-4">
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="text-base font-medium text-ink-soft">or</span>
                <span className="h-px flex-1 bg-line" aria-hidden />
              </div>
              <CameraCapture
                onPhoto={addPhoto}
                disabled={photos.length >= maxPhotos || saving}
              />
              {photos.length > 0 && (
                <>
                  {showLookalikeBanner && (
                    <LookalikeBanner
                      person={lookalike}
                      merging={merging}
                      onMerge={handleMergeToExisting}
                      onKeepNew={() => setProcessedLookalike(true)}
                    />
                  )}
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label="Recognition photos">
                    {photos.map((photo) => (
                      <li key={photo.id} className="group relative overflow-hidden rounded-2xl border border-line shadow-soft">
                        <img src={photo.thumb} alt="Added face preview" className="aspect-square w-full object-cover" />
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2.5 py-1 text-xs font-bold text-white">
                          <Check className="h-3.5 w-3.5" aria-hidden /> Face found
                        </span>
                        <button
                          type="button"
                          aria-label="Remove this photo"
                          onClick={() => setPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                          className="absolute right-2 top-2 rounded-full bg-black/55 p-2 text-white opacity-0 transition-opacity hover:bg-danger focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Review &amp; save</h1>
            <p className="mt-2 text-lg text-ink-soft">Everything stays on this device.</p>
            {showLookalikeBanner && (
              <div className="mt-6">
                <LookalikeBanner
                  person={lookalike}
                  merging={merging}
                  onMerge={handleMergeToExisting}
                  onKeepNew={() => setProcessedLookalike(true)}
                />
              </div>
            )}
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
              <Avatar name={name || "?"} id={name || "preview"} src={photos[0]?.thumb ?? null} size="lg" />
              <dl className="min-w-0 flex-1 space-y-2 text-lg">
                <div><dt className="inline font-semibold">Name: </dt><dd className="inline text-ink-soft">{name}</dd></div>
                <div><dt className="inline font-semibold">Relationship: </dt><dd className="inline text-ink-soft">{relationship}</dd></div>
                {age && <div><dt className="inline font-semibold">Age: </dt><dd className="inline text-ink-soft">{age}</dd></div>}
                {description && <div><dt className="inline font-semibold">About: </dt><dd className="inline text-ink-soft">{description}</dd></div>}
                <div><dt className="inline font-semibold">Photos: </dt><dd className="inline text-ink-soft">{photos.length} analyzed</dd></div>
              </dl>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ArrowLeft className="h-5 w-5" aria-hidden />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button
              size="lg"
              disabled={!canContinue}
              onClick={() => {
                if (step === 0 && !validateWho()) return;
                setStep((s) => (s + 1) as Step);
              }}
            >
              Continue
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          ) : (
            <Button size="lg" onClick={handleSave} disabled={saving || showLookalikeBanner}>
              {saving ? "Saving locally…" : showLookalikeBanner ? "Looks like someone you know — make a choice above" : "Save person"}
              {!saving && <ArrowRight className="h-5 w-5" aria-hidden />}
            </Button>
          )}
        </div>
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
}

function LookalikeBanner({
  person,
  merging,
  onMerge,
  onKeepNew,
}: {
  person: PersonProfile;
  merging: boolean;
  onMerge: () => void;
  onKeepNew: () => void;
}) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 shadow-soft md:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <UserCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-snug text-amber-900">
            These photos look like {person.name}, who is already enrolled.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">
            Adding them as a new person would split their recognition — one
            head turn might show {person.name}, another a copy. Add these
            photos to {person.name}&rsquo;s existing profile instead so every
            angle stays one person.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="md" onClick={onMerge} disabled={merging}>
              {merging ? "Adding to existing profile…" : `Add to ${person.name}&rsquo;s profile`}
            </Button>
            <Button variant="ghost" size="md" onClick={onKeepNew} disabled={merging}>
              Keep as a new person
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
