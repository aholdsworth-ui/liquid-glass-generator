"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  PanelShape,
  BackgroundTheme,
  LOCKED_THEME_OPACITY,
  renderStandaloneGlassPanel,
  generateStandaloneGlassSvg,
} from "@/lib/liquidGlassEngine";

export function drawCoverImage(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number) {
  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || w;
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || h;
  const scale = Math.max(w / iw, h / ih);
  ctx.drawImage(img, (w - iw * scale) / 2, (h - ih * scale) / 2, iw * scale, ih * scale);
}

export function buildFallbackBackground(width: number, height: number, theme: BackgroundTheme): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = theme === "grey1200" ? "#121317" : theme === "white" ? "#FFFFFF" : "#283845";
  ctx.fillRect(0, 0, width, height);
  return c;
}

interface Props {
  width: number;
  height: number;
  shape: PanelShape;
  theme: BackgroundTheme;
  isOpen: boolean;
  onToggleMenu: (open: boolean) => void;
  onExportPng: (canvas: HTMLCanvasElement, sizeStr: string, shape: PanelShape) => void;
  onExportSvg: (svgStr: string, sizeStr: string, shape: PanelShape) => void;
}

export function StickerCard({ width, height, shape, theme, isOpen, onToggleMenu, onExportPng, onExportSvg }: Props) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const lockedOpacity = LOCKED_THEME_OPACITY[theme] / 100;

  useEffect(() => {
    setPreviewUrl("");
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !cancelled) {
          obs.disconnect();
          const sc = Math.min(1, 220 / Math.max(width, height));
          const thumb = renderStandaloneGlassPanel({
            width: Math.max(20, Math.round(width * sc)),
            height: Math.max(20, Math.round(height * sc)),
            shape,
            theme,
            frostOpacity: lockedOpacity,
            customRadius: Math.max(4, 20 * sc),
          });
          if (!cancelled) setPreviewUrl(thumb.toDataURL("image/png"));
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [width, height, shape, theme, lockedOpacity]);

  return (
    <div
      ref={cardRef}
      onClick={(e) => {
        e.stopPropagation();
        onToggleMenu(!isOpen);
      }}
      className={`relative group flex flex-col items-end justify-between gap-2 p-3.5 rounded-xl border transition cursor-pointer w-full ${
        theme === "white"
          ? "border-neutral-200/80 hover:border-neutral-400 bg-white"
          : "border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.06]"
      } ${isOpen ? "ring-2 ring-blue-500/70" : ""}`}
    >
      <div className="relative w-full h-28 flex items-center justify-center overflow-hidden p-1">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`${width}px X ${height}px`}
            className={`max-w-full max-h-full object-contain transition-transform ${
              isOpen ? "scale-[0.98] opacity-40" : "group-hover:scale-[1.03]"
            }`}
          />
        ) : (
          <div className="w-16 h-10 rounded-lg bg-neutral-400/10 animate-pulse" />
        )}
        {isOpen && (
          <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-20 flex items-center justify-center p-2">
            <div className="w-40 rounded-xl bg-white text-[#121317] shadow-xl border border-neutral-200 overflow-hidden flex flex-col divide-y divide-neutral-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (busy) return;
                  setBusy(true);
                  requestAnimationFrame(() => {
                    onExportPng(renderStandaloneGlassPanel({ width, height, shape, theme, frostOpacity: lockedOpacity }), `${width}x${height}`, shape);
                    setBusy(false);
                    onToggleMenu(false);
                  });
                }}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 cursor-pointer"
              >
                {busy ? "Exporting..." : "Export .png"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExportSvg(generateStandaloneGlassSvg({ width, height, shape, theme, frostOpacity: lockedOpacity }), `${width}x${height}`, shape);
                  onToggleMenu(false);
                }}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 cursor-pointer"
              >
                Export .svg
              </button>
            </div>
          </div>
        )}
      </div>
      <span className={`text-[11px] font-medium ${theme === "white" ? "text-neutral-700" : "text-neutral-300"}`}>
        {`${width}px X ${height}px`}
      </span>
    </div>
  );
}
