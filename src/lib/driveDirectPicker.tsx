"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export const GFS_MOMENTUM_FOLDER_ID =
  "1M1OORV7B5g5e-TGADNOJTaPDynvCoWAK";
const DRIVE_URL =
  "https://drive.google.com/corp/drive/folders/" +
  GFS_MOMENTUM_FOLDER_ID;

export interface DriveItem {
  id: string;
  targetId: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  [k: string]: any;
}
export const getConfiguredGoogleClientId = () => "";
export const getDriveAccessToken = async (_c?: string) => "";
export const listDriveFolderItems = async (
  _t?: string, _f?: string, _q?: string
): Promise<DriveItem[]> => [];
export const downloadDriveFileDirect = async (
  _t: string, _i: DriveItem, _p?: (n: number) => void
): Promise<File> => { throw new Error("dropzone"); };
export function MomentumDropzoneModal({
  open = true, onClose, onSelectFile, onFileSelected,
}: {
  open?: boolean;
  onClose: () => void;
  onSelectFile?: (f: File) => any;
  onFileSelected?: (f: File) => any;
}) {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setMounted(true); }, []);
  if (!open || !mounted) return null;
  const pick = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    try { await (onSelectFile || onFileSelected)?.(f); }
    finally { setBusy(false); }
  };
  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 99999, padding: 20,
      background: "rgba(18,19,23,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 500, background: "#fff",
        borderRadius: 20, padding: 24, color: "#121317",
        boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 14,
        }}>
          <strong style={{ fontSize: 17 }}>
            Upload a GFS Momentum Asset
          </strong>
          <button type="button" onClick={onClose} style={{
            border: 0, background: "none", fontSize: 22,
            cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between", gap: 12,
          alignItems: "center", padding: "12px 14px", borderRadius: 12,
          border: "1px solid #E5E7EB", background: "#F9FAFB",
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 12.5 }}>
            <div style={{ fontWeight: 600 }}>Step 1: Choose from Drive</div>
            <div style={{ color: "#4B5563" }}>Download chosen asset.</div>
          </div>
          <a href={DRIVE_URL} target="_blank" rel="noreferrer" style={{
            background: "#121317", color: "#fff", fontSize: 12,
            fontWeight: 600, padding: "8px 14px", borderRadius: 999,
            textDecoration: "none", whiteSpace: "nowrap",
          }}>Open Drive Folder ↗</a>
        </div>
        <div onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault(); pick(e.dataTransfer.files?.[0]);
          }}
          onClick={() => ref.current?.click()} style={{
            border: "2px dashed #D1D5DB", borderRadius: 14,
            padding: "26px 16px", textAlign: "center", cursor: "pointer",
          }}>
          <input ref={ref} type="file" style={{ display: "none" }}
            accept="image/*,video/*,.mp4,.mov,.gif,.psd,.tif,.tiff"
            onChange={(e) => pick(e.target.files?.[0])} />
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>
            {busy ? "Loading asset..." : "Step 2: Drag file here or click"}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
            Supports .mp4, .mov, .psd, .gif, .png, .jpeg, and .tif
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
