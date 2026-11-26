"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RecentUploadItem, RecentCreationItem } from "./historyStore";

const S_BG: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 99999,
  background: "rgba(18,19,23,0.55)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
};
const S_CARD: React.CSSProperties = {
  width: "100%", maxWidth: 680, background: "#fff", borderRadius: 20,
  boxShadow: "0 24px 64px rgba(0,0,0,0.26)", border: "1px solid #E5E7EB",
  padding: 24, color: "#121317",
};
const S_HDR: React.CSSProperties = {
  display: "flex", justifyContent: "space-between",
  alignItems: "center", marginBottom: 14,
};
const S_X: React.CSSProperties = {
  background: "none", border: 0, fontSize: 22, cursor: "pointer", color: "#6B7280",
};
const S_PILL: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12,
  fontWeight: 500, color: "#374151", background: "rgba(255,255,255,0.94)",
  padding: "5px 12px", borderRadius: 999, border: "1px solid #E5E7EB",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)", cursor: "pointer",
};
export function RecentCreationsNavButton(p: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={p.onClick} style={S_PILL}>
      <span>Recent creations</span>
      {p.count > 0 && <span style={{ background: "#121317", color: "#fff", fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 999 }}>{p.count}</span>}
    </button>
  );
}
export function RecentUploadsModal(p: {
  open: boolean; items: RecentUploadItem[]; onClose: () => void;
  onPickUpload: (u: RecentUploadItem) => Promise<void>;
  onPickNewFile: (f: File) => Promise<void>;
  onDeleteUpload: (id: string) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [over, setOver] = useState(false);
  const inpRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setMounted(true); }, []);
  if (!p.open || !mounted) return null;
  const pick = async (f?: File | null) => {
    if (!f) return;
    setBusyId("__new__");
    try { await p.onPickNewFile(f); } finally { setBusyId(""); }
  };
  return createPortal(
    <div onClick={p.onClose} style={S_BG}>
      <div onClick={(e) => e.stopPropagation()} style={S_CARD}>
        <div style={S_HDR}>
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Upload or Select a Recent Asset</h3>
          <button type="button" onClick={p.onClose} style={S_X}>x</button>
        </div>
        <div
          onClick={() => inpRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
          style={{ padding: 15, borderRadius: 14, border: over ? "2px dashed #121317" : "1.5px dashed #D1D5DB", background: over ? "#F3F4F6" : "#F9FAFB", cursor: "pointer", textAlign: "center", marginBottom: 16 }}
        >
          <input ref={inpRef} type="file" accept="image/*,video/mp4,video/quicktime,.psd,.tif,.tiff,.gif,.mp4,.mov,.webp" style={{ display: "none" }} onChange={(e) => pick(e.target.files?.[0])} />
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{busyId === "__new__" ? "Loading file..." : "+ Upload a new file from your computer (or drag here)"}</div>
          <div style={{ fontSize: 11.5, color: "#6B7280", marginTop: 3 }}>Supports .png, .jpeg, .psd, .gif, .mp4, .mov, and .tif</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#4B5563", marginBottom: 10 }}>Recently uploaded ({p.items.length} of 10)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 10, maxHeight: "44vh", overflowY: "auto" }}>
          {p.items.map((u) => (
            <div key={u.id} onClick={async () => { setBusyId(u.id); try { await p.onPickUpload(u); } finally { setBusyId(""); } }} style={{ position: "relative", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", cursor: "pointer", background: "#fff" }}>
              <div style={{ height: 88, background: "#18191C", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {u.thumbUrl && <img src={u.thumbUrl} alt={u.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />}
                {u.isMotion && <span style={{ position: "absolute", bottom: 5, left: 6, background: "rgba(0,0,0,0.72)", color: "#fff", fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4 }}>MOTION</span>}
                <button type="button" onClick={(e) => { e.stopPropagation(); p.onDeleteUpload(u.id); }} style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: 999, border: 0, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, cursor: "pointer" }}>x</button>
              </div>
              <div style={{ padding: "7px 8px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{busyId === u.id ? "Opening..." : u.name}</div>
                <div style={{ fontSize: 10.5, color: "#6B7280", marginTop: 1 }}>{u.dims}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
export function RecentCreationsModal(p: {
  open: boolean; items: RecentCreationItem[]; onClose: () => void;
  onRestore: (c: RecentCreationItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [busyId, setBusyId] = useState("");
  useEffect(() => { setMounted(true); }, []);
  if (!p.open || !mounted) return null;
  const fmt = (ts: number) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return createPortal(
    <div onClick={p.onClose} style={S_BG}>
      <div onClick={(e) => e.stopPropagation()} style={S_CARD}>
        <div style={S_HDR}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Recent Creations ({p.items.length} of 10)</h3>
            <p style={{ fontSize: 12.5, color: "#6B7280", margin: "4px 0 0" }}>Click any previous export to reopen its exact background, crop, and panel positions.</p>
          </div>
          <button type="button" onClick={p.onClose} style={S_X}>x</button>
        </div>
        {p.items.length === 0 ? (
          <div style={{ padding: "34px 20px", textAlign: "center", background: "#F9FAFB", borderRadius: 14, border: "1px dashed #D1D5DB", fontSize: 13, color: "#6B7280" }}>Your last 10 exported panel designs will appear here automatically.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12, maxHeight: "56vh", overflowY: "auto" }}>
            {p.items.map((c) => (
              <div key={c.id} onClick={async () => { setBusyId(c.id); try { await p.onRestore(c); } finally { setBusyId(""); } }} style={{ border: "1px solid #E5E7EB", borderRadius: 13, overflow: "hidden", cursor: "pointer", background: "#fff" }}>
                <div style={{ height: 118, background: "#F1F3F4", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {c.thumbUrl && <img src={c.thumbUrl} alt={c.label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />}
                  <span style={{ position: "absolute", bottom: 6, left: 6, background: "#121317", color: "#fff", fontSize: 9.5, fontWeight: 600, padding: "2px 6px", borderRadius: 5 }}>{c.exportExt}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); p.onDelete(c.id); }} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 999, border: 0, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, cursor: "pointer" }}>x</button>
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{busyId === c.id ? "Restoring..." : `${c.label} (${c.panelCount}p)`}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{fmt(c.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
