import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LevyPass Officer",
    short_name: "LevyPass",
    description: "Scan a trader's QR to see Paid or Not paid in seconds.",
    start_url: "/officer",
    display: "standalone",
    background_color: "#0f3d2e",
    theme_color: "#0f3d2e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
