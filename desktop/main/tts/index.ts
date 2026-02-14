import { BrowserWindow, ipcMain } from "electron";
import { ElevenLabsProvider } from "./elevenlabs-provider";
import { SayProvider } from "./say-provider";

let currentMessageId: string | null = null;
let mainWindow: BrowserWindow | null = null;
const elevenlabs = new ElevenLabsProvider();
const sayProvider = new SayProvider();

export function initTts(window: BrowserWindow) {
  mainWindow = window;

  // Log available voices on startup if configured
  if (elevenlabs.isConfigured) {
    elevenlabs
      .listVoices()
      .then((voices) => {
        console.log(
          "[TTS] ElevenLabs voices:",
          voices.map((v) => `${v.name} (${v.voice_id})`).join(", ")
        );
      })
      .catch((err) => console.error("[TTS] Failed to list voices:", err));
  } else {
    console.log("[TTS] No ElevenLabs API key — using macOS say fallback");
  }

  ipcMain.handle("tts:speak", async (_event, messageId: string, text: string) => {
    // Stop any current speech
    sayProvider.stop();
    currentMessageId = messageId;

    if (elevenlabs.isConfigured) {
      // ElevenLabs path
      mainWindow?.webContents.send("tts:loading", messageId);
      try {
        const mp3Buffer = await elevenlabs.speak(text);
        if (currentMessageId !== messageId) return { ok: true }; // cancelled
        const base64 = mp3Buffer.toString("base64");
        mainWindow?.webContents.send("tts:play-audio", messageId, base64);
      } catch (err) {
        console.error("[TTS] ElevenLabs error, falling back to say:", err);
        // Fallback to say
        await speakWithSay(messageId, text);
      }
    } else {
      // Direct say fallback
      await speakWithSay(messageId, text);
    }

    return { ok: true };
  });

  ipcMain.handle("tts:stop", () => {
    const stoppedId = currentMessageId;
    currentMessageId = null;
    sayProvider.stop();
    mainWindow?.webContents.send("tts:stop-audio");
    if (stoppedId) {
      mainWindow?.webContents.send("tts:finished", stoppedId);
    }
    return { ok: true };
  });
}

async function speakWithSay(messageId: string, text: string) {
  mainWindow?.webContents.send("tts:started", messageId);
  try {
    await sayProvider.speak(text);
  } catch (err) {
    console.error("[TTS] say error:", err);
    mainWindow?.webContents.send("tts:error", messageId, String(err));
  }
  if (currentMessageId === messageId) {
    currentMessageId = null;
    mainWindow?.webContents.send("tts:finished", messageId);
  }
}
