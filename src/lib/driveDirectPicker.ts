import React, { useState, useRef } from "react";

export const GFS_MOMENTUM_FOLDER_ID = "1M1OORV7B5g5e-TGADNOJTaPDynvCoWAK";
export const GFS_MOMENTUM_DRIVE_URL =
  "https://drive.google.com/corp/drive/folders/1M1OORV7B5g5e-TGADNOJTaPDynvCoWAK";

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  isFolder?: boolean;
  [key: string]: any;
}

export function getConfiguredGoogleClientId(..._args: any[]): string {
  return "";
}

export async function getDriveAccessToken(..._args: any[]): Promise<string> {
  return "";
}

export async function listDriveFolderItems(..._args: any[]): Promise<DriveItem[]> {
  return [];
}

export async function downloadDriveFileDirect(_t: string, _i: DriveItem, _onProgress?: (pct: number) => void): Promise<File> {
  throw new Error("Direct OAuth disabled for corp Drive; use MomentumDropzoneModal.");
}

export function MomentumDropzoneModal(props: {
  onClose: () => void;
  onSelectFile: (file: File) => any;
}) {
  const [dragging, setDragging] = useState(false);
  const [loadingName, setLoadingName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const h = React.createElement;

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setLoadingName(file.name);
    await props.onSelectFile(file);
  };

  return h(
    "div",
    {
      className:
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4",
      onClick: props.onClose,
    },
    h(
      "div",
      {
        className:
          "bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden text-[#121317]",
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      },
      h(
        "div",
        { className: "px-6 py-4 border-b border-neutral-200 flex items-center justify-between" },
        h("h3", { className: "text-base font-semibold" }, "Upload a GFS Momentum Asset"),
        h(
          "button",
          {
            onClick: props.onClose,
            className: "px-2.5 py-1 text-xs rounded-full hover:bg-neutral-100 cursor-pointer",
          },
          "✕"
        )
      ),
      h(
        "div",
        { className: "p-6 space-y-4" },
        h(
          "div",
          { className: "flex items-center justify-between gap-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200" },
          h(
            "div",
            { className: "text-xs text-neutral-700" },
            h("p", { className: "font-semibold text-[#121317]" }, "Step 1: Choose from Google Drive"),
            h("p", { className: "text-neutral-500 mt-0.5" }, "Download your chosen Momentum image, PSD, or motion file.")
          ),
          h(
            "a",
            {
              href: GFS_MOMENTUM_DRIVE_URL,
              target: "_blank",
              rel: "noopener noreferrer",
              className:
                "shrink-0 px-4 py-2 rounded-full bg-[#121317] text-white text-xs font-medium hover:opacity-90",
            },
            "Open Drive Folder ↗"
          )
        ),
        h(
          "div",
          {
            onDragOver: (e: React.DragEvent) => {
              e.preventDefault();
              setDragging(true);
            },
            onDragLeave: () => setDragging(false),
            onDrop: (e: React.DragEvent) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            },
            onClick: () => inputRef.current?.click(),
            className: `border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              dragging
                ? "border-blue-600 bg-blue-50/50"
                : "border-neutral-300 hover:border-neutral-900 bg-neutral-50/60"
            }`,
          },
          h(
            "p",
            { className: "text-xs font-semibold text-[#121317]" },
            loadingName
              ? `Loading ${loadingName}...`
              : "Step 2: Drag your downloaded file here, or click to select"
          ),
          h(
            "p",
            { className: "text-[11px] text-neutral-500 mt-1.5" },
            "Supports large .mp4, .mov, .psd, .gif, .png, .jpeg, and .tif files"
          )
        ),
        h("input", {
          ref: inputRef,
          type: "file",
          accept: ".mp4,.mov,.webm,.gif,.psd,.png,.jpg,.jpeg,.webp,.tif,.tiff,image/*,video/*",
          className: "hidden",
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleFile(e.target.files?.[0]),
        })
      )
    )
  );
}
