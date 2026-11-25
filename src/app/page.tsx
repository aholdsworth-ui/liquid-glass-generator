"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PAGE_ASSETS, BG_ASSETS } from "@/lib/assetPaths";
import {
  PanelShape,
  BackgroundTheme,
  FormatRatio,
  FORMAT_DIMENSIONS,
  STICKER_CATEGORIES,
  renderStandaloneGlassPanel,
  renderRefractedGlassPatch,
  generateStandaloneGlassSvg,
  generateCompositedGlassSvg,
} from "@/lib/liquidGlassEngine";
import { StickerCard, drawCoverImage, buildFallbackBackground } from "@/components/StickerCard";

type ScreenId =
  | "home"
  | "opt1-pre-cover"
  | "opt1-sticker-cover"
  | "opt3-sheet"
  | "opt1-bg-select"
  | "opt1-imagery-select"
  | "opt1-workspace"
  | "opt2-upload"
  | "opt2-workspace";

type ResizeMode = "none" | "1:1" | "4:5" | "9:16" | "16:9" | "custom";

export default function Page() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [theme, setTheme] = useState<BackgroundTheme>("imagery");
  const [imageryIndex, setImageryIndex] = useState(0);
  const [format, setFormat] = useState<FormatRatio>("1:1");
  const [shape, setShape] = useState<PanelShape>("text-panel");
  const [widthInput, setWidthInput] = useState("420");
  const [heightInput, setHeightInput] = useState("180");
  const [opacitySlider, setOpacitySlider] = useState(50);

  const [activeStickerFilter, setActiveStickerFilter] = useState("all");
  const [openStickerMenuKey, setOpenStickerMenuKey] = useState<string | null>(null);

  const [resizeMode, setResizeMode] = useState<ResizeMode>("none");
  const [customCanvasWInput, setCustomCanvasWInput] = useState("1080");
  const [customCanvasHInput, setCustomCanvasHInput] = useState("1080");
  const [bgZoom, setBgZoom] = useState(100);
  const [bgPan, setBgPan] = useState({ x: 0, y: 0 });

  const [panelPos, setPanelPos] = useState({ x: 330, y: 450 });
  const [uploadedBgImg, setUploadedBgImg] = useState<HTMLImageElement | null>(null);
  const [uploadedBgDims, setUploadedBgDims] = useState({ width: 1920, height: 1080 });
  const [toastMsg, setToastMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageBgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const dragModeRef = useRef<"none" | "panel" | "pan-bg" | "scale-bg">("none");
  const dragStartRef = useRef({ cx: 0, cy: 0, panelX: 0, panelY: 0, panX: 0, panY: 0, startDist: 1, startZoom: 100, icx: 0, icy: 0 });
  const layoutRef = useRef({ padX: 0, padY: 0, targetW: 1080, targetH: 1080, drawX: 0, drawY: 0, drawW: 1080, drawH: 1080 });

  const opt2TargetDims =
    resizeMode === "none"
      ? uploadedBgDims
      : resizeMode === "custom"
      ? {
          width: Math.max(64, Math.min(6000, parseInt(customCanvasWInput || "0", 10) || 1080)),
          height: Math.max(64, Math.min(6000, parseInt(customCanvasHInput || "0", 10) || 1080)),
        }
      : { width: FORMAT_DIMENSIONS[resizeMode].width, height: FORMAT_DIMENSIONS[resizeMode].height };

  const parsedW = Math.max(0, parseInt(widthInput || "0", 10) || 0);
  const parsedH = shape === "circle" ? parsedW : Math.max(0, parseInt(heightInput || "0", 10) || 0);
  const hasValidSize = parsedW >= 24 && parsedH >= 24;

  useEffect(() => {
    const fn = () => setOpenStickerMenuKey(null);
    window.addEventListener("click", fn);
    return () => window.removeEventListener("click", fn);
  }, []);

  useEffect(() => {
    if (screen !== "opt1-workspace") return;
    const dims = FORMAT_DIMENSIONS[format];
    const srcUrl =
      theme === "imagery" ? BG_ASSETS.imagery[imageryIndex] || BG_ASSETS.imagery[0] : theme === "grey1200" ? BG_ASSETS.grey1200[format] : BG_ASSETS.white[format];
    const center = () =>
      setPanelPos({
        x: Math.max(16, Math.round((dims.width - Math.max(80, parsedW)) / 2)),
        y: Math.max(16, Math.round((dims.height - Math.max(80, parsedH)) / 2)),
      });
    if (!srcUrl) {
      stageBgCanvasRef.current = buildFallbackBackground(dims.width, dims.height, theme);
      center();
      return;
    }
    let dead = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (dead) return;
      const c = document.createElement("canvas");
      c.width = dims.width;
      c.height = dims.height;
      drawCoverImage(c.getContext("2d")!, img, dims.width, dims.height);
      stageBgCanvasRef.current = c;
      center();
    };
    img.onerror = () => {
      if (dead) return;
      stageBgCanvasRef.current = buildFallbackBackground(dims.width, dims.height, theme);
      center();
    };
    img.src = srcUrl;
    return () => {
      dead = true;
    };
  }, [screen, format, theme, imageryIndex]);

  const applyResizeMode = (nextMode: ResizeMode) => {
    setResizeMode(nextMode);
    setBgZoom(100);
    setBgPan({ x: 0, y: 0 });
    const nd =
      nextMode === "none"
        ? uploadedBgDims
        : nextMode === "custom"
        ? { width: Math.max(64, parseInt(customCanvasWInput || "0", 10) || 1080), height: Math.max(64, parseInt(customCanvasHInput || "0", 10) || 1080) }
        : FORMAT_DIMENSIONS[nextMode];
    const pw = Math.min(parsedW || 360, Math.round(nd.width * 0.8));
    const ph = Math.min(parsedH || 140, Math.round(nd.height * 0.8));
    if (parsedW > nd.width * 0.9) setWidthInput(String(pw));
    if (parsedH > nd.height * 0.9) setHeightInput(String(ph));
    setPanelPos({ x: Math.max(12, Math.round((nd.width - pw) / 2)), y: Math.max(12, Math.round((nd.height - ph) / 2)) });
  };

  const buildCroppedOpt2Background = useCallback((): HTMLCanvasElement | null => {
    if (!uploadedBgImg) return null;
    const tw = opt2TargetDims.width;
    const th = opt2TargetDims.height;
    const sc = Math.max(tw / uploadedBgDims.width, th / uploadedBgDims.height) * (bgZoom / 100);
    const dw = uploadedBgDims.width * sc;
    const dh = uploadedBgDims.height * sc;
    const c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = theme === "grey1200" ? "#121317" : "#FFFFFF";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(uploadedBgImg, tw / 2 + bgPan.x - dw / 2, th / 2 + bgPan.y - dh / 2, dw, dh);
    return c;
  }, [uploadedBgImg, uploadedBgDims, opt2TargetDims, bgZoom, bgPan, theme]);

  const drawWorkspace = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    if (screen === "opt1-workspace") {
      const bgSource = stageBgCanvasRef.current;
      if (!bgSource) return;
      const tw = FORMAT_DIMENSIONS[format].width;
      const th = FORMAT_DIMENSIONS[format].height;
      layoutRef.current = { padX: 0, padY: 0, targetW: tw, targetH: th, drawX: 0, drawY: 0, drawW: tw, drawH: th };
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, tw, th);
      ctx.drawImage(bgSource, 0, 0, tw, th);
      if (hasValidSize) {
        const patch = renderRefractedGlassPatch(bgSource, tw, th, panelPos.x, panelPos.y, {
          width: parsedW,
          height: parsedH,
          shape,
          theme,
          frostOpacity: opacitySlider / 100,
        });
        ctx.drawImage(patch, Math.round(panelPos.x - (patch.width - parsedW) / 2), Math.round(panelPos.y - (patch.height - parsedH) / 2));
      }
      return;
    }

    if (screen === "opt2-workspace" && uploadedBgImg) {
      const tw = opt2TargetDims.width;
      const th = opt2TargetDims.height;
      const baseCover = Math.max(tw / uploadedBgDims.width, th / uploadedBgDims.height);
      const natW = uploadedBgDims.width * baseCover;
      const natH = uploadedBgDims.height * baseCover;
      const sc = baseCover * (bgZoom / 100);
      const dw = uploadedBgDims.width * sc;
      const dh = uploadedBgDims.height * sc;
      const dx = tw / 2 + bgPan.x - dw / 2;
      const dy = th / 2 + bgPan.y - dh / 2;

      const padX = resizeMode === "none" ? Math.round(tw * 0.04) : Math.min(Math.round(tw * 0.45), Math.round(Math.max(tw * 0.08, (natW - tw) / 2 + tw * 0.05)));
      const padY = resizeMode === "none" ? Math.round(th * 0.04) : Math.min(Math.round(th * 0.45), Math.round(Math.max(th * 0.08, (natH - th) / 2 + th * 0.05)));
      layoutRef.current = { padX, padY, targetW: tw, targetH: th, drawX: dx, drawY: dy, drawW: dw, drawH: dh };

      const cw = tw + padX * 2;
      const ch = th + padY * 2;
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#F1F3F4";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(uploadedBgImg, padX + dx, padY + dy, dw, dh);

      // Grey out overhanging image outside the chosen format frame
      ctx.fillStyle = "rgba(241, 243, 244, 0.76)";
      ctx.fillRect(0, 0, cw, padY);
      ctx.fillRect(0, padY + th, cw, padY);
      ctx.fillRect(0, padY, padX, th);
      ctx.fillRect(padX + tw, padY, padX, th);

      const croppedBg = buildCroppedOpt2Background();
      if (croppedBg) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(padX, padY, tw, th);
        ctx.clip();
        ctx.drawImage(croppedBg, padX, padY, tw, th);
        if (hasValidSize) {
          const patch = renderRefractedGlassPatch(croppedBg, tw, th, panelPos.x, panelPos.y, {
            width: parsedW,
            height: parsedH,
            shape,
            theme,
            frostOpacity: opacitySlider / 100,
          });
          ctx.drawImage(patch, Math.round(padX + panelPos.x - (patch.width - parsedW) / 2), Math.round(padY + panelPos.y - (patch.height - parsedH) / 2));
        }
        ctx.restore();
      }

      const u = Math.max(2, Math.round(Math.max(cw, ch) * 0.0022));
      ctx.save();
      ctx.strokeStyle = "rgba(18,19,23,0.4)";
      ctx.setLineDash([u * 4, u * 3]);
      ctx.lineWidth = u;
      ctx.strokeRect(padX + dx, padY + dy, dw, dh);
      ctx.setLineDash([]);
      ctx.strokeStyle = "#121317";
      ctx.lineWidth = Math.max(2, u * 1.3);
      ctx.strokeRect(padX, padY, tw, th);

      const hr = Math.max(7, Math.round(Math.max(cw, ch) * 0.009));
      [
        [padX + dx, padY + dy],
        [padX + dx + dw, padY + dy],
        [padX + dx, padY + dy + dh],
        [padX + dx + dw, padY + dy + dh],
      ].forEach(([hx, hy]) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#121317";
        ctx.lineWidth = Math.max(2, u);
        ctx.beginPath();
        ctx.arc(Math.max(hr, Math.min(cw - hr, hx)), Math.max(hr, Math.min(ch - hr, hy)), hr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }
  }, [screen, format, uploadedBgImg, uploadedBgDims, opt2TargetDims, resizeMode, bgZoom, bgPan, buildCroppedOpt2Background, hasValidSize, parsedW, parsedH, panelPos, shape, theme, opacitySlider]);

  useEffect(() => {
    if (screen === "opt1-workspace" || screen === "opt2-workspace") drawWorkspace();
  }, [screen, drawWorkspace]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const rawX = (e.clientX - rect.left) * sx;
    const rawY = (e.clientY - rect.top) * sy;
    const { padX, padY, targetW, targetH, drawX, drawY, drawW, drawH } = layoutRef.current;
    const cx = rawX - padX;
    const cy = rawY - padY;

    if (hasValidSize && cx >= panelPos.x && cx <= panelPos.x + parsedW && cy >= panelPos.y && cy <= panelPos.y + parsedH) {
      dragModeRef.current = "panel";
      dragStartRef.current = { ...dragStartRef.current, cx, cy, panelX: panelPos.x, panelY: panelPos.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (screen === "opt2-workspace") {
      const hr = Math.max(7, Math.round(Math.max(canvas.width, canvas.height) * 0.009));
      const hit = [
        [drawX, drawY],
        [drawX + drawW, drawY],
        [drawX, drawY + drawH],
        [drawX + drawW, drawY + drawH],
      ].some(([kx, ky]) => Math.hypot(rawX - Math.max(hr, Math.min(canvas.width - hr, padX + kx)), rawY - Math.max(hr, Math.min(canvas.height - hr, padY + ky))) <= 22 * sx);

      if (hit) {
        const icx = drawX + drawW / 2;
        const icy = drawY + drawH / 2;
        dragModeRef.current = "scale-bg";
        dragStartRef.current = { ...dragStartRef.current, cx, cy, startDist: Math.max(20, Math.hypot(cx - icx, cy - icy)), startZoom: bgZoom, icx, icy };
      } else {
        dragModeRef.current = "pan-bg";
        dragStartRef.current = { ...dragStartRef.current, cx, cy, panX: bgPan.x, panY: bgPan.y };
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (hasValidSize) {
      const nx = Math.max(0, Math.min(targetW - parsedW, cx - parsedW / 2));
      const ny = Math.max(0, Math.min(targetH - parsedH, cy - parsedH / 2));
      setPanelPos({ x: nx, y: ny });
      dragModeRef.current = "panel";
      dragStartRef.current = { ...dragStartRef.current, cx, cy, panelX: nx, panelY: ny };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragModeRef.current === "none" || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const { padX, padY, targetW, targetH } = layoutRef.current;
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width) - padX;
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height) - padY;

    if (dragModeRef.current === "panel") {
      setPanelPos({
        x: Math.max(0, Math.min(targetW - parsedW, Math.round(dragStartRef.current.panelX + cx - dragStartRef.current.cx))),
        y: Math.max(0, Math.min(targetH - parsedH, Math.round(dragStartRef.current.panelY + cy - dragStartRef.current.cy))),
      });
    } else if (dragModeRef.current === "pan-bg") {
      setBgPan({ x: Math.round(dragStartRef.current.panX + cx - dragStartRef.current.cx), y: Math.round(dragStartRef.current.panY + cy - dragStartRef.current.cy) });
    } else if (dragModeRef.current === "scale-bg") {
      const dist = Math.max(10, Math.hypot(cx - dragStartRef.current.icx, cy - dragStartRef.current.icy));
      setBgZoom(Math.max(20, Math.min(300, Math.round(dragStartRef.current.startZoom * (dist / dragStartRef.current.startDist)))));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragModeRef.current !== "none") {
      dragModeRef.current = "none";
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const downloadCanvas = (canvas: HTMLCanvasElement, filename: string) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setToastMsg(`Downloaded ${filename}`);
      setTimeout(() => setToastMsg(""), 2800);
    }, "image/png");
  };

  const downloadSvg = (svgContent: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setToastMsg(`Downloaded ${filename}`);
    setTimeout(() => setToastMsg(""), 2800);
  };

  const handleExportPng = () => {
    if (!hasValidSize) return;
    if (screen === "opt1-workspace") {
      downloadCanvas(renderStandaloneGlassPanel({ width: parsedW, height: parsedH, shape, theme, frostOpacity: opacitySlider / 100 }), `glass-${shape}-${theme}-${parsedW}x${parsedH}.png`);
    } else if (screen === "opt2-workspace") {
      const croppedBg = buildCroppedOpt2Background();
      if (!croppedBg) return;
      const tw = opt2TargetDims.width;
      const th = opt2TargetDims.height;
      const out = document.createElement("canvas");
      out.width = tw;
      out.height = th;
      const ctx = out.getContext("2d")!;
      ctx.drawImage(croppedBg, 0, 0, tw, th);
      const patch = renderRefractedGlassPatch(croppedBg, tw, th, panelPos.x, panelPos.y, { width: parsedW, height: parsedH, shape, theme, frostOpacity: opacitySlider / 100 });
      ctx.drawImage(patch, Math.round(panelPos.x - (patch.width - parsedW) / 2), Math.round(panelPos.y - (patch.height - parsedH) / 2));
      downloadCanvas(out, `glass-artwork-${tw}x${th}.png`);
    }
  };

  const handleExportSvg = () => {
    if (!hasValidSize) return;
    if (screen === "opt1-workspace") {
      downloadSvg(generateStandaloneGlassSvg({ width: parsedW, height: parsedH, shape, theme, frostOpacity: opacitySlider / 100 }), `glass-${shape}-${theme}-${parsedW}x${parsedH}.svg`);
    } else if (screen === "opt2-workspace") {
      const croppedBg = buildCroppedOpt2Background();
      if (!croppedBg) return;
      downloadSvg(
        generateCompositedGlassSvg(croppedBg, opt2TargetDims.width, opt2TargetDims.height, panelPos.x, panelPos.y, { width: parsedW, height: parsedH, shape, theme, frostOpacity: opacitySlider / 100 }),
        `glass-artwork-${opt2TargetDims.width}x${opt2TargetDims.height}.svg`
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const sc = document.createElement("canvas");
      sc.width = 24;
      sc.height = 24;
      const sCtx = sc.getContext("2d")!;
      sCtx.drawImage(img, 0, 0, 24, 24);
      const px = sCtx.getImageData(0, 0, 24, 24).data;
      let lum = 0, whites = 0;
      for (let i = 0; i < px.length; i += 4) {
        lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240) whites++;
      }
      setTheme(whites > 288 ? "white" : lum / 576 < 45 ? "grey1200" : "imagery");
      setOpacitySlider(50);
      setResizeMode("none");
      setBgZoom(100);
      setBgPan({ x: 0, y: 0 });
      setUploadedBgDims({ width: img.naturalWidth, height: img.naturalHeight });
      setCustomCanvasWInput(String(img.naturalWidth));
      setCustomCanvasHInput(String(img.naturalHeight));
      setUploadedBgImg(img);
      const iw = Math.max(120, Math.min(480, Math.round(img.naturalWidth * 0.35)));
      const ih = Math.max(64, Math.min(190, Math.round(img.naturalHeight * 0.2)));
      setWidthInput(String(iw));
      setHeightInput(String(ih));
      setPanelPos({ x: Math.round((img.naturalWidth - iw) / 2), y: Math.round((img.naturalHeight - ih) / 2) });
      setScreen("opt2-workspace");
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  };

  const visibleCategories = activeStickerFilter === "all" ? STICKER_CATEGORIES : STICKER_CATEGORIES.filter((c) => c.id === activeStickerFilter);
  const stickerHeaderSrc = theme === "grey1200" ? PAGE_ASSETS.stickerHeaderGrey1200 : theme === "white" ? PAGE_ASSETS.stickerHeaderWhite : PAGE_ASSETS.stickerHeaderImagery;

  const handleBack = () => {
    if (screen === "opt1-pre-cover" || screen === "opt2-upload") setScreen("home");
    else if (screen === "opt1-sticker-cover" || screen === "opt1-bg-select") setScreen("opt1-pre-cover");
    else if (screen === "opt3-sheet") setScreen("opt1-sticker-cover");
    else if (screen === "opt1-imagery-select") setScreen("opt1-bg-select");
    else if (screen === "opt1-workspace") setScreen(theme === "imagery" ? "opt1-imagery-select" : "opt1-bg-select");
    else if (screen === "opt2-workspace") setScreen("opt2-upload");
    else setScreen("home");
  };

  return (
    <div className="min-h-screen w-full bg-[#F1F3F4] flex flex-col items-center justify-start py-4 md:py-6 px-3 md:px-6 font-sans text-[#121317]">
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileUpload} />

      <div className="w-full max-w-[1160px] flex items-center justify-between mb-2.5 h-8 px-1 sticky top-2 z-30">
        <div className="flex items-center gap-2">
          {screen !== "home" && (
            <button type="button" onClick={handleBack} className="text-xs font-medium text-neutral-700 hover:text-black bg-white/95 px-3.5 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer">
              ← Back
            </button>
          )}
          {screen === "opt2-workspace" && (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-medium text-neutral-700 hover:text-black bg-white/95 px-3.5 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer">
              Replace image
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {toastMsg && <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shadow-sm">✓ {toastMsg}</span>}
          {screen !== "home" && (
            <button type="button" onClick={() => setScreen("home")} className="text-xs font-medium text-neutral-600 hover:text-black bg-white/90 px-3.5 py-1.5 rounded-full border border-neutral-200 shadow-sm cursor-pointer">
              Home
            </button>
          )}
        </div>
      </div>

      {screen !== "opt3-sheet" ? (
        <div className="relative w-full max-w-[1160px] aspect-[16/9] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/90 select-none">
          {screen === "home" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.home} alt="Cover" className="w-full h-full object-cover pointer-events-none" />
              <button type="button" aria-label="Export panels for print and design" onClick={() => setScreen("opt2-upload")} className="absolute left-[16.5%] top-[63%] w-[22.5%] h-[23%] rounded-full hover:bg-black/[0.03] cursor-pointer" />
              <button type="button" aria-label="Export panels for Slides use" onClick={() => setScreen("opt1-pre-cover")} className="absolute left-[39.5%] top-[63%] w-[22.5%] h-[23%] rounded-full hover:bg-black/[0.03] cursor-pointer" />
            </div>
          )}

          {screen === "opt1-pre-cover" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.slidesPreCover} alt="Export panels for slides" className="w-full h-full object-cover pointer-events-none" />
              <button type="button" aria-label="Sticker sheets" onClick={() => setScreen("opt1-sticker-cover")} className="absolute left-[29%] top-[64%] w-[20.5%] h-[22%] rounded-full hover:bg-black/[0.03] cursor-pointer" />
              <button type="button" aria-label="Create panels for slides" onClick={() => setScreen("opt1-bg-select")} className="absolute left-[50.5%] top-[64%] w-[20.5%] h-[22%] rounded-full hover:bg-black/[0.03] cursor-pointer" />
            </div>
          )}

          {screen === "opt1-sticker-cover" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.stickerCover} alt="Sticker sheets" className="w-full h-full object-cover pointer-events-none" />
              {(["imagery", "grey1200", "white"] as BackgroundTheme[]).map((t, i) => (
                <button key={t} type="button" onClick={() => { setTheme(t); setActiveStickerFilter("all"); setOpenStickerMenuKey(null); setScreen("opt3-sheet"); }} style={{ left: `${22 + i * 19}%` }} className="absolute top-[60%] w-[18%] h-[21%] rounded-full hover:bg-black/[0.03] cursor-pointer" />
              ))}
            </div>
          )}

          {screen === "opt1-bg-select" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.slidesBgSelect} alt="Create panels for slides" className="w-full h-full object-cover pointer-events-none" />
              <button type="button" onClick={() => { setTheme("imagery"); setOpacitySlider(50); setScreen("opt1-imagery-select"); }} className="absolute left-[22%] top-[63%] w-[18%] h-[21%] rounded-full hover:bg-black/[0.03] cursor-pointer" />
              <button type="button" onClick={() => { setTheme("grey1200"); setOpacitySlider(50); setFormat("1:1"); setScreen("opt1-workspace"); }} className="absolute left-[41%] top-[63%] w-[18%] h-[21%] rounded-full hover:bg-black/[0.03] cursor-pointer" />
              <button type="button" onClick={() => { setTheme("white"); setOpacitySlider(50); setFormat("1:1"); setScreen("opt1-workspace"); }} className="absolute left-[60%] top-[63%] w-[18%] h-[21%] rounded-full hover:bg-black/[0.03] cursor-pointer" />
            </div>
          )}

          {screen === "opt1-imagery-select" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.fullBleedPicker} alt="Select example background" className="w-full h-full object-cover pointer-events-none" />
              {[0, 1, 2, 3].map((idx) => (
                <button key={idx} type="button" onClick={() => { setImageryIndex(idx); setTheme("imagery"); setOpacitySlider(50); setFormat("1:1"); setScreen("opt1-workspace"); }} style={{ left: `${4.5 + idx * 23}%` }} className="absolute top-[42%] w-[22%] h-[44%] rounded-lg hover:ring-4 hover:ring-blue-500/50 cursor-pointer" />
              ))}
            </div>
          )}

          {screen === "opt2-upload" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.bgUploadCover} alt="Export a panel on your background" className="w-full h-full object-cover pointer-events-none" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute left-[37%] top-[64%] w-[26%] h-[22%] rounded-full hover:bg-black/[0.03] cursor-pointer" />
            </div>
          )}

          {(screen === "opt1-workspace" || screen === "opt2-workspace") && (
            <div className="relative w-full h-full">
              <img src={screen === "opt1-workspace" ? PAGE_ASSETS.slidesWorkspace : PAGE_ASSETS.bgWorkspace} alt="Workspace" className="w-full h-full object-cover pointer-events-none" />

              <div className="absolute z-10 left-[4.5%] w-[42.5%] top-[18%] bottom-[8%] flex items-center justify-center overflow-hidden">
                <canvas
                  ref={previewCanvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onWheel={(e) => {
                    if (screen !== "opt2-workspace") return;
                    e.preventDefault();
                    setBgZoom((p) => Math.max(20, Math.min(300, p + (e.deltaY < 0 ? 5 : -5))));
                  }}
                  className="max-w-full max-h-full object-contain shadow-sm cursor-grab active:cursor-grabbing touch-none"
                />
              </div>

              <div className="absolute z-10 left-[50%] right-[4.5%] top-[58.5%] bottom-[2.5%] flex flex-col justify-start gap-1 lg:gap-1.5 overflow-y-auto pr-1">
                {screen === "opt2-workspace" && (
                  <div className="flex flex-wrap items-end gap-2.5">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Image resize</label>
                      <select value={resizeMode} onChange={(e) => applyResizeMode(e.target.value as ResizeMode)} className="h-6 lg:h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md">
                        <option value="none">No resize</option>
                        <option value="1:1">1:1 (1080x1080)</option>
                        <option value="4:5">4:5 (1080x1350)</option>
                        <option value="9:16">9:16 (1080x1920)</option>
                        <option value="16:9">16:9 (1920x1080)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    {resizeMode === "custom" && (
                      <div className="flex items-center gap-1.5 text-[10.5px] font-medium">
                        <input type="number" min={64} max={6000} value={customCanvasWInput} onChange={(e) => setCustomCanvasWInput(e.target.value)} className="w-[62px] h-6 lg:h-7 px-1.5 text-[11px] bg-white border border-neutral-800 rounded-md" />
                        <span>px wide x</span>
                        <input type="number" min={64} max={6000} value={customCanvasHInput} onChange={(e) => setCustomCanvasHInput(e.target.value)} className="w-[62px] h-6 lg:h-7 px-1.5 text-[11px] bg-white border border-neutral-800 rounded-md" />
                        <span>px high</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-0.5 min-w-[125px]">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-neutral-800 leading-tight">Image scale ({bgZoom}%)</span>
                        {(bgZoom !== 100 || bgPan.x !== 0 || bgPan.y !== 0) && (
                          <button type="button" onClick={() => { setBgZoom(100); setBgPan({ x: 0, y: 0 }); }} className="text-[10px] underline text-neutral-600 hover:text-black cursor-pointer">
                            Reset
                          </button>
                        )}
                      </div>
                      <input type="range" min={20} max={300} value={bgZoom} onChange={(e) => setBgZoom(Number(e.target.value))} className="w-full accent-neutral-900 cursor-pointer h-1.5 bg-neutral-300 rounded-lg" />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-2.5">
                  {screen === "opt1-workspace" && (
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Format</label>
                      <select value={format} onChange={(e) => setFormat(e.target.value as FormatRatio)} className="h-6 lg:h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md">
                        <option value="1:1">1:1</option>
                        <option value="4:5">4:5</option>
                        <option value="9:16">9:16</option>
                        <option value="16:9">16:9</option>
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Shape</label>
                    <select
                      value={shape}
                      onChange={(e) => {
                        const next = e.target.value as PanelShape;
                        setShape(next);
                        if (next === "circle") setHeightInput(widthInput);
                        else if (next === "cta-pill" && parseInt(heightInput, 10) > 140) setHeightInput("84");
                      }}
                      className="h-6 lg:h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md"
                    >
                      <option value="text-panel">Text panel</option>
                      <option value="circle">Circle</option>
                      <option value="cta-pill">CTA pill</option>
                    </select>
                  </div>

                  {screen === "opt2-workspace" && (
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Rim calibration</label>
                      <select value={theme} onChange={(e) => setTheme(e.target.value as BackgroundTheme)} className="h-6 lg:h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md">
                        <option value="imagery">Full bleed image</option>
                        <option value="grey1200">Grey 1200</option>
                        <option value="white">White</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Size</label>
                  <div className="flex items-center gap-2 text-[11px] font-medium">
                    <input type="number" min={24} max={4000} value={widthInput} onChange={(e) => { setWidthInput(e.target.value); if (shape === "circle") setHeightInput(e.target.value); }} className="w-[68px] h-6 lg:h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md" />
                    <span>{shape === "circle" ? "px diameter" : "px wide x"}</span>
                    {shape !== "circle" && (
                      <>
                        <input type="number" min={24} max={4000} value={heightInput} onChange={(e) => setHeightInput(e.target.value)} className="w-[68px] h-6 lg:h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md" />
                        <span>px high</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 max-w-[260px]">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Opacity</label>
                    <span className="text-[10px] text-neutral-500 leading-tight">{opacitySlider}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={opacitySlider} onChange={(e) => setOpacitySlider(Number(e.target.value))} className="w-full accent-neutral-900 cursor-pointer h-1.5 bg-neutral-300 rounded-lg" />
                </div>

                <div className="pt-0.5 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={handleExportPng} disabled={!hasValidSize} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-40 text-[11px] font-semibold transition cursor-pointer">
                    Export .png
                  </button>
                  <button type="button" onClick={handleExportSvg} disabled={!hasValidSize} className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-40 text-[11px] font-semibold transition cursor-pointer">
                    Export .svg
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full max-w-[1160px] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/90 flex flex-col">
          {stickerHeaderSrc && (
            <div className="w-full bg-white">
              <img src={stickerHeaderSrc} alt="Sticker Sheet Header" className="w-full h-auto object-contain pointer-events-none" />
            </div>
          )}
          <div className="w-full bg-white px-6 sm:px-10 pb-4 pt-2 flex flex-wrap items-center justify-end gap-2">
            {[
              { id: "all", label: "All (80)" },
              { id: "squares", label: "Squares (20)" },
              { id: "horizontal", label: "Horizontal (20)" },
              { id: "vertical", label: "Vertical (20)" },
              { id: "pills", label: "CTA Pills (10)" },
              { id: "circles", label: "Circles (10)" },
            ].map((tab) => (
              <button key={tab.id} type="button" onClick={() => { setActiveStickerFilter(tab.id); setOpenStickerMenuKey(null); }} className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border ${activeStickerFilter === tab.id ? "bg-[#121317] text-white border-[#121317]" : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-900"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className={`w-full px-6 sm:px-10 py-10 space-y-12 ${theme === "grey1200" ? "bg-[#121317] text-white" : theme === "white" ? "bg-[#F8F9FA] text-[#121317] border-t border-neutral-200" : "bg-[#1E272C] text-white"}`}>
            {visibleCategories.map((cat) => (
              <section key={cat.id} className="space-y-4">
                <div className="flex items-baseline justify-between border-b pb-2 border-current/15">
                  <h3 className="text-lg font-medium tracking-tight">{cat.title}</h3>
                  <span className="text-xs opacity-60">{cat.count} sizes</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {cat.sizes.map(([w, h]) => {
                    const itemKey = `${cat.id}-${w}x${h}`;
                    return (
                      <StickerCard
                        key={itemKey}
                        width={w}
                        height={h}
                        shape={cat.shape}
                        theme={theme}
                        isOpen={openStickerMenuKey === itemKey}
                        onToggleMenu={(nextOpen) => setOpenStickerMenuKey(nextOpen ? itemKey : null)}
                        onExportPng={(c, s, sh) => downloadCanvas(c, `sticker-${sh}-${theme}-${s}.png`)}
                        onExportSvg={(svg, s, sh) => downloadSvg(svg, `sticker-${sh}-${theme}-${s}.svg`)}
                      />
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
