"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld("electron", {
    // App info
    getAppPath: () => electron_1.ipcRenderer.invoke("get-app-path"),
    getUserDataPath: () => electron_1.ipcRenderer.invoke("get-user-data-path"),
    // Window controls
    minimizeWindow: () => electron_1.ipcRenderer.send("minimize-window"),
    maximizeWindow: () => electron_1.ipcRenderer.send("maximize-window"),
    closeWindow: () => electron_1.ipcRenderer.send("close-window"),
    // Generic IPC
    invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => {
        const subscription = (_event, ...args) => callback(...args);
        electron_1.ipcRenderer.on(channel, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(channel, subscription);
        };
    },
});
