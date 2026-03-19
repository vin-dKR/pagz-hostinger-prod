/**
 * Generic filename generator used across storage backends (FTP, S3, etc).
 * Keeps filenames reasonably unique and preserves original extension.
 */
export function generateFilename(originalName: string, prefix?: string): string {
  const ext = originalName.split(".").pop() || "";
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  const name = prefix
    ? `${prefix}-${timestamp}-${random}.${ext}`
    : `${timestamp}-${random}.${ext}`;
  return name;
}

