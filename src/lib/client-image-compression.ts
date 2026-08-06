const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2000;
const TARGET_IMAGE_BYTES = 1.5 * 1024 * 1024;
const PASSTHROUGH_IMAGE_BYTES = 1024 * 1024;

export interface PreparedUploadImage {
  blob: Blob;
  fileName: string;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('無法讀取圖片內容'));
    reader.onerror = () => reject(new Error('無法讀取圖片內容'));
    reader.readAsDataURL(file);
  });
}

async function loadBrowserImage(file: File) {
  if (typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file);
      if (bitmap.width > 0 && bitmap.height > 0) {
        return {
          source: bitmap as CanvasImageSource,
          width: bitmap.width,
          height: bitmap.height,
          dispose: () => bitmap.close()
        };
      }
      bitmap.close();
    } catch (error) {
      console.warn('createImageBitmap failed; using FileReader fallback', error);
    }
  }

  const dataUrl = await readFileAsDataUrl(file);
  return new Promise<{
    source: CanvasImageSource;
    width: number;
    height: number;
    dispose: () => void;
  }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => { image.src = ''; }
    });
    image.onerror = () => reject(new Error('無法讀取圖片，請改用 JPG、PNG、WebP 或 AVIF'));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg', quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('圖片壓縮失敗')), type, quality);
  });
}

async function encodeImage(canvas: HTMLCanvasElement, quality: number) {
  try {
    const webp = await canvasToBlob(canvas, 'image/webp', quality);
    if (webp.type === 'image/webp') return webp;
  } catch (error) {
    console.warn('WebP encoding failed; using JPEG fallback', error);
  }
  return canvasToBlob(canvas, 'image/jpeg', quality);
}

function extensionForImageType(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/avif') return 'avif';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function compressImageForUpload(file: File, prefix = 'image'): Promise<PreparedUploadImage> {
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('原始圖片不可超過 25MB');

  const loaded = await loadBrowserImage(file);
  try {
    const longestEdge = Math.max(loaded.width, loaded.height);
    if (file.size <= PASSTHROUGH_IMAGE_BYTES && longestEdge <= MAX_IMAGE_EDGE) {
      return {
        blob: file,
        fileName: `${prefix}-${Date.now()}.${extensionForImageType(file.type)}`
      };
    }

    const scale = Math.min(1, MAX_IMAGE_EDGE / longestEdge);
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('瀏覽器無法壓縮圖片');
    context.drawImage(loaded.source, 0, 0, width, height);

    let blob = await encodeImage(canvas, 0.84);
    for (const quality of [0.76, 0.68]) {
      if (blob.size <= TARGET_IMAGE_BYTES) break;
      blob = await canvasToBlob(
        canvas,
        blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg',
        quality
      );
    }

    return {
      blob,
      fileName: `${prefix}-${Date.now()}.${extensionForImageType(blob.type)}`
    };
  } finally {
    loaded.dispose();
  }
}
