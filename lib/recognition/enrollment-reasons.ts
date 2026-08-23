export type EnrollmentFailureReason = "no-face" | "multiple-faces" | "face-too-small" | "unreadable";

/** Human guidance for enrollment validation outcomes. */
export const ENROLLMENT_REASONS: Record<
  EnrollmentFailureReason,
  { title: string; body: string }
> = {
  "no-face": {
    title: "No face found",
    body: "Choose a clear photo showing the person’s face.",
  },
  "multiple-faces": {
    title: "More than one face found",
    body: "Please choose a photo showing only one person.",
  },
  "face-too-small": {
    title: "The face is difficult to read",
    body: "Move closer or use better lighting, then try again.",
  },
  unreadable: {
    title: "This photo is too blurry to use",
    body: "Hold steady or retake it with better focus.",
  },
};
