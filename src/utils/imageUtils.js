// Utilitaires fichiers / images (nom de fichier sûr, compression JPEG) — extraits de MemberFormPage



/**
 * Sanitize a file name for safe storage: strip accents, replace spaces
 * with underscores, and remove non-alphanumeric characters.
 * @param {string} name - Original file name.
 * @returns {string} Sanitized file name.
 */
export function sanitizeFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "");
}

/**
 * Compress an image (given as a data URL) to JPEG at the specified max
 * dimension and quality. Preserves aspect ratio.
 * @param {string} imageData - Base64 data URL of the source image.
 * @param {number} [maxSize=256] - Maximum width or height in pixels.
 * @param {number} [quality=0.6] - JPEG quality (0..1).
 * @returns {Promise<string>} Compressed image as a data URL.
 */
export const compressImageData = (imageData, maxSize = 256, quality = 0.6) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");

      let width = img.width;
      let height = img.height;

      // Scale down while keeping aspect ratio
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL("image/jpeg", quality);

      const sizeKB = Math.round((compressed.length * 0.75) / 1024);

      resolve(compressed);
    };

    img.onerror = reject;
    img.src = imageData;
  });
};
