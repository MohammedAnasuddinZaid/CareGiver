export async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image data"));
    reader.readAsDataURL(blob);
  });
}

export function dataURLToBlob(dataURL: string): Blob {
  const [meta, base64] = dataURL.split(",");
  if (!base64) throw new Error("Invalid data URL");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "application/octet-stream";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Loads a File/Blob into a bitmap, honoring EXIF orientation where supported.
 */
async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function intrinsicSize(image: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ("naturalWidth" in image) {
    return { w: image.naturalWidth || image.width, h: image.naturalHeight || image.height };
  }
  return { w: image.width, h: image.height };
}

function drawToCanvas(
  image: ImageBitmap | HTMLImageElement,
  maxDim: number,
): HTMLCanvasElement {
  const { w, h } = intrinsicSize(image);
  if (!w || !h) throw new Error("Image has no dimensions");
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface PreparedPhoto {
  canvas: HTMLCanvasElement;
  blob: Blob;
  width: number;
  height: number;
}

/** Downscales an uploaded image (max dimension) into a JPEG blob + canvas for analysis. */
export async function prepareUpload(file: File | Blob, maxDim = 1024): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Unsupported file type");
  }
  const bitmap = await loadBitmap(file);
  const canvas = drawToCanvas(bitmap, maxDim);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.85,
    );
  });
  return { canvas, blob, width: canvas.width, height: canvas.height };
}

/** Small thumbnail dataURL used for instant grid rendering. */
export async function makeThumb(source: CanvasImageSource, maxDim = 256): Promise<string> {
  const canvas = document.createElement("canvas");
  const sw =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLCanvasElement
        ? source.width
        : (source as ImageBitmap).width;
  const sh =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLCanvasElement
        ? source.height
        : (source as ImageBitmap).height;
  const scale = Math.min(1, maxDim / Math.max(sw || 1, sh || 1));
  canvas.width = Math.max(1, Math.round((sw || 1) * scale));
  canvas.height = Math.max(1, Math.round((sh || 1) * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}
