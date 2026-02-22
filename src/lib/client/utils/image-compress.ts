const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_DIMENSION = 2048;

/**
 * Compress an image data URL if it exceeds MAX_SIZE_BYTES.
 * Returns the original URL if already small enough or not an image.
 */
export async function compressImageDataUrl(dataUrl: string, mediaType: string): Promise<string> {
  if (!mediaType.startsWith("image/")) return dataUrl;

  // Check size (data URL overhead is ~33% over raw bytes)
  const base64Part = dataUrl.split(",")[1];
  if (!base64Part) return dataUrl;
  const sizeEstimate = (base64Part.length * 3) / 4;
  if (sizeEstimate <= MAX_SIZE_BYTES) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Try quality levels until under limit
      for (const quality of [0.85, 0.7, 0.5, 0.3]) {
        const compressed = canvas.toDataURL("image/jpeg", quality);
        const compBase64 = compressed.split(",")[1];
        if (compBase64 && (compBase64.length * 3) / 4 <= MAX_SIZE_BYTES) {
          resolve(compressed);
          return;
        }
      }
      // Return lowest quality attempt
      resolve(canvas.toDataURL("image/jpeg", 0.3));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
