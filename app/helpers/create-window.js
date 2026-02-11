"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWindow = void 0;
const electron_1 = require("electron");
const createWindow = (windowName, options) => {
    const defaultSize = {
        x: 0,
        y: 0,
        width: options.width || 1200,
        height: options.height || 800,
    };
    // Center window on primary display
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const state = {
        ...defaultSize,
        x: Math.round(primaryDisplay.bounds.x +
            (primaryDisplay.bounds.width - defaultSize.width) / 2),
        y: Math.round(primaryDisplay.bounds.y +
            (primaryDisplay.bounds.height - defaultSize.height) / 2),
    };
    const win = new electron_1.BrowserWindow({
        ...options,
        ...state,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            ...options.webPreferences,
        },
    });
    return win;
};
exports.createWindow = createWindow;
