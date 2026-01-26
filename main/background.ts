import path from "path";
import { app, BrowserWindow, ipcMain } from "electron";
import { createWindow } from "./helpers";
import { spawn, ChildProcess } from "child_process";

const isProd = process.env.NODE_ENV === "production";
const DEV_SERVER_PORT = process.argv[2] || "8888";
const PROD_SERVER_PORT = "3000";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

// Start the Next.js standalone server in production
async function startProductionServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(app.getAppPath(), "standalone", "server.js");

    serverProcess = spawn("node", [serverPath], {
      env: {
        ...process.env,
        PORT: PROD_SERVER_PORT,
        HOSTNAME: "localhost",
        LUCY_USER_DATA_PATH: app.getPath("userData"),
      },
      cwd: path.join(app.getAppPath(), "standalone"),
    });

    serverProcess.stdout?.on("data", (data) => {
      console.log(`Server: ${data}`);
      if (data.toString().includes("Ready") || data.toString().includes("started")) {
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on("error", (error) => {
      console.error("Failed to start server:", error);
      reject(error);
    });

    // Fallback: resolve after a timeout if no "Ready" message
    setTimeout(resolve, 3000);
  });
}

async function createMainWindow() {
  // In development, use userData with suffix to separate dev data
  if (!isProd) {
    app.setPath("userData", `${app.getPath("userData")} (development)`);
  }

  mainWindow = createWindow("main", {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0a0a0a",
  });

  const port = isProd ? PROD_SERVER_PORT : DEV_SERVER_PORT;
  const url = `http://localhost:${port}/`;

  try {
    await mainWindow.loadURL(url);
  } catch (error) {
    console.error("Failed to load URL:", error);
    // Retry after a short delay
    setTimeout(async () => {
      try {
        await mainWindow?.loadURL(url);
      } catch (retryError) {
        console.error("Retry failed:", retryError);
      }
    }, 2000);
  }

  if (!isProd) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle("get-app-path", () => app.getAppPath());
ipcMain.handle("get-user-data-path", () => app.getPath("userData"));

ipcMain.on("minimize-window", () => {
  mainWindow?.minimize();
});

ipcMain.on("maximize-window", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on("close-window", () => {
  mainWindow?.close();
});

// App lifecycle
app.on("ready", async () => {
  if (isProd) {
    try {
      await startProductionServer();
    } catch (error) {
      console.error("Failed to start production server:", error);
    }
  }
  await createMainWindow();
});

app.on("window-all-closed", () => {
  // Kill the server process when app closes
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
