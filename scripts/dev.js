const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = 8888;
const children = [];

function cleanup() {
  for (const child of children) {
    child.kill();
  }
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// 1. Compile main process TypeScript in watch mode
const tsc = spawn("npx", ["tsc", "--watch", "--preserveWatchOutput"], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
});
children.push(tsc);

// 2. Start Next.js dev server
const next = spawn("npx", ["next", "dev", "renderer", "--port", String(PORT)], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
});
children.push(next);

next.on("exit", (code) => {
  console.error(`Next.js exited with code ${code}`);
  cleanup();
});

// 3. Poll until Next.js is ready, then launch Electron
function waitForServer() {
  const req = http.get(`http://localhost:${PORT}`, (res) => {
    res.resume();
    console.log("\nNext.js ready — launching Electron...\n");
    const electron = spawn("npx", ["electron", ".", String(PORT)], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });
    children.push(electron);
    electron.on("exit", cleanup);
  });
  req.on("error", () => setTimeout(waitForServer, 500));
}

waitForServer();
