"use client";
import React, { useRef, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { GFS_MOMENTUM_DRIVE_URL } from "@/lib/assetPaths";

export function HoldingImageModal({
  onClose,
  onSelectFile,
  driveUrl = GFS_MOMENTUM_DRIVE_URL,
}: {
  onClose: () => void;
  onSelectFile: (file: File) => any;
  driveUrl?: string;
  [key: string]: any;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(18,19,23,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "480px", backgroundColor: "#FFFFFF", borderRadius: "24px", padding: "24px 26px", boxShadow: "0 24px 60px rgba(0,0,0,0.22)", border: "1px solid #E5E7EB" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#121317", margin: 0 }}>Upload a holding image</h3>
            <p style={{ fontSize: "12.5px", color: "#6B7280", margin: "2px 0 0 0" }}>Choose from Drive or desktop</p>
          </div>
          <button type="button" onClick={onClose} style={{ padding: "4px", color: "#6B7280", cursor: "pointer", background: "transparent", border: "none" }}><X size={18} /></button>
        </div>
        <div style={{ backgroundColor: "#F8F9FA", border: "1px solid #ECEEF1", borderRadius: "16px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#121317" }}>Step 1: Choose from Drive</div>
            <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "2px" }}>Download chosen asset.</div>
          </div>
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#121317", color: "#FFFFFF", borderRadius: "9999px", padding: "8px 15px", fontSize: "12px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", whiteSpace: "nowrap" }}>Open Drive Folder <ExternalLink size={13} /></a>
        </div>
        <input ref={inputRef} type="file" accept=".mp4,.mov,.psd,.gif,.png,.jpg,.jpeg,.tif,.tiff,image/*,video/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelectFile(f); }} />
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onSelectFile(f); }}
          style={{ border: dragOver ? "2px dashed #121317" : "2px dashed #D1D5DB", backgroundColor: dragOver ? "#F3F4F6" : "#FFFFFF", borderRadius: "16px", padding: "32px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.15s ease" }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#121317" }}>Step 2: Drag file here or click</div>
          <div style={{ fontSize: "11.5px", color: "#6B7280", marginTop: "5px" }}>Supports .mp4, .mov, .psd, .gif, .png, .jpeg, and .tif</div>
        </div>
      </div>
    </div>
  );
}
