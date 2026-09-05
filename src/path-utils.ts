export interface VaultPathEntry {
  path: string;
}

export function filterFilesInFolder<T extends VaultPathEntry>(
  files: readonly T[],
  folderPath: string,
): T[] {
  const normalized = folderPath.replace(/^\/+|\/+$/g, "");
  const prefix = normalized ? `${normalized}/` : "";
  return files.filter((file) => file.path.startsWith(prefix));
}
