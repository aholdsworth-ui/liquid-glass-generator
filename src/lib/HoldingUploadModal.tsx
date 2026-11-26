"use client";
import React, { useRef, useState } from "react";
import { X, ExternalLink } from "lucide-react";

export function HoldingUploadModal({
  open, driveUrl, loading, error, onClose, onSelectFile,
}: {
  open: boolean; driveUrl: string; loading: boolean; error: string;
  onClose: () => void; onSelectFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setDragOver(false);
        const f = e.dataTransfer.files?.[0]; if (f) onSelectFile(f);
      }}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[28px] shadow-2xl border border-neutral-200 w-full max-w-[520px] p-6 sm:p-7 relative text-[#121317]">
        <input ref={inputRef} type="file" accept=".mp4,.mov,.psd,.gif,.png,.jpg,.jpeg,.tif,.tiff,.webp,image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelectFile(f); e.currentTarget.value = ""; }} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[20px] font-semibold leading-tight">Upload a holding image</h3>
            <p className="text-[13px] text-neutral-500 mt-1">Choose from Drive or desktop</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="mt-5 rounded-2xl bg-[#F8F9FA] border border-neutral-200/90 px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold">Step 1: Choose from Drive</div>
            <div className="text-[12px] text-neutral-500">Download chosen asset.</div>
          </div>
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#121317] hover:bg-neutral-800 text-white text-[12px] font-semibold whitespace-nowrap transition">Open Drive Folder <ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
        <div onClick={() => !loading && inputRef.current?.click()} className={`mt-3.5 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition cursor-pointer ${dragOver ? "border-[#121317] bg-neutral-50" : "border-neutral-300 hover:border-neutral-900 bg-white"}`}>
          <div className="text-[14px] font-semibold">{loading ? "Loading holding image..." : "Step 2: Drag file here or click"}</div>
          <div className="text-[12px] text-neutral-400 mt-1">Supports .mp4, .mov, .psd, .gif, .png, .jpeg, and .tif</div>
          {error && <div className="text-[12px] text-red-600 mt-2 font-medium">{error}</div>}
        </div>
      </div>
    </div>
  );
}
