import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // These ship native binaries or wasm and must stay outside the server bundle.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas", "tesseract.js"],
};

export default nextConfig;
