"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  GitMerge,
  RefreshCcw,
  ScanFace,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/people/avatar";
import { PhotoDropzone, type PendingPhoto } from "@/components/people/photo-dropzone";
import { CameraCapture } from "@/components/people/camera-capture";
import {
  deletePerson,
  getAsset,
  getPeople,
  getPerson,
  mergePersonInto,
  putAsset,
  removeEnrollmentPhoto,
  rebuildDescriptors,
  updatePerson,
} from "@/lib/storage/profiles";
import { prepareUpload, makeThumb } from "@/lib/utils/image";
import { readinessOf, type PersonProfile } from "@/lib/types/person";

export default function PersonProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [person, setPerson] = useState<PersonProfile | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  // Other enrolled people — candidates for merging a duplicate profile away.
  const [candidates, setCandidates] = useState<PersonProfile[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPeople().then((all) => {
      if (!cancelled) setCandidates(all.filter((p) => p.id !== params.id));
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const load = useCallback(async () => {
    try {
      const found = await getPerson(params.id);
      if (!found) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setPerson(found);
      setNotFound(false);
      // Render stored enrollment photos as small thumbnails.
      const next: Record<string, string> = {};
      for (const photo of found.enrollmentPhotos) {
        try {
          const asset = await getAsset(photo.id);
          if (!asset) continue;
          if (photo.id === found.photoAssetId && found.photoThumb) continue;
          const prepared = await prepareUpload(asset.blob, 512);
          next[photo.id] = await makeThumb(prepared.canvas, 256);
          prepared.canvas.width = 0;
          prepared.canvas.height = 0;
        } catch {
          // photo unreadable — cell falls back to a numbered placeholder
        }
      }
      setThumbs(next);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddPhoto(photo: PendingPhoto) {
    if (!person) return;
    try {
      await putAsset({
        id: photo.id,
        personId: person.id,
        role: "enrollment",
        blob: photo.blob,
        createdAt: new Date().toISOString(),
      });
      await updatePerson(person.id, {
        enrollmentPhotos: [
          ...person.enrollmentPhotos,
          { id: photo.id, addedAt: new Date().toISOString() },
        ],
        descriptors: [...person.descriptors, photo.descriptor],
      });
      toast("Face found — recognition improved.");
      await load();
    } catch {
      toast("Couldn’t update the profile.", "error");
    }
  }

  async function handleRemovePhoto(photoId: string) {
    if (!person) return;
    try {
      await removeEnrollmentPhoto(person.id, photoId);
      await load();
      toast("Recognition photo removed.");
    } catch {
      toast("Couldn’t remove that photo.", "error");
    }
  }

  async function handleRebuild() {
    if (!person) return;
    setRebuilding(true);
    try {
      const { enrollFromBlob } = await import("@/lib/recognition/enrollment");
      const result = await rebuildDescriptors(person.id, enrollFromBlob);
      await load();
      if (result.ok > 0) {
        toast(
          `Rebuilt recognition from ${result.ok} photo${result.ok === 1 ? "" : "s"}.` +
            (result.failed ? ` ${result.failed} could not be read.` : ""),
          result.failed ? "info" : "success",
        );
      } else {
        toast("No stored photos were usable — try adding fresh ones.", "error");
      }
    } catch {
      toast("Rebuild failed. Recognition tools may not have loaded yet.", "error");
    } finally {
      setRebuilding(false);
    }
  }

  async function handleDelete() {
    if (!person) return;
    try {
      await deletePerson(person.id);
      toast(`${person.name}’s profile was deleted from this device.`);
      router.push("/caregiver");
    } catch {
      toast("Could not delete this profile.", "error");
    }
  }

  async function handleMerge() {
    if (!person || !mergeTargetId) return;
    setMerging(true);
    try {
      const target = candidates.find((c) => c.id === mergeTargetId);
      await mergePersonInto(person.id, mergeTargetId);
      toast(
        `Merged ${person.name} into ${target?.name ?? "the selected profile"}.\n` +
          "All their angles now recognize as one person.",
      );
      router.push(`/caregiver/person/${mergeTargetId}`);
    } catch {
      toast("Couldn't merge the profiles in this browser session. Is private browsing on?", "error");
      setMerging(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
        <Spinner className="text-accent" label="Loading profile…" />
      </div>
    );
  }

  if (notFound || !person) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 md:px-6">
        <EmptyState
          icon={<TriangleAlert className="h-8 w-8" aria-hidden />}
          title="Something went wrong"
          body="We couldn't load this profile. It may have been deleted on this device."
          action={
            <>
              <Button onClick={() => void load()}>Try again</Button>
              <ButtonLink href="/caregiver" variant="secondary">
                Back to dashboard
              </ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  const ready = readinessOf(person) === "ready";
  const maxPhotos = 4;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14 animate-fade-up">
      <Link
        href="/caregiver"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-2 text-base font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
        Dashboard
      </Link>

      <Card className="mt-6 p-6 md:p-10">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Avatar name={person.name} id={person.id} src={person.photoThumb ?? null} size="xl" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            {person.isDemo && (
              <span className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                Demo data · add a photo to enable recognition
              </span>
            )}
            <h1 className="text-4xl font-extrabold tracking-tight">{person.name}</h1>
            <p className="mt-1 text-xl text-ink-soft">
              Your {person.relationship}
              {typeof person.age === "number" && ` · Age ${person.age}`}
            </p>
            <div className="mt-4">
              <StatusBadge tone={ready ? "ok" : "warn"} pulse={rebuilding}>
                {ready ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ScanFace className="h-4 w-4" aria-hidden />
                    Recognition ready · {person.descriptors.length}{" "}
                    {person.descriptors.length === 1 ? "face" : "faces"}
                  </span>
                ) : (
                  "Not enrolled for recognition"
                )}
              </StatusBadge>
            </div>
          </div>
        </div>

        {person.description && (
          <div className="mt-8 rounded-2xl bg-surface-muted p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">About</h2>
            <p className="mt-2 text-xl leading-relaxed">{person.description}</p>
          </div>
        )}
      </Card>

      {/* Recognition photos */}
      <section aria-label="Recognition photos" className="mt-8">
        <Card className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight">Recognition photos</h2>
              <p className="mt-1 max-w-md text-base text-ink-soft">
                2–4 clear photos are usually enough for this prototype. Different natural angles help.
              </p>
            </div>
            {ready && (
              <Button variant="secondary" size="md" onClick={handleRebuild} disabled={rebuilding}>
                <RefreshCcw className={rebuilding ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
                Rebuild profile
              </Button>
            )}
          </div>

          {person.enrollmentPhotos.length > 0 && (
            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {person.enrollmentPhotos.map((photo, index) => (
                <li key={photo.id} className="group relative overflow-hidden rounded-2xl border border-line shadow-soft">
                  {thumbs[photo.id] ?? (index === 0 && person.photoThumb) ? (
                    <img
                      src={thumbs[photo.id] ?? person.photoThumb}
                      alt={`Recognition photo ${index + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center bg-surface-muted text-lg font-bold text-ink-soft">
                      #{index + 1}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove recognition photo ${index + 1}`}
                    onClick={() => void handleRemovePhoto(photo.id)}
                    className="absolute right-2 top-2 rounded-full bg-black/55 p-2 text-white opacity-100 transition-colors hover:bg-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {person.enrollmentPhotos.length < maxPhotos && (
            <div className="mt-6 space-y-4">
              <PhotoDropzone
                compact
                currentCount={person.enrollmentPhotos.length}
                maxPhotos={maxPhotos}
                onPhoto={(p) => void handleAddPhoto(p)}
              />
              <CameraCapture onPhoto={(p) => void handleAddPhoto(p)} />
            </div>
          )}
        </Card>
      </section>

      {/* Danger zone */}
      <section aria-label="Danger zone" className="mt-8 rounded-3xl border border-red-200 bg-red-50/40 p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-danger">
          <ShieldCheck className="h-6 w-6" aria-hidden />
          Danger zone
        </h2>
        <p className="mt-2 text-lg text-ink-soft">
          Deleting removes {person.name}’s profile, photos and recognition data from this device forever.
        </p>
        <Button variant="danger" size="lg" className="mt-6" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-5 w-5" aria-hidden />
          Delete profile
        </Button>

        <div className="mt-8 border-t border-red-200 pt-6">
          <p className="text-lg font-semibold text-danger">
            Merged {person.name} was enrolled twice by mistake?
          </p>
          <p className="mt-1 max-w-xl text-base text-ink-soft">
            If the same person was added more than once, combine them here. Their photos and
            recognition data move into the other profile, so every angle of their face settles on
            one identity again.
          </p>
          {candidates.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-surface-muted p-4 text-base text-ink-soft">
              No other profiles on this device to merge {person.name} into.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                aria-label="Choose the profile to merge into"
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="min-h-[44px] w-full rounded-2xl border border-line bg-night-card px-4 py-2.5 text-base outline-none transition-colors focus:border-accent sm:w-auto sm:min-w-[260px]"
              >
                <option value="">Choose a profile to receive the data…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.relationship}
                  </option>
                ))}
              </select>
              <Button
                variant="danger"
                size="md"
                disabled={!mergeTargetId || merging}
                onClick={() => setConfirmMerge(true)}
              >
                <GitMerge className="h-4 w-4" aria-hidden />
                {merging ? "Merging…" : `Merge ${person.name} into it`}
              </Button>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={`Remove ${person.name}?`}
        body={`This permanently removes ${person.name}'s profile and all recognition data from this device.`}
        confirmLabel="Delete everything"
      />

      <ConfirmDialog
        open={confirmMerge}
        onClose={() => setConfirmMerge(false)}
        onConfirm={handleMerge}
        title={`Merge ${person.name} into another profile?`}
        body={
          candidates.find((c) => c.id === mergeTargetId)
            ? `${person.name}'s photos and recognition data will move into ${candidates.find((c) => c.id === mergeTargetId)?.name}'s profile, and ${person.name}'s separate profile will be deleted. The stronger, combined profile keeps them recognizable from every angle.`
            : "This cannot be undone."
        }
        confirmLabel="Merge and combine"
      />

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-base text-ink-soft">
        Stored locally · never uploaded.
      </p>
    </div>
  );
}
