import {
  screen,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Rectangle,
} from "electron";

export const createWindow = (
  windowName: string,
  options: BrowserWindowConstructorOptions
): BrowserWindow => {
  const defaultSize: Rectangle = {
    x: 0,
    y: 0,
    width: options.width || 1200,
    height: options.height || 800,
  };

  // Center window on primary display
  const primaryDisplay = screen.getPrimaryDisplay();
  const state: Rectangle = {
    ...defaultSize,
    x: Math.round(
      primaryDisplay.bounds.x +
        (primaryDisplay.bounds.width - defaultSize.width) / 2
    ),
    y: Math.round(
      primaryDisplay.bounds.y +
        (primaryDisplay.bounds.height - defaultSize.height) / 2
    ),
  };

  const win = new BrowserWindow({
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
