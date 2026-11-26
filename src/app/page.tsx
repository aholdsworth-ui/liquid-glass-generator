"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, RotateCcw, Download, Check, Upload, ExternalLink, X, Folder, Search, ChevronRight } from "lucide-react";
import { PAGE_ASSETS, BG_ASSETS, BUTTON_ZONES, GFS_MOMENTUM_DRIVE_URL, ZoneRect } from "@/lib/assetPaths";
import { PanelShape, BackgroundTheme, STICKER_CATEGORIES, renderStandaloneGlassPanel, generateStandaloneGlassSvg, renderRefractedGlassPatch } from "@/lib/liquidGlassEngine";
import { LoadedMedia, PanelInstance, loadUniversalMediaFile, getMediaFrameAt, renderFrameWithPanels, exportMultiPanelSvg, exportCompositedMp4 } from "@/lib/mediaSupport";
import { exportCompositedGif } from "@/lib/gifStudioEncoder";
import { GFS_MOMENTUM_FOLDER_ID, DriveItem, getConfiguredGoogleClientId, getDriveAccessToken, listDriveFolderItems, downloadDriveFileDirect , MomentumDropzoneModal } from "@/lib/driveDirectPicker";
import { RecentUploadItem, RecentCreationItem, getRecentUploads, getRecentCreations, loadBlobAsFile, deleteRecentUpload, saveRecentCreation, deleteRecentCreation, registerExportListener, notifyExportTriggered, onUploadsChanged } from "@/lib/historyStore";
import { RecentUploadsModal, RecentCreationsModal, RecentCreationsNavButton } from "@/lib/HistoryModals";


type ScreenId = "home" | "slides-pre" | "slides-create-cover" | "slides-fullbleed" | "slides-workspace" | "sticker-cover" | "sticker-sheet" | "bg-upload-cover" | "bg-workspace";
type ResizePreset = "no-resize" | "1:1" | "4:5" | "9:16" | "16:9" | "custom";

const FORMAT_PRESETS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

function makeFallbackSlideBg(w: number, h: number, theme: BackgroundTheme): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = theme === "grey1200" ? "#121317" : "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.filter = `blur(${Math.round(Math.min(w, h) * 0.032)}px)`;
  ["#EA4335", theme === "white" ? "#FDE293" : "#FBBC04", "#34A853", "#4285F4"].forEach((col, i) => {
    ctx.beginPath();
    const off = -0.06 + i * 0.085;
    ctx.moveTo(w * (0.58 + off), -h * 0.08);
    ctx.bezierCurveTo(w * (0.92 + off), h * 0.25, w * (0.34 + off), h * 0.65, w * (0.58 + off), h * 1.08);
    ctx.lineWidth = Math.min(w, h) * (0.08 + i * 0.04);
    ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.stroke();
  });
  ctx.restore();
  return c;
}

export default function Page() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [theme, setTheme] = useState<BackgroundTheme>("imagery");
  const [imageryIdx, setImageryIdx] = useState(0);

  const [slideFormat, setSlideFormat] = useState<"1:1" | "4:5" | "9:16" | "16:9">("1:1");
  const [slideShape, setSlideShape] = useState<PanelShape>("text-panel");
  const [slideW, setSlideW] = useState("420");
  const [slideH, setSlideH] = useState("180");
  const [slideOpacity, setSlideOpacity] = useState(50);
  const [slidePos, setSlidePos] = useState({ x: 330, y: 450 });
  const slideBgImgRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const slideCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [resizeMode, setResizeMode] = useState<ResizePreset>("no-resize");
  const [customFrameW, setCustomFrameW] = useState("1920");
  const [customFrameH, setCustomFrameH] = useState("1080");
  const [mediaScale, setMediaScale] = useState(1);
  const [mediaPan, setMediaPan] = useState({ x: 0, y: 0 });
  const [bgOpacity, setBgOpacity] = useState(50);
  const [panels, setPanels] = useState<PanelInstance[]>([
    { id: "p1", shape: "text-panel", theme: "imagery", widthInput: "600", heightInput: "260", x: 240, y: 240 },
  ]);
  const [exportingMotion, setExportingMotion] = useState<null | { fmt: "mp4" | "gif"; pct: number }>(null);

  const [showMomentumModal, setShowMomentumModal] = useState(false);
  const [clientIdInput, setClientIdInput] = useState("");
  const [driveToken, setDriveToken] = useState("");
  const [driveStack, setDriveStack] = useState<{ id: string; name: string }[]>([{ id: GFS_MOMENTUM_FOLDER_ID, name: "GFS Momentum" }]);
  const [driveItems, setDriveItems] = useState<DriveItem[]>([]);
  const [driveSearch, setDriveSearch] = useState("");
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [driveDownloadStatus, setDriveDownloadStatus] = useState("");
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const [stickerFilter, setStickerFilter] = useState("all");
  const [openStickerKey, setOpenStickerKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bgStageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewTransformRef = useRef({ scale: 1, ox: 0, oy: 0 });
  const dragRef = useRef<{
    kind: "none" | "slide-panel" | "bg-panel" | "bg-pan" | "bg-corner";
    panelIdx?: number; corner?: "tl" | "tr" | "bl" | "br";
    dx?: number; dy?: number; anchorX?: number; anchorY?: number;
    startScale?: number; startDist?: number;
    startPanX?: number; startPanY?: number; startClickX?: number; startClickY?: number;
  }>({ kind: "none" });

  const frameDims = !media
    ? { width: 1920, height: 1080 }
    : resizeMode === "no-resize"
    ? { width: media.width, height: media.height }
    : resizeMode === "custom"
    ? { width: Math.max(64, parseInt(customFrameW || "1080", 10) || 1080), height: Math.max(64, parseInt(customFrameH || "1080", 10) || 1080) }
    : FORMAT_PRESETS[resizeMode];

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3200); };

  useEffect(() => {
    setClientIdInput(getConfiguredGoogleClientId());
    const close = () => setOpenStickerKey(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    if (screen !== "slides-workspace") return;
    const { width, height } = FORMAT_PRESETS[slideFormat];
    const url = theme === "imagery" ? (BG_ASSETS.imageryExamples[imageryIdx] || BG_ASSETS.imageryExamples[0]) : theme === "grey1200" ? BG_ASSETS.grey1200 : BG_ASSETS.white;
    const pw = Math.max(60, parseInt(slideW || "420", 10) || 420), ph = slideShape === "circle" ? pw : Math.max(60, parseInt(slideH || "180", 10) || 180);
    setSlidePos({ x: Math.round((width - pw) / 2), y: Math.round((height - ph) / 2) });
    if (url) {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement("canvas"); c.width = width; c.height = height;
        const s = Math.max(width / im.naturalWidth, height / im.naturalHeight);
        c.getContext("2d")!.drawImage(im, (width - im.naturalWidth * s) / 2, (height - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
        slideBgImgRef.current = c;
      };
      im.onerror = () => { slideBgImgRef.current = makeFallbackSlideBg(width, height, theme); };
      im.src = url;
    } else slideBgImgRef.current = makeFallbackSlideBg(width, height, theme);
  }, [screen, slideFormat, theme, imageryIdx]);

  useEffect(() => {
    if (screen !== "slides-workspace") return;
    let raf = 0;
    const render = () => {
      const c = slideCanvasRef.current, bg = slideBgImgRef.current;
      if (c && bg) {
        const { width, height } = FORMAT_PRESETS[slideFormat];
        if (c.width !== width || c.height !== height) { c.width = width; c.height = height; }
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, width, height); ctx.drawImage(bg, 0, 0, width, height);
        const pw = Math.max(24, parseInt(slideW || "0", 10) || 0), ph = slideShape === "circle" ? pw : Math.max(24, parseInt(slideH || "0", 10) || 0);
        if (pw >= 24 && ph >= 24) {
          const patch = renderRefractedGlassPatch(bg, width, height, slidePos.x, slidePos.y, { width: pw, height: ph, shape: slideShape, theme, frostOpacity: slideOpacity / 100 });
          ctx.drawImage(patch, Math.round(slidePos.x - (patch.width - pw) / 2), Math.round(slidePos.y - (patch.height - ph) / 2));
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [screen, slideFormat, slideW, slideH, slideShape, theme, slideOpacity, slidePos]);

  useEffect(() => {
    if (screen !== "bg-workspace" || !media) return;
    let raf = 0;
    const STAGE_W = 860, STAGE_H = 700, PAD = 58;
    const renderLoop = (now: number) => {
      if (exportingMotion?.fmt === "gif") { raf = requestAnimationFrame(renderLoop); return; }
      const canvas = bgStageCanvasRef.current;
      if (canvas) {
        if (canvas.width !== STAGE_W || canvas.height !== STAGE_H) { canvas.width = STAGE_W; canvas.height = STAGE_H; }
        const ctx = canvas.getContext("2d")!;
        const fw = frameDims.width, fh = frameDims.height;

        // Format frame size & position ALWAYS stay locked regardless of image scale or pan
        const vs = Math.min((STAGE_W - PAD * 2) / fw, (STAGE_H - PAD * 2) / fh);
        const ox = (STAGE_W - fw * vs) / 2, oy = (STAGE_H - fh * vs) / 2;
        viewTransformRef.current = { scale: vs, ox, oy };

        const scaledW = media.width * mediaScale, scaledH = media.height * mediaScale;
        const mx = fw / 2 + mediaPan.x - scaledW / 2, my = fh / 2 + mediaPan.y - scaledH / 2;

        ctx.clearRect(0, 0, STAGE_W, STAGE_H);
        ctx.fillStyle = "#F4F5F7"; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
        const drawable = getMediaFrameAt(media, now);

        // Overhang outside the stage crops off cleanly at STAGE_W x STAGE_H
        ctx.drawImage(drawable, ox + mx * vs, oy + my * vs, scaledW * vs, scaledH * vs);
        ctx.save(); ctx.fillStyle = "rgba(244, 245, 247, 0.76)"; ctx.beginPath(); ctx.rect(0, 0, STAGE_W, STAGE_H); ctx.rect(ox, oy, fw * vs, fh * vs); ctx.fill("evenodd"); ctx.restore();

        const pW = Math.max(64, Math.round(fw * vs)), pH = Math.max(64, Math.round(fh * vs));
        const fBuf = document.createElement("canvas"); fBuf.width = pW; fBuf.height = pH;
        const pPanels = panels.map((p) => ({
          ...p, x: p.x * vs, y: p.y * vs,
          widthInput: String(Math.max(24, Math.round((parseInt(p.widthInput || "0", 10) || 0) * vs))),
          heightInput: String(Math.max(24, Math.round((parseInt(p.heightInput || "0", 10) || 0) * vs))),
        }));
        renderFrameWithPanels(fBuf.getContext("2d")!, pW, pH, drawable, mx * vs, my * vs, scaledW * vs, scaledH * vs, pPanels, bgOpacity / 100);
        ctx.drawImage(fBuf, ox, oy);

        ctx.strokeStyle = "#121317"; ctx.lineWidth = 1.75; ctx.strokeRect(ox, oy, fw * vs, fh * vs);
        const rx = ox + mx * vs, ry = oy + my * vs, rw = scaledW * vs, rh = scaledH * vs;
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(18,19,23,0.45)"; ctx.lineWidth = 1; ctx.strokeRect(rx, ry, rw, rh); ctx.restore();
        for (const [cx, cy] of [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]) {
          const hcx = Math.max(9, Math.min(STAGE_W - 9, cx)), hcy = Math.max(9, Math.min(STAGE_H - 9, cy));
          ctx.beginPath(); ctx.arc(hcx, hcy, 6.5, 0, Math.PI * 2); ctx.fillStyle = "#FFF"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#121317"; ctx.stroke();
        }
      }
      raf = requestAnimationFrame(renderLoop);
    };
    raf = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(raf);
  }, [screen, media, frameDims.width, frameDims.height, mediaScale, mediaPan, panels, bgOpacity, exportingMotion?.fmt]);

  const applyLoadedMedia = (loaded: LoadedMedia) => {
    setMedia(loaded); setResizeMode("no-resize"); setCustomFrameW(String(loaded.width)); setCustomFrameH(String(loaded.height));
    setMediaScale(1); setMediaPan({ x: 0, y: 0 }); setBgOpacity(50);
    const iw = Math.min(560, Math.max(120, Math.round(loaded.width * 0.36))), ih = Math.min(220, Math.max(80, Math.round(loaded.height * 0.22)));
    setPanels([{ id: "p1", shape: "text-panel", theme: "imagery", widthInput: String(iw), heightInput: String(ih), x: Math.round((loaded.width - iw) / 2), y: Math.round((loaded.height - ih) / 2) }]);
    setShowMomentumModal(false); setDriveDownloadStatus(""); setScreen("bg-workspace");
  };

  const handleIngestFile = async (file?: File | null) => {
    if (!file) return;
    setIsLoadingFile(true);
    try { applyLoadedMedia(await loadUniversalMediaFile(file)); }
    catch (err: any) { showToast(err?.message || "Could not open file"); }
    finally { setIsLoadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const openMomentumDriveBrowser = async (overrideId?: string) => {
    setShowMomentumModal(true); setDriveError("");
    const cid = (overrideId ?? clientIdInput ?? getConfiguredGoogleClientId()).trim();
    if (!cid) return;
    if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      window.localStorage.setItem("gfs_google_client_id", cid);
    }
    setDriveLoading(true);
    try {
      const tok = await getDriveAccessToken(cid);
      setDriveToken(tok);
      const curFolder = driveStack[driveStack.length - 1]?.id || GFS_MOMENTUM_FOLDER_ID;
      setDriveItems(await listDriveFolderItems(tok, curFolder));
    } catch (err: any) {
      setDriveError(err?.message || "Could not connect to Google Drive");
    } finally {
      setDriveLoading(false);
    }
  };

  const navigateDriveFolder = async (folderId: string, folderName: string, sliceTo?: number) => {
    if (!driveToken) return;
    setDriveLoading(true); setDriveError("");
    try {
      const nextStack = sliceTo !== undefined ? driveStack.slice(0, sliceTo + 1) : [...driveStack, { id: folderId, name: folderName }];
      setDriveStack(nextStack);
      setDriveItems(await listDriveFolderItems(driveToken, folderId));
    } catch (err: any) { setDriveError(err?.message || "Failed to load folder"); }
    finally { setDriveLoading(false); }
  };

  const selectMomentumDriveItem = async (item: DriveItem) => {
    if (item.isFolder) { navigateDriveFolder(item.targetId, item.name); return; }
    if (!driveToken) return;
    setDriveDownloadStatus(`Importing ${item.name} (0%)...`); setDriveError("");
    try {
      const file = await downloadDriveFileDirect(driveToken, item, (pct) => setDriveDownloadStatus(`Importing ${item.name} (${pct}%)...`));
      applyLoadedMedia(await loadUniversalMediaFile(file));
    } catch (err: any) {
      setDriveError(err?.message || "Failed to import file");
      setDriveDownloadStatus("");
    }
  };

  const applyResizePreset = (next: ResizePreset) => {
    setResizeMode(next);
    if (!media) return;
    const t = next === "no-resize" ? { width: media.width, height: media.height } : next === "custom" ? { width: Math.max(64, parseInt(customFrameW || "1080", 10)), height: Math.max(64, parseInt(customFrameH || "1080", 10)) } : FORMAT_PRESETS[next];
    setMediaScale(next === "no-resize" ? 1 : Math.max(t.width / media.width, t.height / media.height));
    setMediaPan({ x: 0, y: 0 });
    setPanels((prev) => prev.map((p, idx) => {
      const pw = Math.min(t.width - 40, Math.max(80, parseInt(p.widthInput || "300", 10) || 300));
      const ph = Math.min(t.height - 40, Math.max(60, parseInt(p.heightInput || "140", 10) || 140));
      return { ...p, widthInput: String(pw), heightInput: String(ph), x: Math.round((t.width - pw) / 2 + idx * 24), y: Math.round((t.height - ph) / 2 + idx * 24) };
    }));
  };

  const onBgStageDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!media || !bgStageCanvasRef.current) return;
    const cEl = bgStageCanvasRef.current, rect = cEl.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (cEl.width / rect.width), sy = (e.clientY - rect.top) * (cEl.height / rect.height);
    const { scale: vs, ox, oy } = viewTransformRef.current;
    const fw = frameDims.width, fh = frameDims.height, sw = media.width * mediaScale, sh = media.height * mediaScale;
    const mx = fw / 2 + mediaPan.x - sw / 2, my = fh / 2 + mediaPan.y - sh / 2;
    const fx = (sx - ox) / vs, fy = (sy - oy) / vs;

    const corners: { key: "tl" | "tr" | "bl" | "br"; cx: number; cy: number; ax: number; ay: number }[] = [
      { key: "tl", cx: ox + mx * vs, cy: oy + my * vs, ax: mx + sw, ay: my + sh },
      { key: "tr", cx: ox + (mx + sw) * vs, cy: oy + my * vs, ax: mx, ay: my + sh },
      { key: "bl", cx: ox + mx * vs, cy: oy + (my + sh) * vs, ax: mx + sw, ay: my },
      { key: "br", cx: ox + (mx + sw) * vs, cy: oy + (my + sh) * vs, ax: mx, ay: my },
    ];
    for (const c of corners) {
      const hcx = Math.max(9, Math.min(cEl.width - 9, c.cx)), hcy = Math.max(9, Math.min(cEl.height - 9, c.cy));
      if (Math.hypot(sx - hcx, sy - hcy) <= 16) {
        dragRef.current = { kind: "bg-corner", corner: c.key, anchorX: c.ax, anchorY: c.ay, startScale: mediaScale, startDist: Math.max(12, Math.hypot(fx - c.ax, fy - c.ay)) };
        e.currentTarget.setPointerCapture(e.pointerId); return;
      }
    }
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i], pw = Math.max(24, parseInt(p.widthInput || "0", 10) || 0), ph = p.shape === "circle" ? pw : Math.max(24, parseInt(p.heightInput || "0", 10) || 0);
      if (fx >= p.x && fx <= p.x + pw && fy >= p.y && fy <= p.y + ph) {
        dragRef.current = { kind: "bg-panel", panelIdx: i, dx: fx - p.x, dy: fy - p.y };
        e.currentTarget.setPointerCapture(e.pointerId); return;
      }
    }
    dragRef.current = { kind: "bg-pan", startPanX: mediaPan.x, startPanY: mediaPan.y, startClickX: fx, startClickY: fy };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onBgStageMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.kind === "none" || !media || !bgStageCanvasRef.current) return;
    const cEl = bgStageCanvasRef.current, rect = cEl.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (cEl.width / rect.width), sy = (e.clientY - rect.top) * (cEl.height / rect.height);
    const { scale: vs, ox, oy } = viewTransformRef.current;
    const fx = (sx - ox) / vs, fy = (sy - oy) / vs;
    if (dragRef.current.kind === "bg-corner") {
      const { anchorX = 0, anchorY = 0, corner, startScale = 1, startDist = 100 } = dragRef.current;
      const curDist = Math.max(8, Math.hypot(fx - anchorX, fy - anchorY));
      const ns = Math.max(0.08, Math.min(8, startScale * (curDist / startDist)));
      const nw = media.width * ns, nh = media.height * ns;
      const nmx = corner === "tl" || corner === "bl" ? anchorX - nw : anchorX;
      const nmy = corner === "tl" || corner === "tr" ? anchorY - nh : anchorY;
      setMediaScale(ns); setMediaPan({ x: nmx + nw / 2 - frameDims.width / 2, y: nmy + nh / 2 - frameDims.height / 2 });
    } else if (dragRef.current.kind === "bg-panel") {
      const idx = dragRef.current.panelIdx!, dx = dragRef.current.dx || 0, dy = dragRef.current.dy || 0;
      setPanels((prev) => prev.map((p, i) => {
        if (i !== idx) return p;
        const pw = Math.max(24, parseInt(p.widthInput || "0", 10) || 0), ph = p.shape === "circle" ? pw : Math.max(24, parseInt(p.heightInput || "0", 10) || 0);
        return { ...p, x: Math.max(-pw * 0.35, Math.min(frameDims.width - pw * 0.65, fx - dx)), y: Math.max(-ph * 0.35, Math.min(frameDims.height - ph * 0.65, fy - dy)) };
      }));
    } else if (dragRef.current.kind === "bg-pan") {
      setMediaPan({ x: (dragRef.current.startPanX || 0) + (fx - (dragRef.current.startClickX || 0)), y: (dragRef.current.startPanY || 0) + (fy - (dragRef.current.startClickY || 0)) });
    }
  };

  const onBgStageUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.kind !== "none") { dragRef.current = { kind: "none" }; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; setTimeout(() => notifyExportTriggered(String(filename)), 25); document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url); showToast(`Downloaded ${filename}`);
  };

  const exportBgPng = () => {
    if (!media) return;
    const fw = frameDims.width, fh = frameDims.height, sw = media.width * mediaScale, sh = media.height * mediaScale;
    const out = document.createElement("canvas"); out.width = fw; out.height = fh;
    renderFrameWithPanels(out.getContext("2d")!, fw, fh, getMediaFrameAt(media, 0), fw / 2 + mediaPan.x - sw / 2, fh / 2 + mediaPan.y - sh / 2, sw, sh, panels, bgOpacity / 100);
    out.toBlob((b) => b && downloadBlob(b, `glass-background-${fw}x${fh}.png`), "image/png");
  };

  const exportBgSvg = () => {
    if (!media) return;
    const fw = frameDims.width, fh = frameDims.height, sw = media.width * mediaScale, sh = media.height * mediaScale;
    const svg = exportMultiPanelSvg(fw, fh, getMediaFrameAt(media, 0), fw / 2 + mediaPan.x - sw / 2, fh / 2 + mediaPan.y - sh / 2, sw, sh, panels, bgOpacity / 100);
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `glass-background-${fw}x${fh}.svg`);
  };

  const runMotionExport = async (fmt: "mp4" | "gif") => {
    if (!media || exportingMotion !== null) return;
    const fw = frameDims.width, fh = frameDims.height, sw = media.width * mediaScale, sh = media.height * mediaScale;
    const mx = fw / 2 + mediaPan.x - sw / 2, my = fh / 2 + mediaPan.y - sh / 2;
    setExportingMotion({ fmt, pct: 0 });
    try {
      if (fmt === "mp4") {
        const blob = await exportCompositedMp4(media, fw, fh, mx, my, sw, sh, panels, bgOpacity / 100, (pct: number) => setExportingMotion({ fmt: "gif", pct }));
        downloadBlob(blob, `glass-motion-${Math.round(fw / 2) * 2}x${Math.round(fh / 2) * 2}.mp4`);
      } else {
        const blob = await exportCompositedGif(media, fw, fh, mx, my, sw, sh, panels, bgOpacity / 100, (pct: number) => setExportingMotion({ fmt: "gif", pct }));
        downloadBlob(blob, `glass-motion-${fw}x${fh}.gif`);
      }
    } catch { showToast(`Could not encode .${fmt} in this browser`); }
    finally { setExportingMotion(null); }
  };

  const renderZones = (zones: ZoneRect[] | undefined, actions: (() => void)[]) =>
    (zones || []).map((z, idx) => (
      <button key={idx} type="button" onClick={actions[idx]} style={{ left: `${z.left}%`, top: `${z.top}%`, width: `${z.width}%`, height: `${z.height}%` }} className="absolute z-20 bg-transparent cursor-pointer focus:outline-none" aria-label={`Option ${idx + 1}`} />
    ));

  const goBack = () => {
    if (screen === "slides-pre" || screen === "bg-upload-cover") setScreen("home");
    else if (screen === "sticker-cover" || screen === "slides-create-cover") setScreen("slides-pre");
    else if (screen === "sticker-sheet") setScreen("sticker-cover");
    else if (screen === "slides-fullbleed") setScreen("slides-create-cover");
    else if (screen === "slides-workspace") setScreen(theme === "imagery" ? "slides-fullbleed" : "slides-create-cover");
    else if (screen === "bg-workspace") setScreen("bg-upload-cover");
    else setScreen("home");
  };

  const visibleCats = stickerFilter === "all" ? STICKER_CATEGORIES : STICKER_CATEGORIES.filter((c) => c.id === stickerFilter);
  const filteredDriveItems = driveSearch.trim() ? driveItems.filter((i) => i.name.toLowerCase().includes(driveSearch.toLowerCase())) : driveItems;
  const activeClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || clientIdInput).trim();

  const [recentUploads, setRecentUploads] = useState<RecentUploadItem[]>([]);
  const [recentCreations, setRecentCreations] = useState<RecentCreationItem[]>([]);
  const [showRecentUploads, setShowRecentUploads] = useState(false);
  const [showRecentCreations, setShowRecentCreations] = useState(false);
  const hasRecentUploadsRef = useRef(false);
  hasRecentUploadsRef.current = recentUploads.length > 0;

  const isPlainVal = (v: any): boolean => {
    if (v === null || v === undefined) return true;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return true;
    if (typeof Element !== "undefined" && v instanceof Element) return false;
    if (typeof Blob !== "undefined" && v instanceof Blob) return false;
    if (Array.isArray(v)) return v.every(isPlainVal);
    if (t === "object") {
      const pr = Object.getPrototypeOf(v);
      return (pr === null || pr === Object.prototype) && Object.values(v).every(isPlainVal);
    }
    return false;
  };
  const clonePlain = (v: any): any => JSON.parse(JSON.stringify(v));
  const captureHistSnap = (): Record<string, any> => {
    const raw: Record<string, any> = { screen: screen, theme: theme, imageryIdx: imageryIdx, slideFormat: slideFormat, slideShape: slideShape, slideW: slideW, slideH: slideH, slideOpacity: slideOpacity, slidePos: slidePos, resizeMode: resizeMode, customFrameW: customFrameW, customFrameH: customFrameH, bgOpacity: bgOpacity, panels: panels };
    const out: Record<string, any> = {};
    Object.keys(raw).forEach((k) => { if (isPlainVal(raw[k])) out[k] = clonePlain(raw[k]); });
    return out;
  };
  const applyHistSnap = (sn: Record<string, any>) => { if ("screen" in sn) (setScreen as any)(clonePlain(sn["screen"])); if ("theme" in sn) (setTheme as any)(clonePlain(sn["theme"])); if ("imageryIdx" in sn) (setImageryIdx as any)(clonePlain(sn["imageryIdx"])); if ("slideFormat" in sn) (setSlideFormat as any)(clonePlain(sn["slideFormat"])); if ("slideShape" in sn) (setSlideShape as any)(clonePlain(sn["slideShape"])); if ("slideW" in sn) (setSlideW as any)(clonePlain(sn["slideW"])); if ("slideH" in sn) (setSlideH as any)(clonePlain(sn["slideH"])); if ("slideOpacity" in sn) (setSlideOpacity as any)(clonePlain(sn["slideOpacity"])); if ("slidePos" in sn) (setSlidePos as any)(clonePlain(sn["slidePos"])); if ("resizeMode" in sn) (setResizeMode as any)(clonePlain(sn["resizeMode"])); if ("customFrameW" in sn) (setCustomFrameW as any)(clonePlain(sn["customFrameW"])); if ("customFrameH" in sn) (setCustomFrameH as any)(clonePlain(sn["customFrameH"])); if ("bgOpacity" in sn) (setBgOpacity as any)(clonePlain(sn["bgOpacity"])); if ("panels" in sn) (setPanels as any)(clonePlain(sn["panels"])); };

  useEffect(() => {
    const refresh = () => {
      getRecentUploads().then(setRecentUploads).catch(() => {});
      getRecentCreations().then(setRecentCreations).catch(() => {});
    };
    refresh();
    onUploadsChanged(refresh);
    return () => onUploadsChanged(null);
  }, []);
  useEffect(() => {
    registerExportListener((fname: string) => {
      if (screen !== "bg-workspace" && screen !== "slides-workspace") return;
      const cvs = (Array.from(document.querySelectorAll("canvas")) as HTMLCanvasElement[]).filter((c) => c.width > 40 && c.height > 40).sort((a, b) => b.width * b.height - a.width * a.height);
      let thumb = "", lbl = "Panel export";
      if (cvs[0]) {
        lbl = `${cvs[0].width}x${cvs[0].height}`;
        const tc = document.createElement("canvas");
        const sc = Math.min(1, 380 / Math.max(cvs[0].width, cvs[0].height));
        tc.width = Math.max(2, Math.round(cvs[0].width * sc)); tc.height = Math.max(2, Math.round(cvs[0].height * sc));
        const tx = tc.getContext("2d");
        if (tx) { tx.drawImage(cvs[0], 0, 0, tc.width, tc.height); thumb = tc.toDataURL("image/jpeg", 0.84); }
      }
      const m = fname.match(/\.([a-z0-9]+)$/i);
      const raw: File | null = screen === "bg-workspace" ? ((media as any)?.__rawFile || null) : null;
      const pc = screen === "bg-workspace" && Array.isArray(panels) ? panels.length : 1;
      saveRecentCreation({ file: raw, label: lbl, exportExt: m ? `.${m[1].toUpperCase()}` : ".PNG", panelCount: pc, thumbUrl: thumb, snapshot: captureHistSnap() }).then(() => getRecentCreations().then(setRecentCreations)).catch(() => {});
    });
    return () => registerExportListener(null);
  });

  const handleRestoreCreation = async (item: RecentCreationItem) => {
    setShowRecentCreations(false);
    if (item.blobKey) {
      const f = await loadBlobAsFile(item.blobKey, item.fileName, item.fileType);
      if (f) applyLoadedMedia(await loadUniversalMediaFile(f));
    }
    applyHistSnap(item.snapshot);
    await new Promise<void>((r) => setTimeout(() => r(), 80));
    applyHistSnap(item.snapshot);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (screen === "bg-upload-cover" || screen === "bg-workspace" || showMomentumModal) handleIngestFile(e.dataTransfer.files?.[0]); }}
      className="min-h-screen w-full bg-[#F1F3F4] flex flex-col items-center py-4 md:py-6 px-3 md:px-6 font-sans text-[#121317]"
    >
      <input ref={fileInputRef} type="file" onClick={(e) => { if (hasRecentUploadsRef.current) { e.preventDefault(); setShowRecentUploads(true); } }} accept="image/*,video/*,.psd,.tif,.tiff,.gif,.mp4,.mov,.webm,.m4v,.png,.jpg,.jpeg,.webp,.svg,.avif,.bmp" className="hidden" onChange={(e) => handleIngestFile(e.target.files?.[0])} />

      <div className="w-full max-w-[1180px] flex items-center justify-between mb-2.5 h-8 px-1 sticky top-2 z-30">
        {screen !== "home" ? (
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-black bg-white/95 px-3 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            {screen === "bg-workspace" && (
              <>
                <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-black bg-white/95 px-3 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer"><Upload className="w-3.5 h-3.5" /> Replace file</button>
                <button onClick={() => openMomentumDriveBrowser()} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-black bg-white/95 px-3 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer"><Folder className="w-3.5 h-3.5" /> GFS Momentum Drive</button>
              </>
            )}
          </div>
        ) : <span />}
        <div className="flex items-center gap-3">
          {(toastMsg || isLoadingFile) && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shadow-sm"><Check className="w-3.5 h-3.5" /> {isLoadingFile ? "Loading asset..." : toastMsg}</span>}
          {screen !== "home" && <button onClick={() => setScreen("home")} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-black bg-white/95 px-3 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer"><RotateCcw className="w-3.5 h-3.5" /> Home</button>}
        <RecentCreationsNavButton count={recentCreations.length} onClick={() => setShowRecentCreations(true)} />
          </div>
      </div>

      <RecentUploadsModal open={showRecentUploads} items={recentUploads} onClose={() => setShowRecentUploads(false)} onPickUpload={async (u) => { setShowRecentUploads(false); const f = await loadBlobAsFile(u.blobKey, u.name, u.type); if (f) applyLoadedMedia(await loadUniversalMediaFile(f)); }} onPickNewFile={async (f) => { setShowRecentUploads(false); applyLoadedMedia(await loadUniversalMediaFile(f)); }} onDeleteUpload={async (id) => { await deleteRecentUpload(id); setRecentUploads(await getRecentUploads()); }} />
      <RecentCreationsModal open={showRecentCreations} items={recentCreations} onClose={() => setShowRecentCreations(false)} onRestore={handleRestoreCreation} onDelete={async (id) => { await deleteRecentCreation(id); setRecentCreations(await getRecentCreations()); }} />
      {showMomentumModal && <MomentumDropzoneModal onClose={() => setShowMomentumModal(false)} onSelectFile={async (f: File) => { setShowMomentumModal(false); applyLoadedMedia(await loadUniversalMediaFile(f)); }} />}

      {screen !== "sticker-sheet" ? (
        <div className="relative w-full max-w-[1180px] aspect-[16/9] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
          {screen === "home" && <><img src={PAGE_ASSETS.home} alt="Welcome" className="w-full h-full object-cover select-none" />{renderZones(BUTTON_ZONES.home, [() => setScreen("bg-upload-cover"), () => setScreen("slides-pre")])}</>}
          {screen === "slides-pre" && <><img src={PAGE_ASSETS.slidesPreCover} alt="Slides" className="w-full h-full object-cover select-none" />{renderZones(BUTTON_ZONES.slidesPreCover, [() => setScreen("sticker-cover"), () => setScreen("slides-create-cover")])}</>}
          {screen === "sticker-cover" && <><img src={PAGE_ASSETS.stickerCover} alt="Stickers" className="w-full h-full  select-none h-auto block" />{renderZones(BUTTON_ZONES.stickerCover, [() => { setTheme("imagery"); setStickerFilter("all"); setScreen("sticker-sheet"); }, () => { setTheme("grey1200"); setStickerFilter("all"); setScreen("sticker-sheet"); }, () => { setTheme("white"); setStickerFilter("all"); setScreen("sticker-sheet"); }])}</>}
          {screen === "slides-create-cover" && <><img src={PAGE_ASSETS.slidesCreateCover} alt="Create" className="w-full h-full object-cover select-none" />{renderZones(BUTTON_ZONES.slidesCreateCover, [() => { setTheme("imagery"); setSlideOpacity(50); setScreen("slides-fullbleed"); }, () => { setTheme("grey1200"); setSlideOpacity(50); setScreen("slides-workspace"); }, () => { setTheme("white"); setSlideOpacity(50); setScreen("slides-workspace"); }])}</>}
          {screen === "slides-fullbleed" && <><img src={PAGE_ASSETS.slidesFullBleedCover} alt="Examples" className="w-full h-full object-cover select-none" />{renderZones(BUTTON_ZONES.fullBleedPhotos, [0,1,2,3].map((i) => () => { setImageryIdx(i); setTheme("imagery"); setSlideOpacity(50); setScreen("slides-workspace"); }))}</>}
          {screen === "bg-upload-cover" && <><img src={PAGE_ASSETS.bgUploadCover} alt="Upload" className="w-full h-full object-cover select-none" />{renderZones(BUTTON_ZONES.bgUploadCover, [() => fileInputRef.current?.click(), () => openMomentumDriveBrowser()])}</>}

          {screen === "slides-workspace" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.slidesInternal} alt="" className="w-full h-full object-cover select-none pointer-events-none" />
              <div className="absolute z-10 left-[4.5%] w-[42.5%] top-[17%] bottom-[8%] flex items-center justify-center">
                <canvas
                  ref={slideCanvasRef}
                  onPointerDown={(e) => {
                    const c = slideCanvasRef.current; if (!c) return;
                    const r = c.getBoundingClientRect(), fx = (e.clientX - r.left) * (c.width / r.width), fy = (e.clientY - r.top) * (c.height / r.height);
                    const pw = Math.max(24, parseInt(slideW || "0", 10) || 0), ph = slideShape === "circle" ? pw : Math.max(24, parseInt(slideH || "0", 10) || 0);
                    dragRef.current = { kind: "slide-panel", dx: fx >= slidePos.x && fx <= slidePos.x + pw ? fx - slidePos.x : pw / 2, dy: fy >= slidePos.y && fy <= slidePos.y + ph ? fy - slidePos.y : ph / 2 };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (dragRef.current.kind !== "slide-panel" || !slideCanvasRef.current) return;
                    const c = slideCanvasRef.current, r = c.getBoundingClientRect(), fx = (e.clientX - r.left) * (c.width / r.width), fy = (e.clientY - r.top) * (c.height / r.height);
                    const pw = Math.max(24, parseInt(slideW || "0", 10) || 0), ph = slideShape === "circle" ? pw : Math.max(24, parseInt(slideH || "0", 10) || 0);
                    setSlidePos({ x: Math.max(-pw * 0.25, Math.min(c.width - pw * 0.75, fx - (dragRef.current.dx || 0))), y: Math.max(-ph * 0.25, Math.min(c.height - ph * 0.75, fy - (dragRef.current.dy || 0))) });
                  }}
                  onPointerUp={(e) => { dragRef.current = { kind: "none" }; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }}
                  className="max-w-full max-h-full object-contain shadow-sm cursor-grab active:cursor-grabbing"
                />
              </div>
              <div className="absolute z-10 left-[50%] right-[6%] top-[55%] bottom-[4%] flex flex-col gap-2">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-0.5"><label className="text-[10px] font-semibold">Format</label><select value={slideFormat} onChange={(e) => setSlideFormat(e.target.value as any)} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md"><option value="1:1">1:1</option><option value="4:5">4:5</option><option value="9:16">9:16</option><option value="16:9">16:9</option></select></div>
                  <div className="flex flex-col gap-0.5"><label className="text-[10px] font-semibold">Shape</label><select value={slideShape} onChange={(e) => setSlideShape(e.target.value as PanelShape)} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md"><option value="text-panel">Text panel</option><option value="circle">Circle</option><option value="cta-pill">CTA pill</option></select></div>
                </div>
                <div className="flex flex-col gap-0.5"><label className="text-[10px] font-semibold">Size</label><div className="flex items-center gap-2 text-[11px]"><input type="number" min={24} max={4000} value={slideW} onChange={(e) => setSlideW(e.target.value)} className="w-[72px] h-7 px-2 bg-white border border-neutral-800 rounded-md" /><span>{slideShape === "circle" ? "px diameter" : "px wide x"}</span>{slideShape !== "circle" && <><input type="number" min={24} max={4000} value={slideH} onChange={(e) => setSlideH(e.target.value)} className="w-[72px] h-7 px-2 bg-white border border-neutral-800 rounded-md" /><span>px high</span></>}</div></div>
                <div className="flex flex-col gap-0.5 max-w-[260px]"><div className="flex justify-between text-[10px]"><span className="font-semibold">Opacity</span><span className="text-neutral-500">{slideOpacity}%</span></div><input type="range" min={0} max={100} value={slideOpacity} onChange={(e) => setSlideOpacity(Number(e.target.value))} className="w-full accent-neutral-900 h-1.5 bg-neutral-300 rounded-lg cursor-pointer" /></div>
                <div className="pt-1 flex items-center gap-2">
                  <button onClick={() => { const pw = Math.max(24, parseInt(slideW || "0", 10) || 0), ph = slideShape === "circle" ? pw : Math.max(24, parseInt(slideH || "0", 10) || 0); renderStandaloneGlassPanel({ width: pw, height: ph, shape: slideShape, theme, frostOpacity: slideOpacity / 100 }).toBlob((b) => b && downloadBlob(b, `glass-${slideShape}-${theme}-${pw}x${ph}.png`), "image/png"); }} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white text-[11px] font-semibold transition cursor-pointer">Export .png</button>
                  <button onClick={() => { const pw = Math.max(24, parseInt(slideW || "0", 10) || 0), ph = slideShape === "circle" ? pw : Math.max(24, parseInt(slideH || "0", 10) || 0); downloadBlob(new Blob([generateStandaloneGlassSvg({ width: pw, height: ph, shape: slideShape, theme, frostOpacity: slideOpacity / 100 })], { type: "image/svg+xml;charset=utf-8" }), `glass-${slideShape}-${theme}-${pw}x${ph}.svg`); }} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white text-[11px] font-semibold transition cursor-pointer">Export .svg</button>
                </div>
              </div>
            </div>
          )}

          {screen === "bg-workspace" && media && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.bgInternal} alt="" className="w-full h-full object-cover select-none pointer-events-none" />
              <div className="absolute z-10 left-[4.2%] w-[43.5%] top-[16.5%] bottom-[7.5%] flex items-center justify-center">
                <canvas ref={bgStageCanvasRef} onPointerDown={onBgStageDown} onPointerMove={onBgStageMove} onPointerUp={onBgStageUp} className="max-w-full max-h-full object-contain rounded shadow-sm cursor-move" />
              </div>
              <div className="absolute z-10 left-[50%] right-[5%] top-[56.5%] bottom-[3.5%] overflow-y-auto pr-2 flex flex-col gap-2">
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="flex flex-col gap-0.5"><label className="text-[10px] font-semibold">Image resize</label><select value={resizeMode} onChange={(e) => applyResizePreset(e.target.value as ResizePreset)} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md"><option value="no-resize">No resize ({media.width}x{media.height})</option><option value="1:1">1:1 (1080x1080)</option><option value="4:5">4:5 (1080x1350)</option><option value="9:16">9:16 (1080x1920)</option><option value="16:9">16:9 (1920x1080)</option><option value="custom">Custom</option></select></div>
                  {resizeMode === "custom" && <div className="flex items-center gap-1.5 text-[11px]"><input type="number" min={64} max={6000} value={customFrameW} onChange={(e) => setCustomFrameW(e.target.value)} className="w-[68px] h-7 px-2 bg-white border border-neutral-800 rounded-md" /><span>x</span><input type="number" min={64} max={6000} value={customFrameH} onChange={(e) => setCustomFrameH(e.target.value)} className="w-[68px] h-7 px-2 bg-white border border-neutral-800 rounded-md" /><span>px</span></div>}
                </div>

                {panels.map((p, idx) => (
                  <div key={p.id} className={idx > 0 ? "pt-2 border-t border-neutral-200 space-y-1.5" : "space-y-1.5"}>
                    <div className="flex flex-wrap items-end gap-2.5">
                      <div className="flex flex-col gap-0.5"><label className="text-[10px] font-semibold">{idx === 0 ? "Shape" : `Panel ${idx + 1} shape`}</label><select value={p.shape} onChange={(e) => { const sh = e.target.value as PanelShape; setPanels((prev) => prev.map((it, i) => (i === idx ? { ...it, shape: sh } : it))); }} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md"><option value="text-panel">Text panel</option><option value="circle">Circle</option><option value="cta-pill">CTA pill</option></select></div>
                      <div className="flex flex-col gap-0.5"><label className="text-[10px] font-semibold">Rim calibration</label><select value={p.theme} onChange={(e) => { const th = e.target.value as BackgroundTheme; setPanels((prev) => prev.map((it, i) => (i === idx ? { ...it, theme: th } : it))); }} className="h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md"><option value="imagery">Full bleed image</option><option value="grey1200">Grey 1200</option><option value="white">White</option></select></div>
                    </div>
                    <div className="flex flex-col gap-0.5"><label className="text-[10px] font-semibold">Size</label><div className="flex items-center gap-2 text-[11px]"><input type="number" min={24} max={4000} value={p.widthInput} onChange={(e) => { const v = e.target.value; setPanels((prev) => prev.map((it, i) => (i === idx ? { ...it, widthInput: v, ...(it.shape === "circle" ? { heightInput: v } : {}) } : it))); }} className="w-[70px] h-7 px-2 bg-white border border-neutral-800 rounded-md" /><span>{p.shape === "circle" ? "px diameter" : "px wide x"}</span>{p.shape !== "circle" && <><input type="number" min={24} max={4000} value={p.heightInput} onChange={(e) => { const v = e.target.value; setPanels((prev) => prev.map((it, i) => (i === idx ? { ...it, heightInput: v } : it))); }} className="w-[70px] h-7 px-2 bg-white border border-neutral-800 rounded-md" /><span>px high</span></>}</div></div>
                    {idx === 0 && <div className="flex flex-col gap-0.5 max-w-[250px]"><div className="flex justify-between text-[10px]"><span className="font-semibold">Opacity</span><span className="text-neutral-500">{bgOpacity}%</span></div><input type="range" min={0} max={100} value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} className="w-full accent-neutral-900 h-1.5 bg-neutral-300 rounded-lg cursor-pointer" /></div>}
                    {idx < 5 && <div className="pt-0.5"><label className="inline-flex items-center gap-2 text-[10px] font-semibold cursor-pointer select-none"><span>Add another panel?</span><input type="checkbox" checked={panels.length > idx + 1} onChange={(e) => { if (e.target.checked) setPanels((prev) => [...prev, { id: `p-${Date.now()}`, shape: "text-panel", theme: prev[0].theme, widthInput: "420", heightInput: "160", x: Math.round(frameDims.width * 0.25 + (idx + 1) * 30), y: Math.round(frameDims.height * 0.28 + (idx + 1) * 30) }]); else setPanels((prev) => prev.slice(0, idx + 1)); }} className="w-3.5 h-3.5 rounded-full accent-neutral-900 cursor-pointer" /></label></div>}
                  </div>
                ))}

                <div className="pt-1 pb-2 flex flex-wrap items-center gap-2">
                  {media.isMotion ? (
                    <>
                      <button onClick={() => runMotionExport("mp4")} disabled={exportingMotion !== null} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-50 text-[11px] font-semibold transition cursor-pointer">{exportingMotion?.fmt === "mp4" ? `Exporting .mp4 (${exportingMotion.pct}%)` : "Export .mp4"}</button>
                      <button onClick={() => runMotionExport("gif")} disabled={exportingMotion !== null} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-50 text-[11px] font-semibold transition cursor-pointer">{exportingMotion?.fmt === "gif" ? `Exporting .gif (${exportingMotion.pct}%)` : "Export .gif"}</button>
                    </>
                  ) : (
                    <>
                      <button onClick={exportBgPng} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white text-[11px] font-semibold transition cursor-pointer">Export .png</button>
                      <button onClick={exportBgSvg} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white text-[11px] font-semibold transition cursor-pointer">Export .svg</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-[1180px] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200 flex flex-col">
          <img src={theme === "grey1200" ? PAGE_ASSETS.stickerGrey1200 : theme === "white" ? PAGE_ASSETS.stickerWhite : PAGE_ASSETS.stickerImagery} alt="Sticker sheet header" className="w-full h-auto block select-none h-auto block" />
          <div className="w-full bg-white pt-3 pb-8 px-6 flex flex-wrap items-center justify-center gap-2">
            {[{ id: "all", label: "All (80)" }, { id: "squares", label: "Squares (20)" }, { id: "horizontal", label: "Horizontal (20)" }, { id: "vertical", label: "Vertical (20)" }, { id: "pills", label: "CTA Pills (10)" }, { id: "circles", label: "Circles (10)" }].map((tab) => (
              <button key={tab.id} onClick={() => { setStickerFilter(tab.id); setOpenStickerKey(null); }} className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${stickerFilter === tab.id ? "bg-[#121317] text-white border-[#121317]" : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-900"}`}>{tab.label}</button>
            ))}
          </div>
          <div className={`w-full px-6 sm:px-10 py-10 space-y-12 ${theme === "grey1200" ? "bg-[#121317] text-white" : theme === "white" ? "bg-[#F8F9FA] text-[#121317] border-t border-neutral-200" : "bg-[#1E272C] text-white"}`}>
            {visibleCats.map((cat) => (
              <section key={cat.id} className="space-y-4">
                <div className="flex items-baseline justify-between border-b pb-2 border-current/15"><h3 className="text-lg font-medium">{cat.title}</h3><span className="text-xs opacity-60">{cat.count} sizes</span></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {cat.sizes.map(([w, h]) => {
                    const key = `${cat.id}-${w}x${h}`;
                    return <StickerSheetItem key={key} width={w} height={h} shape={cat.shape} theme={theme} isOpen={openStickerKey === key} onToggle={(open) => setOpenStickerKey(open ? key : null)} onDownload={downloadBlob} />;
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

function StickerSheetItem({ width, height, shape, theme, isOpen, onToggle, onDownload }: { width: number; height: number; shape: PanelShape; theme: BackgroundTheme; isOpen: boolean; onToggle: (open: boolean) => void; onDownload: (blob: Blob, name: string) => void; }) {
  const [thumb, setThumb] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setThumb(""); const el = ref.current; if (!el) return;
    let cancelled = false;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !cancelled) {
        obs.disconnect();
        const sc = Math.min(1, 210 / Math.max(width, height));
        const c = renderStandaloneGlassPanel({ width: Math.max(20, Math.round(width * sc)), height: Math.max(20, Math.round(height * sc)), shape, theme, frostOpacity: 0.5, customRadius: Math.max(4, 20 * sc) });
        if (!cancelled) setThumb(c.toDataURL("image/png"));
      }
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => { cancelled = true; obs.disconnect(); };
  }, [width, height, shape, theme]);

  return (
    <div ref={ref} onClick={(e) => { e.stopPropagation(); onToggle(!isOpen); }} className={`relative group flex flex-col items-end justify-between gap-2 p-3.5 rounded-xl border transition cursor-pointer ${theme === "white" ? "border-neutral-200 hover:border-neutral-400 bg-white" : "border-white/10 hover:border-white/25 bg-white/[0.03]"}`}>
      <div className="relative w-full h-28 flex items-center justify-center p-1">
        {thumb ? <img src={thumb} alt={`${width}x${height}`} className="max-w-full max-h-full object-contain" /> : <div className="w-16 h-10 rounded bg-neutral-400/10 animate-pulse" />}
        {isOpen && (
          <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-20 flex items-center justify-center p-2">
            <div className="w-40 rounded-xl bg-white text-[#121317] shadow-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
              <button onClick={() => { renderStandaloneGlassPanel({ width, height, shape, theme, frostOpacity: 0.5 }).toBlob((b) => b && onDownload(b, `sticker-${shape}-${theme}-${width}x${height}.png`), "image/png"); onToggle(false); }} className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 cursor-pointer">Export .png</button>
              <button onClick={() => { onDownload(new Blob([generateStandaloneGlassSvg({ width, height, shape, theme, frostOpacity: 0.5 })], { type: "image/svg+xml;charset=utf-8" }), `sticker-${shape}-${theme}-${width}x${height}.svg`); onToggle(false); }} className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 cursor-pointer">Export .svg</button>
            </div>
          </div>
        )}
      </div>
      <span className={`text-[11px] font-medium flex items-center gap-1.5 ${theme === "white" ? "text-neutral-700" : "text-neutral-300"}`}>{width}px X {height}px <Download className="w-3 h-3 opacity-60" /></span>
    </div>
  );
}
