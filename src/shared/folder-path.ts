export const FOLDER_SEPARATOR = " / ";

export function folderSegments(path: string): string[] {
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function normalizeFolderPath(path: string): string {
  return folderSegments(path).join(FOLDER_SEPARATOR);
}

export function folderAncestors(path: string): string[] {
  const segments = folderSegments(path);
  return segments.map((_, index) =>
    segments.slice(0, index + 1).join(FOLDER_SEPARATOR),
  );
}

export function isFolderInside(path: string, parentPath: string): boolean {
  const normalizedPath = normalizeFolderPath(path);
  const normalizedParent = normalizeFolderPath(parentPath);
  return (
    normalizedPath === normalizedParent ||
    normalizedPath.startsWith(`${normalizedParent}${FOLDER_SEPARATOR}`)
  );
}

export function replaceFolderPrefix(
  path: string,
  oldPrefix: string,
  newPrefix: string,
): string {
  const normalizedPath = normalizeFolderPath(path);
  const normalizedOldPrefix = normalizeFolderPath(oldPrefix);
  const normalizedNewPrefix = normalizeFolderPath(newPrefix);
  if (normalizedPath === normalizedOldPrefix) return normalizedNewPrefix;
  if (!isFolderInside(normalizedPath, normalizedOldPrefix))
    return normalizedPath;
  return `${normalizedNewPrefix}${normalizedPath.slice(normalizedOldPrefix.length)}`;
}

export function validFolderName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 120 &&
    value.trim() !== "." &&
    value.trim() !== ".." &&
    !value.includes("/") &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}
