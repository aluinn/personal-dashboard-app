import "server-only";
import yauzl from "yauzl";
import type { Readable } from "node:stream";

export type ZipEntry = { name: string; size: number };

/** Walk a zip one entry at a time (never loads it whole). `open()` streams the entry's bytes. */
export function eachZipEntry(file: string, handler: (e: ZipEntry, open: () => Promise<Readable>) => Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("Couldn't open the zip file."));
      zip.on("error", reject);
      zip.on("end", resolve);
      zip.on("entry", (entry: yauzl.Entry) => {
        if (/\/$/.test(entry.fileName) || entry.fileName.includes("__MACOSX")) return zip.readEntry();
        const open = () =>
          new Promise<Readable>((res, rej) =>
            zip.openReadStream(entry, (e, stream) => (e || !stream ? rej(e ?? new Error("Couldn't read zip entry.")) : res(stream))),
          );
        handler({ name: entry.fileName, size: entry.uncompressedSize }, open).then(() => zip.readEntry(), reject);
      });
      zip.readEntry();
    });
  });
}
