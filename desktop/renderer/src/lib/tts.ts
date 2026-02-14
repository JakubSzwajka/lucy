/**
 * Clean markdown text for natural-sounding TTS output.
 */
export function cleanTextForSpeech(text: string): string {
  let cleaned = text;

  // Remove code blocks entirely (```...```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");

  // Remove inline code
  cleaned = cleaned.replace(/`[^`]+`/g, "");

  // Remove images
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, "");

  // Remove links but keep text: [text](url) → text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, "");

  // Remove headings markers
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // Remove bold/italic markers
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  cleaned = cleaned.replace(/_{1,3}([^_]+)_{1,3}/g, "$1");
  cleaned = cleaned.replace(/~~([^~]+)~~/g, "$1");

  // Convert bullet points to pauses
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, ". ");
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, ". ");

  // Remove horizontal rules
  cleaned = cleaned.replace(/^[-*_]{3,}$/gm, "");

  // Remove blockquote markers
  cleaned = cleaned.replace(/^>\s*/gm, "");

  // Remove emoji
  cleaned = cleaned.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
    ""
  );

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // Collapse multiple newlines/spaces
  cleaned = cleaned.replace(/\n{2,}/g, ". ");
  cleaned = cleaned.replace(/\n/g, " ");
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  // Clean up multiple periods
  cleaned = cleaned.replace(/\.{2,}/g, ".");
  cleaned = cleaned.replace(/\.\s*\./g, ".");

  return cleaned.trim();
}
