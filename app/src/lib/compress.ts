const MAX_SIDE = 1600;
const TARGET_BYTES = 300 * 1024;
const MIN_QUALITY = 0.5;
const SAMPLE_WIDTH = 160;

// Advisory thresholds — the server's gate is the authority; these just
// warn the collector while retaking is still one tap away.
const DARK_BELOW = 35;
const BRIGHT_ABOVE = 235;
const BLURRY_BELOW = 15;

export type QualityWarning = "dark" | "bright" | "blurry";

export interface CapturedImage {
  blob: Blob;
  warning: QualityWarning | null;
}

export async function compressImage(file: Blob): Promise<CapturedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const warning = assess(canvas);

  let quality = 0.85;
  let blob = await toJpeg(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1;
    blob = await toJpeg(canvas, quality);
  }
  return { blob, warning };
}

function assess(source: HTMLCanvasElement): QualityWarning | null {
  const width = SAMPLE_WIDTH;
  const height = Math.max(1, Math.round((source.height * width) / source.width));
  const sample = document.createElement("canvas");
  sample.width = width;
  sample.height = height;
  const ctx = sample.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const gray = new Float64Array(width * height);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) {
    const value = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
    gray[i] = value;
    sum += value;
  }
  const brightness = sum / gray.length;
  if (brightness < DARK_BELOW) return "dark";
  if (brightness > BRIGHT_ABOVE) return "bright";

  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const value =
        4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - width]! - gray[i + width]!;
      lapSum += value;
      lapSqSum += value * value;
      count++;
    }
  }
  const mean = lapSum / count;
  const variance = lapSqSum / count - mean * mean;
  return variance < BLURRY_BELOW ? "blurry" : null;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("jpeg encoding failed"))),
      "image/jpeg",
      quality,
    );
  });
}
