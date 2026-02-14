export interface Voice {
  voice_id: string;
  name: string;
}

const BASE_URL = "https://api.elevenlabs.io/v1";

export class ElevenLabsProvider {
  private apiKey: string;
  private voiceId: string;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || "";
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || "vFLqXa8bgbofGarf6fZh"; // Rachel
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async speak(text: string): Promise<Buffer> {
    const response = await fetch(`${BASE_URL}/text-to-speech/${this.voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async listVoices(): Promise<Voice[]> {
    const response = await fetch(`${BASE_URL}/voices`, {
      headers: { "xi-api-key": this.apiKey },
    });

    if (!response.ok) {
      console.error("[TTS] Failed to list ElevenLabs voices:", response.status);
      return [];
    }

    const data = (await response.json()) as { voices: Voice[] };
    return data.voices;
  }
}
