#!/usr/bin/env node

/**
 * Custom build script for Electron + Next.js (standalone mode)
 * This allows API routes to work in production
 */

const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RENDERER_DIR = path.join(ROOT, "renderer");
const APP_DIR = path.join(ROOT, "app");
const STANDALONE_DIR = path.join(APP_DIR, "standalone");

function run(cmd, options = {}) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...options });
}

async function build() {
  console.log("🚀 Starting custom Electron + Next.js build...\n");

  // Step 1: Clean previous builds
  console.log("📦 Cleaning previous builds...");
  await fs.remove(APP_DIR);
  await fs.remove(path.join(ROOT, "dist"));
  await fs.remove(path.join(RENDERER_DIR, ".next"));

  // Step 2: Build Next.js in standalone mode
  console.log("\n📦 Building Next.js (standalone mode)...");
  run("npx next build renderer");

  // Step 3: Copy standalone output to app directory
  console.log("\n📦 Copying standalone output...");
  const nextStandalone = path.join(RENDERER_DIR, ".next", "standalone");
  const nextStatic = path.join(RENDERER_DIR, ".next", "static");
  const publicDir = path.join(RENDERER_DIR, "public");
  const migrationsDir = path.join(ROOT, "drizzle");

  // Copy standalone server
  await fs.copy(nextStandalone, STANDALONE_DIR);

  // Copy static files
  await fs.copy(
    nextStatic,
    path.join(STANDALONE_DIR, "renderer", ".next", "static")
  );

  // Copy public files if they exist
  if (await fs.pathExists(publicDir)) {
    await fs.copy(publicDir, path.join(STANDALONE_DIR, "renderer", "public"));
  }

  // Copy DB migrations for first-run schema bootstrap
  if (await fs.pathExists(migrationsDir)) {
    await fs.copy(migrationsDir, path.join(STANDALONE_DIR, "drizzle"));
  }

  // Step 4: Compile main process TypeScript
  console.log("\n📦 Compiling main process...");
  run("npx tsc --noEmit false");

  // Step 5: Copy native modules to standalone
  console.log("\n📦 Copying native modules...");
  const nativeModules = ["better-sqlite3"];
  for (const mod of nativeModules) {
    const src = path.join(ROOT, "node_modules", mod);
    const dest = path.join(STANDALONE_DIR, "node_modules", mod);
    if (await fs.pathExists(src)) {
      await fs.copy(src, dest);
    }
  }

  // Copy better-sqlite3 dependencies
  const sqlite3Deps = ["bindings", "file-uri-to-path", "prebuild-install"];
  for (const dep of sqlite3Deps) {
    const src = path.join(ROOT, "node_modules", dep);
    const dest = path.join(STANDALONE_DIR, "node_modules", dep);
    if (await fs.pathExists(src)) {
      await fs.copy(src, dest);
    }
  }

  // Step 6: Create a minimal package.json for standalone
  console.log("\n📦 Creating standalone package.json...");
  const standalonePkg = {
    name: "lucy-standalone",
    version: "1.0.0",
    main: "server.js",
  };
  await fs.writeJson(path.join(STANDALONE_DIR, "package.json"), standalonePkg);

  // Step 7: Package with electron-builder
  console.log("\n📦 Packaging Electron app...");
  run("npx electron-builder --config electron-builder.yml");

  console.log("\n✅ Build complete! Check the dist/ directory for the packaged app.");
}

build().catch((error) => {
  console.error("❌ Build failed:", error);
  process.exit(1);
});
