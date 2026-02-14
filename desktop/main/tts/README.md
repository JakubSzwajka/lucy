# TTS Module

Text-to-speech for Lucy desktop. Uses ElevenLabs API for natural multilingual speech, with macOS `say` as fallback.

## Providers

- **ElevenLabsProvider** — calls `/v1/text-to-speech/{voiceId}` with `eleven_multilingual_v2` model. Returns mp3 buffer sent to renderer as base64 for `Audio` playback.
- **SayProvider** — wraps the `say` npm package (macOS native TTS, Samantha voice). Plays audio directly on the system.

## Config

| Env var | Required | Default |
|---------|----------|---------|
| `ELEVENLABS_API_KEY` | No | — (falls back to `say`) |
| `ELEVENLABS_VOICE_ID` | No | `21m00Tcm4TlvDq8ikWAM` (Rachel) |

## IPC Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `tts:speak` | renderer → main | `(messageId, text)` |
| `tts:stop` | renderer → main | — |
| `tts:loading` | main → renderer | `messageId` |
| `tts:started` | main → renderer | `messageId` (say fallback) |
| `tts:finished` | main → renderer | `messageId` |
| `tts:play-audio` | main → renderer | `(messageId, base64Mp3)` |
| `tts:stop-audio` | main → renderer | — |
| `tts:error` | main → renderer | `(messageId, errorMsg)` |

## Fallback behavior

1. If `ELEVENLABS_API_KEY` is set → use ElevenLabs
2. If ElevenLabs call fails → fall back to `say`
3. If no API key → use `say` directly
