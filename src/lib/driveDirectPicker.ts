export const GFS_MOMENTUM_FOLDER_ID = "1M1OORV7B5g5e-TGADNOJTaPDynvCoWAK";

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  isFolder: boolean;
  targetId: string;
  targetMimeType: string;
}

let cachedToken = "";
let cachedExpiry = 0;
let gisLoaded: Promise<void> | null = null;

function ensureGisScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

export function getConfiguredGoogleClientId(): string {
  const envId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  if (envId) return envId.trim();
  if (typeof window !== "undefined") {
    return (window.localStorage.getItem("gfs_google_client_id") || "").trim();
  }
  return "";
}

export async function getDriveAccessToken(clientId: string, forceConsent = false): Promise<string> {
  if (!forceConsent && cachedToken && Date.now() < cachedExpiry) return cachedToken;
  await ensureGisScript();
  return new Promise<string>((resolve, reject) => {
    const oauth2 = (window as any).google?.accounts?.oauth2;
    if (!oauth2) return reject(new Error("Google OAuth unavailable"));
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: (resp: any) => {
        if (resp?.error || !resp?.access_token) {
          reject(new Error(resp?.error_description || resp?.error || "Authorization cancelled"));
          return;
        }
        cachedToken = resp.access_token;
        cachedExpiry = Date.now() + ((resp.expires_in || 3500) - 90) * 1000;
        resolve(cachedToken);
      },
      error_callback: (err: any) => reject(new Error(err?.message || "Popup closed")),
    });
    tokenClient.requestAccessToken({ prompt: forceConsent ? "consent" : "" });
  });
}

const ALLOWED_EXT = /\.(mp4|psd|gif|png|jpe?g|mov|webm|m4v|tiff?|webp|svg|avif|bmp)$/i;

export async function listDriveFolderItems(token: string, folderId: string): Promise<DriveItem[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,size,thumbnailLink,shortcutDetails(targetId,targetMimeType))",
    orderBy: "folder,name_natural",
    pageSize: "100",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive folder query failed (${res.status})`);
  const data = await res.json();
  const out: DriveItem[] = [];
  for (const f of data.files || []) {
    const isShortcut = f.mimeType === "application/vnd.google-apps.shortcut";
    const targetId = isShortcut && f.shortcutDetails?.targetId ? f.shortcutDetails.targetId : f.id;
    const targetMime = isShortcut && f.shortcutDetails?.targetMimeType ? f.shortcutDetails.targetMimeType : f.mimeType;
    const isFolder = targetMime === "application/vnd.google-apps.folder";
    const isMedia =
      isFolder ||
      targetMime.startsWith("image/") ||
      targetMime.startsWith("video/") ||
      targetMime.includes("photoshop") ||
      ALLOWED_EXT.test(f.name || "");
    if (!isMedia) continue;
    out.push({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      thumbnailLink: f.thumbnailLink,
      isFolder,
      targetId,
      targetMimeType: targetMime,
    });
  }
  return out;
}

export async function downloadDriveFileDirect(
  token: string,
  item: DriveItem,
  onProgress?: (pct: number) => void
): Promise<File> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.targetId)}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to stream file from Drive (${res.status})`);

  const total = Number(res.headers.get("content-length") || item.size || 0);
  if (!res.body || !total) {
    onProgress?.(60);
    const blob = await res.blob();
    onProgress?.(100);
    return new File([blob], item.name, { type: item.targetMimeType || blob.type });
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onProgress?.(Math.min(99, Math.round((received / total) * 100)));
    }
  }
  onProgress?.(100);
  const blob = new Blob(chunks as BlobPart[], { type: item.targetMimeType || "application/octet-stream" });
  return new File([blob], item.name, { type: item.targetMimeType || blob.type });
}
