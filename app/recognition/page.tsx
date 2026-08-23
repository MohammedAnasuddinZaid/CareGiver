import type { Metadata } from "next";
import { CompanionView } from "@/components/recognition/companion-view";

export const metadata: Metadata = {
  title: "Companion Mode",
};

export default function RecognitionPage() {
  return <CompanionView />;
}
