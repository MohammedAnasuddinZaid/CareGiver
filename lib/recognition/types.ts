export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFace {
  box: FaceBox;
  descriptor: number[];
}

export type MatchStatus = "recognized" | "unknown";

export interface MatchOutcome {
  status: MatchStatus;
  personId: string | null;
  distance: number | null;
}

export interface ProfileLike {
  id: string;
  descriptors: unknown[];
}

export interface StableState {
  kind: "recognized" | "unknown" | "identifying";
  personId: string | null;
}
