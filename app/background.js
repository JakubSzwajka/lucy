"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const helpers_1 = require("./helpers");
const child_process_1 = require("child_process");
const isProd = process.env.NODE_ENV === "production";
const DEV_SERVER_PORT = process.argv[2] || "8888";
const PROD_SERVER_PORT = "3000";
let mainWindow = null;
let serverProcess = null;
// Start the Next.js standalone server in production
async function startProductionServer() {
    return new Promise((resolve, reject) => {
        const serverPath = path_1.default.join(electron_1.app.getAppPath(), "standalone", "server.js");
        serverProcess = (0, child_process_1.spawn)("node", [serverPath], {
            env: {
                ...process.env,
                PORT: PROD_SERVER_PORT,
                HOSTNAME: "localhost",
                LUCY_USER_DATA_PATH: electron_1.app.getPath("userData"),
            },
            cwd: path_1.default.join(electron_1.app.getAppPath(), "standalone"),
        });
        serverProcess.stdout?.on("data", (data) => {
            console.log(`[HTTP] ${data}`);
            if (data.toString().includes("Ready") || data.toString().includes("started")) {
                resolve();
            }
        });
        serverProcess.stderr?.on("data", (data) => {
            console.error(`[HTTP] ${data}`);
        });
        serverProcess.on("error", (error) => {
            console.error("[Electron] Failed to start server:", error);
            reject(error);
        });
        // Fallback: resolve after a timeout if no "Ready" message
        setTimeout(resolve, 3000);
    });
}
async function createMainWindow() {
    // In development, use userData with suffix to separate dev data
    if (!isProd) {
        electron_1.app.setPath("userData", `${electron_1.app.getPath("userData")} (development)`);
    }
    // Set app icon path
    const iconPath = isProd
        ? path_1.default.join(process.resourcesPath, "icon.png")
        : path_1.default.join(__dirname, "..", "resources", "icon.png");
    // Set dock icon on macOS
    if (process.platform === "darwin" && electron_1.app.dock) {
        electron_1.app.dock.setIcon(iconPath);
    }
    mainWindow = (0, helpers_1.createWindow)("main", {
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: iconPath,
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
        trafficLightPosition: { x: 14, y: 14 },
        backgroundColor: "#0a0a0a",
    });
    const port = isProd ? PROD_SERVER_PORT : DEV_SERVER_PORT;
    const url = `http://localhost:${port}/`;
    try {
        await mainWindow.loadURL(url);
    }
    catch (error) {
        console.error("[Electron] Failed to load URL:", error);
        // Retry after a short delay
        setTimeout(async () => {
            try {
                await mainWindow?.loadURL(url);
            }
            catch (retryError) {
                console.error("[Electron] Retry failed:", retryError);
            }
        }, 2000);
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
// IPC Handlers
electron_1.ipcMain.handle("get-app-path", () => electron_1.app.getAppPath());
electron_1.ipcMain.handle("get-user-data-path", () => electron_1.app.getPath("userData"));
electron_1.ipcMain.on("minimize-window", () => {
    mainWindow?.minimize();
});
electron_1.ipcMain.on("maximize-window", () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    }
    else {
        mainWindow?.maximize();
    }
});
electron_1.ipcMain.on("close-window", () => {
    mainWindow?.close();
});
// App lifecycle
electron_1.app.on("ready", async () => {
    if (isProd) {
        try {
            await startProductionServer();
        }
        catch (error) {
            console.error("[Electron] Failed to start production server:", error);
        }
    }
    await createMainWindow();
});
electron_1.app.on("window-all-closed", () => {
    // Kill the server process when app closes
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
    electron_1.app.quit();
});
electron_1.app.on("activate", () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});
electron_1.app.on("before-quit", () => {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
});
