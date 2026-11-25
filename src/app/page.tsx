"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PAGE_ASSETS, BG_ASSETS, BUTTON_ZONES, MOMENTUM_DRIVE_URL } from "@/lib/assetPaths";
import {
  PanelShape, BackgroundTheme, FormatRatio, ResolvedPanel, BgTransform,
  FORMAT_DIMENSIONS, LOCKED_STICKER_OPACITY, STICKER_CATEGORIES,
  renderStandaloneGlassPanel, generateStandaloneGlassSvg,
  getMediaDrawRect, drawCompositedStageFrame, generateCompositedMultiGlassSvg,
} from "@/lib/liquidGlassEngine";
import { MotionController, loadMotionFile, exportMotionMp4, exportMotionGif } from "@/lib/motionExporter";

type ScreenId = "home" | "slides-pre" | "sticker-bg-select" | "sticker-sheet" | "slides-bg-select" | "full-bleed-picker" | "slides-workspace" | "bg-upload" | "bg-workspace";
type ResizeOption = "no-resize" | "1:1" | "4:5" | "9:16" | "16:9" | "custom";

interface PanelState {
  id: string;
  shape: PanelShape;
  theme: BackgroundTheme;
  wIn: string;
  hIn: string;
  x: number;
  y: number;
}

function ZoneBtn({ z, label, onClick, href }: { z: [number, number, number, number]; label: string; onClick?: () => void; href?: string }) {
  const style: React.CSSProperties = { left: `${z[0]}%`, top: `${z[1]}%`, width: `${z[2]}%`, height: `${z[3]}%` };
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} style={style} className="absolute z-20 cursor-pointer bg-transparent rounded-full" />;
  }
  return <button type="button" aria-label={label} onClick={onClick} style={style} className="absolute z-20 cursor-pointer bg-transparent rounded-full focus:outline-none" />;
}

function StickerCard({ width, height, shape, theme, isOpen, onToggle, onPng, onSvg }: {
  width: number; height: number; shape: PanelShape; theme: BackgroundTheme;
  isOpen: boolean; onToggle: (v: boolean) => void;
  onPng: (c: HTMLCanvasElement, sz: string, sh: PanelShape) => void;
  onSvg: (s: string, sz: string, sh: PanelShape) => void;
}) {
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const op = LOCKED_STICKER_OPACITY / 100;

  useEffect(() => {
    setUrl("");
    const el = ref.current;
    if (!el) return;
    let dead = false;
    const obs = new IntersectionObserver((es) => {
      if (es[0]?.isIntersecting && !dead) {
        obs.disconnect();
        const sc = Math.min(1, 220 / Math.max(width, height));
        const c = renderStandaloneGlassPanel({ width: Math.max(20, Math.round(width * sc)), height: Math.max(20, Math.round(height * sc)), shape, theme, frostOpacity: op, customRadius: Math.max(4, 20 * sc) });
        if (!dead) setUrl(c.toDataURL("image/png"));
      }
    }, { rootMargin: "220px" });
    obs.observe(el);
    return () => { dead = true; obs.disconnect(); };
  }, [width, height, shape, theme, op]);

  return (
    <div
      ref={ref}
      onClick={(e) => { e.stopPropagation(); onToggle(!isOpen); }}
      className={`relative group flex flex-col items-end justify-between gap-2 p-3.5 rounded-xl border transition cursor-pointer w-full ${
        theme === "white" ? "border-neutral-200/80 hover:border-neutral-400 bg-white" : "border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.06]"
      } ${isOpen ? "ring-2 ring-blue-500/70" : ""}`}
    >
      <div className="relative w-full h-28 flex items-center justify-center overflow-hidden p-1">
        {url ? <img src={url} alt={`${width}x${height}`} className={`max-w-full max-h-full object-contain transition ${isOpen ? "opacity-35" : "group-hover:scale-[1.03]"}`} /> : <div className="w-16 h-10 rounded bg-neutral-400/10 animate-pulse" />}
        {isOpen && (
          <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-20 flex items-center justify-center p-2">
            <div className="w-40 rounded-xl bg-white text-[#121317] shadow-xl border border-neutral-200 overflow-hidden flex flex-col divide-y divide-neutral-100">
              <button type="button" onClick={() => { onPng(renderStandaloneGlassPanel({ width, height, shape, theme, frostOpacity: op }), `${width}x${height}`, shape); onToggle(false); }} className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 cursor-pointer">Export .png</button>
              <button type="button" onClick={() => { onSvg(generateStandaloneGlassSvg({ width, height, shape, theme, frostOpacity: op }), `${width}x${height}`, shape); onToggle(false); }} className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 cursor-pointer">Export .svg</button>
            </div>
          </div>
        )}
      </div>
      <span className={`text-[11px] font-medium ${theme === "white" ? "text-neutral-700" : "text-neutral-300"}`}>{`${width}px X ${height}px`}</span>
    </div>
  );
}

export default function Page() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [slidesTheme, setSlidesTheme] = useState<BackgroundTheme>("imagery");
  const [imageryIdx, setImageryIdx] = useState(0);
  const [slidesFormat, setSlidesFormat] = useState<FormatRatio>("1:1");
  const [slidesPanel, setSlidesPanel] = useState<PanelState>({ id: "s0", shape: "text-panel", theme: "imagery", wIn: "600", hIn: "180", x: 240, y: 450 });
  const [slidesOpacity, setSlidesOpacity] = useState(50);
  const [slidesBgImg, setSlidesBgImg] = useState<HTMLImageElement | null>(null);

  const [stickerTheme, setStickerTheme] = useState<BackgroundTheme>("imagery");
  const [stickerFilter, setStickerFilter] = useState("all");
  const [openStickerKey, setOpenStickerKey] = useState<string | null>(null);

  const [uploadedImg, setUploadedImg] = useState<HTMLImageElement | null>(null);
  const [motionCtrl, setMotionCtrl] = useState<MotionController | null>(null);
  const [mediaNat, setMediaNat] = useState({ width: 1920, height: 1080 });
  const [resizeOpt, setResizeOpt] = useState<ResizeOption>("no-resize");
  const [customStageW, setCustomStageW] = useState("1080");
  const [customStageH, setCustomStageH] = useState("1080");
  const [bgTransform, setBgTransform] = useState<BgTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [bgPanels, setBgPanels] = useState<PanelState[]>([{ id: "p1", shape: "text-panel", theme: "imagery", wIn: "600", hIn: "350", x: 160, y: 360 }]);
  const [bgOpacity, setBgOpacity] = useState(50);
  const [exportProgress, setExportProgress] = useState<string>("");
  const [toast, setToast] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ kind: "panel" | "bg"; idx: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const frameViewRef = useRef({ ox: 0, oy: 0, vw: 1080, vh: 1080 });

  const isMotion = !!motionCtrl;

  useEffect(() => {
    const close = () => setOpenStickerKey(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const bgStageDims = (() => {
    if (resizeOpt === "no-resize") return mediaNat;
    if (resizeOpt === "custom") return { width: Math.max(64, parseInt(customStageW || "1080", 10) || 1080), height: Math.max(64, parseInt(customStageH || "1080", 10) || 1080) };
    return { width: FORMAT_DIMENSIONS[resizeOpt].width, height: FORMAT_DIMENSIONS[resizeOpt].height };
  })();

  const activeStage = screen === "bg-workspace" ? bgStageDims : FORMAT_DIMENSIONS[slidesFormat];

  useEffect(() => {
    if (screen !== "slides-workspace") return;
    const url = slidesTheme === "imagery" ? BG_ASSETS.imagery[imageryIdx] : slidesTheme === "grey1200" ? BG_ASSETS.grey1200[slidesFormat] : BG_ASSETS.white[slidesFormat];
    if (!url) { setSlidesBgImg(null); return; }
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => setSlidesBgImg(im);
    im.src = url;
    const d = FORMAT_DIMENSIONS[slidesFormat];
    const pw = Math.max(60, parseInt(slidesPanel.wIn || "420", 10) || 420);
    const ph = slidesPanel.shape === "circle" ? pw : Math.max(60, parseInt(slidesPanel.hIn || "180", 10) || 180);
    setSlidesPanel((prev) => ({ ...prev, theme: slidesTheme, x: Math.round((d.width - pw) / 2), y: Math.round((d.height - ph) / 2) }));
  }, [screen, slidesTheme, imageryIdx, slidesFormat]);

  const toResolved = (p: PanelState, opPct: number): ResolvedPanel | null => {
    const w = Math.max(0, parseInt(p.wIn || "0", 10) || 0);
    const h = p.shape === "circle" ? w : Math.max(0, parseInt(p.hIn || "0", 10) || 0);
    if (w < 24 || h < 24) return null;
    return { x: p.x, y: p.y, width: w, height: h, shape: p.shape, theme: p.theme, frostOpacity: opPct / 100 };
  };

  const renderPreview = useCallback((nowMs: number) => {
    const c = canvasRef.current;
    if (!c) return;
    if (screen === "slides-workspace") {
      const d = FORMAT_DIMENSIONS[slidesFormat];
      c.width = d.width; c.height = d.height;
      frameViewRef.current = { ox: 0, oy: 0, vw: d.width, vh: d.height };
      const ctx = c.getContext("2d")!;
      const fallback = document.createElement("canvas"); fallback.width = d.width; fallback.height = d.height;
      const fCtx = fallback.getContext("2d")!; fCtx.fillStyle = slidesTheme === "grey1200" ? "#121317" : "#FFFFFF"; fCtx.fillRect(0, 0, d.width, d.height);
      const src = slidesBgImg || fallback;
      const sw = slidesBgImg ? slidesBgImg.naturalWidth : d.width, sh = slidesBgImg ? slidesBgImg.naturalHeight : d.height;
      const rp = toResolved({ ...slidesPanel, theme: slidesTheme }, slidesOpacity);
      drawCompositedStageFrame(ctx, src, sw, sh, d.width, d.height, { scale: 1, offsetX: 0, offsetY: 0 }, rp ? [rp] : []);
      return;
    }

    if (screen === "bg-workspace") {
      const src = motionCtrl ? motionCtrl.getCurrentSource(nowMs) : uploadedImg;
      if (!src) return;
      const sw = bgStageDims.width, sh = bgStageDims.height;
      const base = Math.max(sw / Math.max(1, mediaNat.width), sh / Math.max(1, mediaNat.height));
      const padX = resizeOpt === "no-resize" ? 0 : Math.max(0, Math.round((mediaNat.width * base - sw) / 2));
      const padY = resizeOpt === "no-resize" ? 0 : Math.max(0, Math.round((mediaNat.height * base - sh) / 2));
      const vw = sw + padX * 2, vh = sh + padY * 2;
      c.width = vw; c.height = vh;
      frameViewRef.current = { ox: padX, oy: padY, vw, vh };

      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#F1F3F4"; ctx.fillRect(0, 0, vw, vh);
      const { dx, dy, dw, dh } = getMediaDrawRect(mediaNat.width, mediaNat.height, sw, sh, bgTransform);
      ctx.drawImage(src, padX + dx, padY + dy, dw, dh);

      if (resizeOpt !== "no-resize") {
        ctx.fillStyle = "rgba(255,255,255,0.62)";
        ctx.fillRect(0, 0, vw, padY);
        ctx.fillRect(0, padY + sh, vw, padY);
        ctx.fillRect(0, padY, padX, sh);
        ctx.fillRect(padX + sw, padY, padX, sh);
      }

      const resolved = bgPanels.map((p) => toResolved(p, bgOpacity)).filter((x): x is ResolvedPanel => !!x);
      ctx.save();
      ctx.translate(padX, padY);
      drawCompositedStageFrame(ctx, src, mediaNat.width, mediaNat.height, sw, sh, bgTransform, resolved);
      if (resizeOpt !== "no-resize") {
        ctx.strokeStyle = "#121317"; ctx.lineWidth = Math.max(2, Math.round(Math.min(vw, vh) * 0.0025));
        ctx.strokeRect(0, 0, sw, sh);
      }
      ctx.restore();
    }
  }, [screen, slidesFormat, slidesTheme, slidesBgImg, slidesPanel, slidesOpacity, motionCtrl, uploadedImg, bgStageDims, mediaNat, resizeOpt, bgTransform, bgPanels, bgOpacity]);

  useEffect(() => {
    if (screen !== "slides-workspace" && screen !== "bg-workspace") return;
    if (screen === "bg-workspace" && motionCtrl) {
      let raf = 0;
      const tick = (t: number) => { renderPreview(t); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    renderPreview(performance.now());
  }, [screen, motionCtrl, renderPreview]);

  const autoDetectTheme = (src: CanvasImageSource): BackgroundTheme => {
    try {
      const s = document.createElement("canvas"); s.width = 24; s.height = 24;
      const c = s.getContext("2d")!; c.drawImage(src, 0, 0, 24, 24);
      const px = c.getImageData(0, 0, 24, 24).data;
      let lum = 0, wh = 0;
      for (let i = 0; i < px.length; i += 4) { lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; if (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240) wh++; }
      if (wh > 288) return "white";
      if (lum / 576 < 45) return "grey1200";
    } catch {}
    return "imagery";
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (motionCtrl) { motionCtrl.destroy(); setMotionCtrl(null); }
    setUploadedImg(null);

    const ext = file.name.toLowerCase();
    const motionFile = file.type.startsWith("video/") || file.type === "image/gif" || /\.(mp4|mov|webm|m4v|gif)$/.test(ext);

    if (motionFile) {
      try {
        const mc = await loadMotionFile(file);
        const det = autoDetectTheme(mc.getCurrentSource(0));
        setMediaNat({ width: mc.width, height: mc.height });
        setMotionCtrl(mc);
        setResizeOpt("no-resize");
        setBgTransform({ scale: 1, offsetX: 0, offsetY: 0 });
        setBgOpacity(50);
        const iw = Math.min(600, Math.round(mc.width * 0.42)), ih = Math.min(340, Math.round(mc.height * 0.28));
        setBgPanels([{ id: "p1", shape: "text-panel", theme: det, wIn: String(iw), hIn: String(ih), x: Math.round((mc.width - iw) / 2), y: Math.round((mc.height - ih) / 2) }]);
        setScreen("bg-workspace");
      } catch {
        setToast("Could not load motion file"); setTimeout(() => setToast(""), 3000);
      }
      return;
    }

    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const det = autoDetectTheme(im);
      setMediaNat({ width: im.naturalWidth, height: im.naturalHeight });
      setUploadedImg(im);
      setResizeOpt("no-resize");
      setBgTransform({ scale: 1, offsetX: 0, offsetY: 0 });
      setBgOpacity(50);
      const iw = Math.min(600, Math.round(im.naturalWidth * 0.42)), ih = Math.min(340, Math.round(im.naturalHeight * 0.28));
      setBgPanels([{ id: "p1", shape: "text-panel", theme: det, wIn: String(iw), hIn: String(ih), x: Math.round((im.naturalWidth - iw) / 2), y: Math.round((im.naturalHeight - ih) / 2) }]);
      setScreen("bg-workspace");
    };
    im.src = url;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const { ox, oy, vw, vh } = frameViewRef.current;
    const sx = (e.clientX - rect.left) * (vw / rect.width) - ox;
    const sy = (e.clientY - rect.top) * (vh / rect.height) - oy;

    const list = screen === "bg-workspace" ? bgPanels : [slidesPanel];
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      const w = Math.max(24, parseInt(p.wIn || "0", 10) || 0);
      const h = p.shape === "circle" ? w : Math.max(24, parseInt(p.hIn || "0", 10) || 0);
      if (sx >= p.x && sx <= p.x + w && sy >= p.y && sy <= p.y + h) {
        dragRef.current = { kind: "panel", idx: i, startX: sx, startY: sy, origX: p.x, origY: p.y };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (screen === "bg-workspace") {
      dragRef.current = { kind: "bg", idx: -1, startX: sx, startY: sy, origX: bgTransform.offsetX, origY: bgTransform.offsetY };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current, c = canvasRef.current;
    if (!d || !c) return;
    const rect = c.getBoundingClientRect();
    const { ox, oy, vw, vh } = frameViewRef.current;
    const sx = (e.clientX - rect.left) * (vw / rect.width) - ox;
    const sy = (e.clientY - rect.top) * (vh / rect.height) - oy;
    const dx = sx - d.startX, dy = sy - d.startY;

    if (d.kind === "bg") {
      setBgTransform((prev) => ({ ...prev, offsetX: Math.round(d.origX + dx), offsetY: Math.round(d.origY + dy) }));
    } else if (screen === "slides-workspace") {
      setSlidesPanel((prev) => ({ ...prev, x: Math.round(d.origX + dx), y: Math.round(d.origY + dy) }));
    } else {
      setBgPanels((prev) => prev.map((p, idx) => (idx === d.idx ? { ...p, x: Math.round(d.origX + dx), y: Math.round(d.origY + dy) } : p)));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) { dragRef.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }
  };

  const saveBlob = (blob: Blob, name: string) => {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(u);
    setToast(`Downloaded ${name}`); setTimeout(() => setToast(""), 2800);
  };

  const saveCanvas = (c: HTMLCanvasElement, name: string) => c.toBlob((b) => b && saveBlob(b, name), "image/png");
  const saveSvg = (s: string, name: string) => saveBlob(new Blob([s], { type: "image/svg+xml;charset=utf-8" }), name);

  const exportBgMp4OrGif = async (fmt: "mp4" | "gif") => {
    if (!motionCtrl || exportProgress) return;
    const resolved = bgPanels.map((p) => toResolved(p, bgOpacity)).filter((x): x is ResolvedPanel => !!x);
    if (!resolved.length) return;
    try {
      setExportProgress(`Exporting .${fmt} (1%)...`);
      const blob = fmt === "mp4"
        ? await exportMotionMp4(motionCtrl, bgStageDims.width, bgStageDims.height, bgTransform, resolved, (pct) => setExportProgress(`Exporting .mp4 (${pct}%)...`))
        : await exportMotionGif(motionCtrl, bgStageDims.width, bgStageDims.height, bgTransform, resolved, (pct) => setExportProgress(`Exporting .gif (${pct}%)...`));
      saveBlob(blob, `glass-motion-${bgStageDims.width}x${bgStageDims.height}.${fmt}`);
    } finally {
      setExportProgress("");
    }
  };

  const exportStaticBg = (fmt: "png" | "svg") => {
    if (!uploadedImg) return;
    const resolved = bgPanels.map((p) => toResolved(p, bgOpacity)).filter((x): x is ResolvedPanel => !!x);
    if (!resolved.length) return;
    const { width: sw, height: sh } = bgStageDims;
    if (fmt === "png") {
      const out = document.createElement("canvas"); out.width = sw; out.height = sh;
      drawCompositedStageFrame(out.getContext("2d")!, uploadedImg, mediaNat.width, mediaNat.height, sw, sh, bgTransform, resolved);
      saveCanvas(out, `glass-composited-${sw}x${sh}.png`);
    } else {
      saveSvg(generateCompositedMultiGlassSvg(uploadedImg, mediaNat.width, mediaNat.height, sw, sh, bgTransform, resolved), `glass-composited-${sw}x${sh}.svg`);
    }
  };

  const addExtraBgPanel = () => {
    if (bgPanels.length >= 6) return;
    const first = bgPanels[0];
    const offset = bgPanels.length * 36;
    setBgPanels([...bgPanels, { id: `p${Date.now()}`, shape: "text-panel", theme: first.theme, wIn: "420", hIn: "160", x: Math.max(20, Math.min(bgStageDims.width - 240, first.x + offset)), y: Math.max(20, Math.min(bgStageDims.height - 140, first.y + offset)) }]);
  };

  const stickerHeaderSrc = stickerTheme === "grey1200" ? PAGE_ASSETS.stickerHeaderGrey1200 : stickerTheme === "white" ? PAGE_ASSETS.stickerHeaderWhite : PAGE_ASSETS.stickerHeaderImagery;
  const cats = stickerFilter === "all" ? STICKER_CATEGORIES : STICKER_CATEGORIES.filter((c) => c.id === stickerFilter);

  return (
    <div className="min-h-screen w-full bg-[#F1F3F4] flex flex-col items-center py-4 md:py-6 px-3 md:px-6 font-sans text-[#121317]">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.m4v,.gif" className="hidden" onChange={handleUpload} />

      <div className="w-full max-w-[1200px] flex items-center justify-between mb-2.5 h-8 px-1 sticky top-2 z-30">
        <div className="flex items-center gap-2">
          {screen !== "home" && (
            <button onClick={() => {
              if (screen === "sticker-sheet") setScreen("sticker-bg-select");
              else if (screen === "sticker-bg-select" || screen === "slides-bg-select") setScreen("slides-pre");
              else if (screen === "full-bleed-picker") setScreen("slides-bg-select");
              else if (screen === "slides-workspace") setScreen(slidesTheme === "imagery" ? "full-bleed-picker" : "slides-bg-select");
              else if (screen === "bg-workspace") setScreen("bg-upload");
              else setScreen("home");
            }} className="text-xs font-medium text-neutral-700 hover:text-black bg-white/95 px-3.5 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer">← Back</button>
          )}
          {screen === "bg-workspace" && (
            <button onClick={() => fileRef.current?.click()} className="text-xs font-medium text-neutral-700 hover:text-black bg-white/95 px-3.5 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer">
              {isMotion ? "Replace motion file" : "Replace image"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {(toast || exportProgress) && (
            <span className="text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shadow-sm">{exportProgress || toast}</span>
          )}
          {screen !== "home" && (
            <button onClick={() => setScreen("home")} className="text-xs font-medium text-neutral-700 hover:text-black bg-white/95 px-3.5 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer">Home</button>
          )}
        </div>
      </div>

      {screen !== "sticker-sheet" ? (
        <div className="relative w-full max-w-[1200px] aspect-[16/9] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/90">
          {screen === "home" && (
            <>
              <img src={PAGE_ASSETS.home} alt="Welcome" className="w-full h-full object-cover select-none pointer-events-none" />
              <ZoneBtn z={BUTTON_ZONES.home[0]} label="Export panels for print and design" onClick={() => setScreen("bg-upload")} />
              <ZoneBtn z={BUTTON_ZONES.home[1]} label="Export panels for slides" onClick={() => setScreen("slides-pre")} />
            </>
          )}

          {screen === "slides-pre" && (
            <>
              <img src={PAGE_ASSETS.slidesPreCover} alt="Export panels for slides" className="w-full h-full object-cover select-none pointer-events-none" />
              <ZoneBtn z={BUTTON_ZONES.slidesPreCover[0]} label="Sticker sheets" onClick={() => setScreen("sticker-bg-select")} />
              <ZoneBtn z={BUTTON_ZONES.slidesPreCover[1]} label="Create panels for slides" onClick={() => setScreen("slides-bg-select")} />
            </>
          )}

          {screen === "sticker-bg-select" && (
            <>
              <img src={PAGE_ASSETS.stickerCover} alt="Sticker sheets" className="w-full h-full object-cover select-none pointer-events-none" />
              {(["imagery", "grey1200", "white"] as BackgroundTheme[]).map((th, i) => (
                <ZoneBtn key={th} z={BUTTON_ZONES.stickerCover[i]} label={th} onClick={() => { setStickerTheme(th); setStickerFilter("all"); setOpenStickerKey(null); setScreen("sticker-sheet"); }} />
              ))}
            </>
          )}

          {screen === "slides-bg-select" && (
            <>
              <img src={PAGE_ASSETS.slidesBgSelect} alt="Select background" className="w-full h-full object-cover select-none pointer-events-none" />
              <ZoneBtn z={BUTTON_ZONES.slidesBgSelect[0]} label="Full bleed imagery" onClick={() => { setSlidesTheme("imagery"); setSlidesOpacity(50); setScreen("full-bleed-picker"); }} />
              <ZoneBtn z={BUTTON_ZONES.slidesBgSelect[1]} label="Grey 1200" onClick={() => { setSlidesTheme("grey1200"); setSlidesOpacity(50); setSlidesFormat("1:1"); setScreen("slides-workspace"); }} />
              <ZoneBtn z={BUTTON_ZONES.slidesBgSelect[2]} label="White" onClick={() => { setSlidesTheme("white"); setSlidesOpacity(50); setSlidesFormat("1:1"); setScreen("slides-workspace"); }} />
            </>
          )}

          {screen === "full-bleed-picker" && (
            <>
              <img src={PAGE_ASSETS.fullBleedPicker} alt="Select example photo" className="w-full h-full object-cover select-none pointer-events-none" />
              {BUTTON_ZONES.fullBleedPicker.map((z, i) => (
                <ZoneBtn key={i} z={z} label={`Photo ${i + 1}`} onClick={() => { setImageryIdx(i); setSlidesTheme("imagery"); setSlidesOpacity(50); setSlidesFormat("1:1"); setScreen("slides-workspace"); }} />
              ))}
            </>
          )}

          {screen === "bg-upload" && (
            <>
              <img src={PAGE_ASSETS.bgUploadCover} alt="Export a panel on your background" className="w-full h-full object-cover select-none pointer-events-none" />
              <ZoneBtn z={BUTTON_ZONES.bgUploadCover[0]} label="Upload your file" onClick={() => fileRef.current?.click()} />
              <ZoneBtn z={BUTTON_ZONES.bgUploadCover[1]} label="Upload a GFS Momentum asset" href={MOMENTUM_DRIVE_URL} />
            </>
          )}

          {screen === "slides-workspace" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.slidesWorkspace} alt="" className="w-full h-full object-cover select-none pointer-events-none" />
              <div className="absolute z-10 left-[4.5%] w-[43%] top-[16%] bottom-[7%] flex items-center justify-center">
                <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="max-w-full max-h-full object-contain shadow-sm cursor-grab active:cursor-grabbing" />
              </div>
              <div className="absolute z-10 left-[50%] right-[5%] top-[56%] bottom-[4%] overflow-y-auto pr-2 flex flex-col gap-2">
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-semibold">Format</label>
                    <select value={slidesFormat} onChange={(e) => setSlidesFormat(e.target.value as FormatRatio)} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md">
                      <option value="1:1">1:1</option><option value="4:5">4:5</option><option value="9:16">9:16</option><option value="16:9">16:9</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-semibold">Shape</label>
                    <select value={slidesPanel.shape} onChange={(e) => { const sh = e.target.value as PanelShape; setSlidesPanel((p) => ({ ...p, shape: sh, hIn: sh === "circle" ? p.wIn : sh === "cta-pill" && parseInt(p.hIn, 10) > 140 ? "84" : p.hIn })); }} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md">
                      <option value="text-panel">Text panel</option><option value="circle">Circle</option><option value="cta-pill">CTA pill</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] font-semibold">Size</label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <input type="number" min={24} max={4000} value={slidesPanel.wIn} onChange={(e) => setSlidesPanel((p) => ({ ...p, wIn: e.target.value, hIn: p.shape === "circle" ? e.target.value : p.hIn }))} className="w-[68px] h-7 px-2 bg-white border border-neutral-800 rounded-md" />
                    <span>{slidesPanel.shape === "circle" ? "px diameter" : "px wide x"}</span>
                    {slidesPanel.shape !== "circle" && (<><input type="number" min={24} max={4000} value={slidesPanel.hIn} onChange={(e) => setSlidesPanel((p) => ({ ...p, hIn: e.target.value }))} className="w-[68px] h-7 px-2 bg-white border border-neutral-800 rounded-md" /><span>px high</span></>)}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 max-w-[260px]">
                  <div className="flex justify-between text-[10px]"><span className="font-semibold">Opacity</span><span className="text-neutral-500">{slidesOpacity}%</span></div>
                  <input type="range" min={0} max={100} value={slidesOpacity} onChange={(e) => setSlidesOpacity(Number(e.target.value))} className="w-full accent-neutral-900 h-1.5 bg-neutral-300 rounded-lg cursor-pointer" />
                </div>
                <div className="pt-1 flex gap-2">
                  <button onClick={() => { const rp = toResolved({ ...slidesPanel, theme: slidesTheme }, slidesOpacity); if (rp) saveCanvas(renderStandaloneGlassPanel(rp), `glass-${rp.shape}-${slidesTheme}-${rp.width}x${rp.height}.png`); }} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white text-[11px] font-semibold cursor-pointer">Export .png</button>
                  <button onClick={() => { const rp = toResolved({ ...slidesPanel, theme: slidesTheme }, slidesOpacity); if (rp) saveSvg(generateStandaloneGlassSvg(rp), `glass-${rp.shape}-${slidesTheme}-${rp.width}x${rp.height}.svg`); }} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white text-[11px] font-semibold cursor-pointer">Export .svg</button>
                </div>
              </div>
            </div>
          )}

          {screen === "bg-workspace" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.bgWorkspace} alt="" className="w-full h-full object-cover select-none pointer-events-none" />
              <div className="absolute z-10 left-[4.5%] w-[43%] top-[16%] bottom-[7%] flex items-center justify-center">
                <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="max-w-full max-h-full object-contain shadow-sm cursor-grab active:cursor-grabbing" />
              </div>

              <div className="absolute z-10 left-[50%] right-[4%] top-[55%] bottom-[3%] overflow-y-auto pr-2 flex flex-col gap-2">
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-semibold">Image resize</label>
                    <select value={resizeOpt} onChange={(e) => { setResizeOpt(e.target.value as ResizeOption); setBgTransform({ scale: 1, offsetX: 0, offsetY: 0 }); }} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md">
                      <option value="no-resize">No resize</option>
                      <option value="1:1">1:1 (1080x1080)</option>
                      <option value="4:5">4:5 (1080x1350)</option>
                      <option value="9:16">9:16 (1080x1920)</option>
                      <option value="16:9">16:9 (1920x1080)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5 w-[130px]">
                    <div className="flex justify-between text-[10px]"><span className="font-semibold">Scale</span><span className="text-neutral-500">{Math.round(bgTransform.scale * 100)}%</span></div>
                    <input type="range" min={25} max={250} value={Math.round(bgTransform.scale * 100)} onChange={(e) => setBgTransform((b) => ({ ...b, scale: Number(e.target.value) / 100 }))} className="w-full accent-neutral-900 h-1.5 bg-neutral-300 rounded-lg cursor-pointer" />
                  </div>
                </div>

                {resizeOpt === "custom" && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <input type="number" min={64} max={4000} value={customStageW} onChange={(e) => setCustomStageW(e.target.value)} className="w-[68px] h-7 px-2 bg-white border border-neutral-800 rounded-md" />
                    <span>px wide x</span>
                    <input type="number" min={64} max={4000} value={customStageH} onChange={(e) => setCustomStageH(e.target.value)} className="w-[68px] h-7 px-2 bg-white border border-neutral-800 rounded-md" />
                    <span>px high</span>
                  </div>
                )}

                {bgPanels.map((p, idx) => (
                  <div key={p.id} className={`flex flex-col gap-1.5 ${idx > 0 ? "pt-2 border-t border-neutral-200" : ""}`}>
                    {idx > 0 && (
                      <div className="flex items-center justify-between max-w-[280px]">
                        <span className="text-[10px] font-semibold text-neutral-700">Panel {idx + 1}</span>
                        <button type="button" onClick={() => setBgPanels((prev) => prev.filter((_, j) => j !== idx))} className="text-[10px] text-neutral-500 hover:text-red-600 cursor-pointer">Remove</button>
                      </div>
                    )}
                    <div className="flex flex-wrap items-end gap-2.5">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-semibold">Shape</label>
                        <select value={p.shape} onChange={(e) => { const sh = e.target.value as PanelShape; setBgPanels((prev) => prev.map((it, j) => j === idx ? { ...it, shape: sh, hIn: sh === "circle" ? it.wIn : sh === "cta-pill" && parseInt(it.hIn, 10) > 140 ? "84" : it.hIn } : it)); }} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md">
                          <option value="text-panel">Text panel</option><option value="circle">Circle</option><option value="cta-pill">CTA pill</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-semibold">Rim calibration</label>
                        <select value={p.theme} onChange={(e) => setBgPanels((prev) => prev.map((it, j) => j === idx ? { ...it, theme: e.target.value as BackgroundTheme } : it))} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md">
                          <option value="imagery">Full bleed image</option><option value="grey1200">Grey 1200</option><option value="white">White</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold">Size</label>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <input type="number" min={24} max={4000} value={p.wIn} onChange={(e) => setBgPanels((prev) => prev.map((it, j) => j === idx ? { ...it, wIn: e.target.value, hIn: it.shape === "circle" ? e.target.value : it.hIn } : it))} className="w-[68px] h-7 px-2 bg-white border border-neutral-800 rounded-md" />
                        <span>{p.shape === "circle" ? "px diameter" : "px wide x"}</span>
                        {p.shape !== "circle" && (<><input type="number" min={24} max={4000} value={p.hIn} onChange={(e) => setBgPanels((prev) => prev.map((it, j) => j === idx ? { ...it, hIn: e.target.value } : it))} className="w-[68px] h-7 px-2 bg-white border border-neutral-800 rounded-md" /><span>px high</span></>)}
                      </div>
                    </div>
                    {idx === 0 && (
                      <div className="flex flex-col gap-0.5 max-w-[260px]">
                        <div className="flex justify-between text-[10px]"><span className="font-semibold">Opacity</span><span className="text-neutral-500">{bgOpacity}%</span></div>
                        <input type="range" min={0} max={100} value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} className="w-full accent-neutral-900 h-1.5 bg-neutral-300 rounded-lg cursor-pointer" />
                      </div>
                    )}
                  </div>
                ))}

                {bgPanels.length < 6 && (
                  <label className="inline-flex items-center gap-2 text-[10px] font-semibold cursor-pointer select-none pt-0.5">
                    <input type="checkbox" checked={false} onChange={addExtraBgPanel} className="w-3.5 h-3.5 rounded-full accent-neutral-900 cursor-pointer" />
                    <span>Add another panel?</span>
                  </label>
                )}

                <div className="pt-1 pb-2 flex flex-wrap gap-2">
                  {isMotion ? (
                    <>
                      <button disabled={!!exportProgress} onClick={() => exportBgMp4OrGif("mp4")} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-45 text-[11px] font-semibold cursor-pointer">Export .mp4</button>
                      <button disabled={!!exportProgress} onClick={() => exportBgMp4OrGif("gif")} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-45 text-[11px] font-semibold cursor-pointer">Export .gif</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => exportStaticBg("png")} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white text-[11px] font-semibold cursor-pointer">Export .png</button>
                      <button onClick={() => exportStaticBg("svg")} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white text-[11px] font-semibold cursor-pointer">Export .svg</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full max-w-[1200px] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/90 flex flex-col">
          {stickerHeaderSrc && <img src={stickerHeaderSrc} alt={stickerTheme} className="w-full h-auto block select-none pointer-events-none" />}
          <div className="w-full bg-white py-3 px-6 flex flex-wrap items-center justify-center gap-2 border-b border-neutral-200">
            {[
              { id: "all", label: "All (80)" }, { id: "squares", label: "Squares (20)" },
              { id: "horizontal", label: "Horizontal (20)" }, { id: "vertical", label: "Vertical (20)" },
              { id: "pills", label: "CTA Pills (10)" }, { id: "circles", label: "Circles (10)" },
            ].map((t) => (
              <button key={t.id} onClick={() => { setStickerFilter(t.id); setOpenStickerKey(null); }} className={`px-3.5 py-1.5 rounded-full text-xs font-medium border cursor-pointer ${stickerFilter === t.id ? "bg-[#121317] text-white border-[#121317]" : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-900"}`}>{t.label}</button>
            ))}
          </div>
          <div className={`w-full px-6 sm:px-10 py-8 space-y-10 ${stickerTheme === "grey1200" ? "bg-[#121317] text-white" : stickerTheme === "white" ? "bg-[#F8F9FA] text-[#121317]" : "bg-[#1E272C] text-white"}`}>
            {cats.map((cat) => (
              <section key={cat.id} className="space-y-4">
                <div className="flex items-baseline justify-between border-b pb-2 border-current/15">
                  <h3 className="text-lg font-medium">{cat.title}</h3>
                  <span className="text-xs opacity-60">{cat.count} sizes</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {cat.sizes.map(([w, h]) => {
                    const k = `${cat.id}-${w}x${h}`;
                    return (
                      <StickerCard key={k} width={w} height={h} shape={cat.shape} theme={stickerTheme} isOpen={openStickerKey === k} onToggle={(v) => setOpenStickerKey(v ? k : null)} onPng={(c, sz, sh) => saveCanvas(c, `sticker-${sh}-${stickerTheme}-${sz}.png`)} onSvg={(s, sz, sh) => saveSvg(s, `sticker-${sh}-${stickerTheme}-${sz}.svg`)} />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
