import path from "node:path";

/** Express sendFile implements byte ranges, HEAD, caching, and stream cleanup. */
export function installMediaRoutes(app, rootDir) {
  app.get("/journey.mp4", (_req, res) => {
    res.sendFile(path.join(rootDir, "src", "assets", "journey.mp4"));
  });
  app.get("/journey-poster.webp", (_req, res) => {
    res.sendFile(path.join(rootDir, "public", "journey-poster.webp"));
  });
}
