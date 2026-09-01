import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CareGiver",
    short_name: "CareGiver",
    description:
      "A privacy-first assistive app that helps people with memory impairment recognize familiar people and stay mentally active — entirely on-device.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    prefer_related_applications: false,
    background_color: "#fafaf9",
    theme_color: "#0f766e",
    categories: ["health", "lifestyle", "medical"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Mind Games",
        url: "/play",
        description: "Play today's gentle brain games",
      },
      {
        name: "Companion Mode",
        url: "/recognition",
        description: "Recognize familiar faces",
      },
      {
        name: "Progress",
        url: "/analytics",
        description: "See how skills are changing",
      },
    ],
  };
}
