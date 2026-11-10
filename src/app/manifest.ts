import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LevyPass Officer",
    short_name: "LevyPass",
    description: "Scan a trader's QR to see Paid or Not paid in seconds.",
    start_url: "/officer",
    display: "standalone",
    background_color: "#027a48",
    theme_color: "#027a48",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
