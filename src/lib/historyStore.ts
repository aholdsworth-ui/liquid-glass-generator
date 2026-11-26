export type RecentUploadItem = {
  id: string; blobKey: string; name: string; type: string;
  dims: string; isMotion: boolean; thumbUrl: string; updatedAt: number;
};
export type RecentCreationItem = {
  id: string; blobKey: string | null; fileName: string; fileType: string;
  label: string; exportExt: string; panelCount: number;
  thumbUrl: string; snapshot: Record<string, any>; createdAt: number;
};
let expCb: ((f: string) => void) | null = null;
let uplCb: (() => void) | null = null;
export const registerExportListener = (fn: ((f: string) => void) | null) => { expCb = fn; };
export const notifyExportTriggered = (f: string) => { if (expCb) expCb(f); };
export const onUploadsChanged = (fn: (() => void) | null) => { uplCb = fn; };
const DB_NAME = "gfs_liquid_glass_v1";
function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") { rej(new Error("no idb")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      ["blobs", "uploads", "creations"].forEach((s: string) => {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: s === "blobs" ? "key" : "id" });
        }
      });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function getAllFrom<T>(store: string): Promise<T[]> {
  try {
    const db = await openDb();
    return await reqP<T[]>(db.transaction(store, "readonly").objectStore(store).getAll());
  } catch { return []; }
}
export async function loadBlobAsFile(blobKey: string, name: string, type: string): Promise<File | null> {
  try {
    const db = await openDb();
    const rec = await reqP<any>(db.transaction("blobs", "readonly").objectStore("blobs").get(blobKey));
    if (!rec?.blob) return null;
    const f = new File([rec.blob], name || rec.name || "asset", { type: type || rec.type || "" });
    (f as any).__skipUploadHistory = true;
    return f;
  } catch { return null; }
}
async function pruneBlobs(): Promise<void> {
  try {
    const ups = await getAllFrom<RecentUploadItem>("uploads");
    const crs = await getAllFrom<RecentCreationItem>("creations");
    const keep = new Set<string>();
    ups.forEach((u: RecentUploadItem) => keep.add(u.blobKey));
    crs.forEach((c: RecentCreationItem) => { if (c.blobKey) keep.add(c.blobKey); });
    const db = await openDb();
    const ro = db.transaction("blobs", "readonly").objectStore("blobs");
    const keys = await reqP<IDBValidKey[]>(ro.getAllKeys());
    const tx = db.transaction("blobs", "readwrite");
    keys.forEach((k: IDBValidKey) => { if (!keep.has(String(k))) tx.objectStore("blobs").delete(k); });
  } catch {}
}
export async function getRecentUploads(): Promise<RecentUploadItem[]> {
  const all = await getAllFrom<RecentUploadItem>("uploads");
  return all.sort((a: RecentUploadItem, b: RecentUploadItem) => b.updatedAt - a.updatedAt).slice(0, 10);
}
export async function saveRecentUpload(file: File, thumbUrl: string, dims: string, isMotion: boolean): Promise<void> {
  const prev = await getAllFrom<RecentUploadItem>("uploads");
  const key = `${file.name}::${file.size}::${file.lastModified || 0}`;
  const db = await openDb();
  const tx = db.transaction(["blobs", "uploads"], "readwrite");
  tx.objectStore("blobs").put({ key, blob: file, name: file.name, type: file.type });
  tx.objectStore("uploads").put({ id: key, blobKey: key, name: file.name, type: file.type, dims, isMotion, thumbUrl, updatedAt: Date.now() });
  prev.filter((u: RecentUploadItem) => u.id !== key).sort((a: RecentUploadItem, b: RecentUploadItem) => b.updatedAt - a.updatedAt)
    .slice(9).forEach((old: RecentUploadItem) => tx.objectStore("uploads").delete(old.id));
  await new Promise<void>((r) => { tx.oncomplete = () => r(); tx.onerror = () => r(); });
  await pruneBlobs();
  if (uplCb) uplCb();
}
export async function deleteRecentUpload(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("uploads", "readwrite");
  tx.objectStore("uploads").delete(id);
  await new Promise<void>((r) => { tx.oncomplete = () => r(); tx.onerror = () => r(); });
  await pruneBlobs();
  if (uplCb) uplCb();
}
export async function getRecentCreations(): Promise<RecentCreationItem[]> {
  const all = await getAllFrom<RecentCreationItem>("creations");
  return all.sort((a: RecentCreationItem, b: RecentCreationItem) => b.createdAt - a.createdAt).slice(0, 10);
}
export async function deleteRecentCreation(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("creations", "readwrite");
  tx.objectStore("creations").delete(id);
  await new Promise<void>((r) => { tx.oncomplete = () => r(); tx.onerror = () => r(); });
  await pruneBlobs();
}
export async function saveRecentCreation(p: {
  file: File | null; label: string; exportExt: string;
  panelCount: number; thumbUrl: string; snapshot: Record<string, any>;
}): Promise<void> {
  const prev = await getAllFrom<RecentCreationItem>("creations");
  const db = await openDb();
  const tx = db.transaction(["blobs", "creations"], "readwrite");
  let bKey: string | null = null;
  if (p.file) {
    bKey = `${p.file.name}::${p.file.size}::${p.file.lastModified || 0}`;
    tx.objectStore("blobs").put({ key: bKey, blob: p.file, name: p.file.name, type: p.file.type });
  }
  const id = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  tx.objectStore("creations").put({
    id, blobKey: bKey, fileName: p.file?.name || "", fileType: p.file?.type || "",
    label: p.label, exportExt: p.exportExt, panelCount: p.panelCount,
    thumbUrl: p.thumbUrl, snapshot: p.snapshot, createdAt: Date.now(),
  });
  prev.sort((a: RecentCreationItem, b: RecentCreationItem) => b.createdAt - a.createdAt)
    .slice(9).forEach((old: RecentCreationItem) => tx.objectStore("creations").delete(old.id));
  await new Promise<void>((r) => { tx.oncomplete = () => r(); tx.onerror = () => r(); });
  await pruneBlobs();
}
