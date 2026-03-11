const TELEGRAM_MAX_LENGTH = 4096;

export function splitMessage(text: string, maxLength = TELEGRAM_MAX_LENGTH): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split("\n\n");
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (paragraph.length <= maxLength) {
      current = paragraph;
      continue;
    }

    const sentences = splitBySentences(paragraph);
    for (const sentence of sentences) {
      const sentenceCandidate = current ? `${current} ${sentence}` : sentence;

      if (sentenceCandidate.length <= maxLength) {
        current = sentenceCandidate;
        continue;
      }

      if (current) {
        chunks.push(current);
        current = "";
      }

      if (sentence.length <= maxLength) {
        current = sentence;
      } else {
        for (let i = 0; i < sentence.length; i += maxLength) {
          chunks.push(sentence.slice(i, i + maxLength));
        }
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitBySentences(text: string): string[] {
  return text.split(/(?<=[.?!])\s+/).filter(Boolean);
}
