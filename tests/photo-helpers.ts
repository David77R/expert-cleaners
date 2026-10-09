import type { PhotoStorage } from "@/server/storage";

export type MemoryStorage = PhotoStorage & {
  files: Map<string, { bytes: Uint8Array; contentType: string }>;
  failNextPut: boolean;
  failRemove: boolean;
};

export function createMemoryStorage(): MemoryStorage {
  const files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const storage: MemoryStorage = {
    files,
    failNextPut: false,
    failRemove: false,
    async put(path, bytes, contentType) {
      if (storage.failNextPut) {
        storage.failNextPut = false;
        throw new Error("storage caído");
      }
      files.set(path, { bytes, contentType });
    },
    async remove(path) {
      if (storage.failRemove) throw new Error("no se pudo borrar");
      files.delete(path);
    },
    async signedUrl(path, expiresInSeconds = 3600) {
      return `https://storage.test/${path}?expires=${expiresInSeconds}`;
    },
  };
  return storage;
}

function pad(header: number[], size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  bytes.set(header);
  return bytes;
}

export const jpeg = (size = 256) => pad([0xff, 0xd8, 0xff, 0xe0], size);
export const png = (size = 256) => pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], size);
export const webp = (size = 256) => pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], size);
export const textFile = () => new TextEncoder().encode("esto no es una foto".repeat(20));
