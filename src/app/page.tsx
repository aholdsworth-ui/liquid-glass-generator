"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PAGE_ASSETS, BG_ASSETS, BUTTON_ZONES } from "@/lib/assetPaths";
import {
  PanelShape,
  BackgroundTheme,
  FormatRatio,
  FORMAT_DIMENSIONS,
  STICKER_CATEGORIES,
  renderStandaloneGlassPanel,
  renderRefractedGlassPatch,
  generateStandaloneGlassSvg,
} from "@/lib/liquidGlassEngine";
import {
  CompositedPanelSpec,
  renderMultiPanelArtworkCanvas,
  generateMultiPanelArtworkSvg,
} from "@/lib/multiPanelExport";
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

interface Opt2PanelItem {
  id: number;
  shape: PanelShape;
  theme: BackgroundTheme;
  widthInput: string;
  heightInput: string;
  pos: { x: number; y: number };
}

export default function Page() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [theme, setTheme] = useState<BackgroundTheme>("imagery");
  const [imageryIndex, setImageryIndex] = useState(0);
  const [format, setFormat] = useState<FormatRatio>("1:1");
  const [shape, setShape] = useState<PanelShape>("text-panel");
  const [widthInput, setWidthInput] = useState("420");
  const [heightInput, setHeightInput] = useState("180");
  const [opacitySlider, setOpacitySlider] = useState(50);
  const [panelPos, setPanelPos] = useState({ x: 330, y: 450 });

  const [opt2Panels, setOpt2Panels] = useState<Opt2PanelItem[]>([
    { id: 1, shape: "text-panel", theme: "imagery", widthInput: "420", heightInput: "180", pos: { x: 330, y: 450 } },
  ]);
  const nextPanelIdRef = useRef(2);

  const [activeStickerFilter, setActiveStickerFilter] = useState("all");
  const [openStickerMenuKey, setOpenStickerMenuKey] = useState<string | null>(null);

  const [resizeMode, setResizeMode] = useState<ResizeMode>("none");
  const [customCanvasWInput, setCustomCanvasWInput] = useState("1080");
  const [customCanvasHInput, setCustomCanvasHInput] = useState("1080");
  const [bgZoom, setBgZoom] = useState(100);
  const [bgPan, setBgPan] = useState({ x: 0, y: 0 });

  const [uploadedBgImg, setUploadedBgImg] = useState<HTMLImageElement | null>(null);
  const [uploadedBgDims, setUploadedBgDims] = useState({ width: 1920, height: 1080 });
  const [toastMsg, setToastMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageBgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const dragModeRef = useRef<"none" | "panel" | "pan-bg" | "scale-bg">("none");
  const dragPanelIdxRef = useRef(0);
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

  const opt2Specs: CompositedPanelSpec[] = opt2Panels.map((p) => {
    const pw = Math.max(0, parseInt(p.widthInput || "0", 10) || 0);
    const ph = p.shape === "circle" ? pw : Math.max(0, parseInt(p.heightInput || "0", 10) || 0);
    return { shape: p.shape, theme: p.theme, width: pw, height: ph, x: p.pos.x, y: p.pos.y };
  });

  const hasValidSize =
    screen === "opt2-workspace"
      ? opt2Specs.some((s) => s.width >= 24 && s.height >= 24)
      : parsedW >= 24 && parsedH >= 24;

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
    setOpt2Panels((prev) =>
      prev.map((p, i) => {
        const rawW = parseInt(p.widthInput || "0", 10) || 360;
        const rawH = p.shape === "circle" ? rawW : parseInt(p.heightInput || "0", 10) || 140;
        const pw = Math.min(rawW, Math.round(nd.width * 0.85));
        const ph = Math.min(rawH, Math.round(nd.height * 0.85));
        return {
          ...p,
          widthInput: rawW > nd.width * 0.9 ? String(pw) : p.widthInput,
          heightInput: rawH > nd.height * 0.9 ? String(ph) : p.heightInput,
          pos: {
            x: Math.max(12, Math.min(nd.width - pw, Math.round((nd.width - pw) / 2 + i * 32))),
            y: Math.max(12, Math.min(nd.height - ph, Math.round((nd.height - ph) / 2 + i * 32))),
          },
        };
      })
    );
  };

  const updateOpt2Panel = (idx: number, patch: Partial<Opt2PanelItem>) => {
    setOpt2Panels((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const toggleExtraPanelAfter = (idx: number) => {
    setOpt2Panels((prev) => {
      if (idx + 1 < prev.length) {
        return prev.filter((_, i) => i !== idx + 1);
      }
      if (prev.length >= 6) return prev;
      const refP = prev[prev.length - 1];
      const rw = Math.max(80, parseInt(refP.widthInput || "0", 10) || 360);
      const rh = refP.shape === "circle" ? rw : Math.max(60, parseInt(refP.heightInput || "0", 10) || 160);
      const nx = Math.max(16, Math.min(opt2TargetDims.width - rw - 16, refP.pos.x + 44));
      const ny = Math.max(16, Math.min(opt2TargetDims.height - rh - 16, refP.pos.y + 44));
      const nid = nextPanelIdRef.current++;
      return [...prev, { id: nid, shape: "text-panel", theme: prev[0].theme, widthInput: String(rw), heightInput: String(rh), pos: { x: nx, y: ny } }];
    });
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
    ctx.fillStyle = opt2Panels[0]?.theme === "grey1200" ? "#121317" : "#FFFFFF";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(uploadedBgImg, tw / 2 + bgPan.x - dw / 2, th / 2 + bgPan.y - dh / 2, dw, dh);
    return c;
  }, [uploadedBgImg, uploadedBgDims, opt2TargetDims, bgZoom, bgPan, opt2Panels]);

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
      if (parsedW >= 24 && parsedH >= 24) {
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

      ctx.fillStyle = "rgba(241, 243, 244, 0.76)";
      ctx.fillRect(0, 0, cw, padY);
      ctx.fillRect(0, padY + th, cw, padY);
      ctx.fillRect(0, padY, padX, th);
      ctx.fillRect(padX + tw, padY, padX, th);

      const croppedBg = buildCroppedOpt2Background();
      if (croppedBg) {
        const comp = renderMultiPanelArtworkCanvas(croppedBg, tw, th, opt2Specs, opacitySlider / 100);
        ctx.drawImage(comp, padX, padY, tw, th);
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
  }, [screen, format, uploadedBgImg, uploadedBgDims, opt2TargetDims, resizeMode, bgZoom, bgPan, buildCroppedOpt2Background, opt2Specs, parsedW, parsedH, panelPos, shape, theme, opacitySlider]);

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

    if (screen === "opt2-workspace") {
      for (let i = opt2Specs.length - 1; i >= 0; i--) {
        const sp = opt2Specs[i];
        if (sp.width >= 24 && sp.height >= 24 && cx >= sp.x && cx <= sp.x + sp.width && cy >= sp.y && cy <= sp.y + sp.height) {
          dragModeRef.current = "panel";
          dragPanelIdxRef.current = i;
          dragStartRef.current = { ...dragStartRef.current, cx, cy, panelX: sp.x, panelY: sp.y };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }

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

    if (parsedW >= 24 && parsedH >= 24) {
      if (cx >= panelPos.x && cx <= panelPos.x + parsedW && cy >= panelPos.y && cy <= panelPos.y + parsedH) {
        dragModeRef.current = "panel";
        dragStartRef.current = { ...dragStartRef.current, cx, cy, panelX: panelPos.x, panelY: panelPos.y };
      } else {
        const nx = Math.max(0, Math.min(targetW - parsedW, cx - parsedW / 2));
        const ny = Math.max(0, Math.min(targetH - parsedH, cy - parsedH / 2));
        setPanelPos({ x: nx, y: ny });
        dragModeRef.current = "panel";
        dragStartRef.current = { ...dragStartRef.current, cx, cy, panelX: nx, panelY: ny };
      }
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
      if (screen === "opt2-workspace") {
        const idx = dragPanelIdxRef.current;
        const sp = opt2Specs[idx];
        if (!sp) return;
        const nx = Math.max(0, Math.min(targetW - sp.width, Math.round(dragStartRef.current.panelX + cx - dragStartRef.current.cx)));
        const ny = Math.max(0, Math.min(targetH - sp.height, Math.round(dragStartRef.current.panelY + cy - dragStartRef.current.cy)));
        updateOpt2Panel(idx, { pos: { x: nx, y: ny } });
      } else {
        setPanelPos({
          x: Math.max(0, Math.min(targetW - parsedW, Math.round(dragStartRef.current.panelX + cx - dragStartRef.current.cx))),
          y: Math.max(0, Math.min(targetH - parsedH, Math.round(dragStartRef.current.panelY + cy - dragStartRef.current.cy))),
        });
      }
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
      downloadCanvas(renderMultiPanelArtworkCanvas(croppedBg, tw, th, opt2Specs, opacitySlider / 100), `glass-artwork-${tw}x${th}.png`);
    }
  };

  const handleExportSvg = () => {
    if (!hasValidSize) return;
    if (screen === "opt1-workspace") {
      downloadSvg(generateStandaloneGlassSvg({ width: parsedW, height: parsedH, shape, theme, frostOpacity: opacitySlider / 100 }), `glass-${shape}-${theme}-${parsedW}x${parsedH}.svg`);
    } else if (screen === "opt2-workspace") {
      const croppedBg = buildCroppedOpt2Background();
      if (!croppedBg) return;
      const tw = opt2TargetDims.width;
      const th = opt2TargetDims.height;
      downloadSvg(generateMultiPanelArtworkSvg(croppedBg, tw, th, opt2Specs, opacitySlider / 100), `glass-artwork-${tw}x${th}.svg`);
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
      const detectedTheme: BackgroundTheme = whites > 288 ? "white" : lum / 576 < 45 ? "grey1200" : "imagery";
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
      setOpt2Panels([
        {
          id: 1,
          shape: "text-panel",
          theme: detectedTheme,
          widthInput: String(iw),
          heightInput: String(ih),
          pos: { x: Math.round((img.naturalWidth - iw) / 2), y: Math.round((img.naturalHeight - ih) / 2) },
        },
      ]);
      nextPanelIdRef.current = 2;
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

  const zoneStyle = (key: string, idx: number): React.CSSProperties => {
    const z = BUTTON_ZONES[key]?.[idx] || [25, 70, 22, 14];
    return { left: `${z[0]}%`, top: `${z[1]}%`, width: `${z[2]}%`, height: `${z[3]}%` };
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
              <button type="button" aria-label="Export panels for print and design" onClick={() => setScreen("opt2-upload")} style={zoneStyle("home", 0)} className="absolute rounded-full bg-transparent cursor-pointer" />
              <button type="button" aria-label="Export panels for slides only" onClick={() => setScreen("opt1-pre-cover")} style={zoneStyle("home", 1)} className="absolute rounded-full bg-transparent cursor-pointer" />
            </div>
          )}

          {screen === "opt1-pre-cover" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.slidesPreCover} alt="Export panels for slides" className="w-full h-full object-cover pointer-events-none" />
              <button type="button" aria-label="Sticker sheets" onClick={() => setScreen("opt1-sticker-cover")} style={zoneStyle("slidesPreCover", 0)} className="absolute rounded-full bg-transparent cursor-pointer" />
              <button type="button" aria-label="Create panels for slides" onClick={() => setScreen("opt1-bg-select")} style={zoneStyle("slidesPreCover", 1)} className="absolute rounded-full bg-transparent cursor-pointer" />
            </div>
          )}

          {screen === "opt1-sticker-cover" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.stickerCover} alt="Sticker sheets" className="w-full h-full object-cover pointer-events-none" />
              {(["imagery", "grey1200", "white"] as BackgroundTheme[]).map((t, i) => (
                <button key={t} type="button" onClick={() => { setTheme(t); setActiveStickerFilter("all"); setOpenStickerMenuKey(null); setScreen("opt3-sheet"); }} style={zoneStyle("stickerCover", i)} className="absolute rounded-full bg-transparent cursor-pointer" />
              ))}
            </div>
          )}

          {screen === "opt1-bg-select" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.slidesBgSelect} alt="Create panels for slides" className="w-full h-full object-cover pointer-events-none" />
              <button type="button" onClick={() => { setTheme("imagery"); setOpacitySlider(50); setScreen("opt1-imagery-select"); }} style={zoneStyle("slidesBgSelect", 0)} className="absolute rounded-full bg-transparent cursor-pointer" />
              <button type="button" onClick={() => { setTheme("grey1200"); setOpacitySlider(50); setFormat("1:1"); setScreen("opt1-workspace"); }} style={zoneStyle("slidesBgSelect", 1)} className="absolute rounded-full bg-transparent cursor-pointer" />
              <button type="button" onClick={() => { setTheme("white"); setOpacitySlider(50); setFormat("1:1"); setScreen("opt1-workspace"); }} style={zoneStyle("slidesBgSelect", 2)} className="absolute rounded-full bg-transparent cursor-pointer" />
            </div>
          )}

          {screen === "opt1-imagery-select" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.fullBleedPicker} alt="Select example background" className="w-full h-full object-cover pointer-events-none" />
              {[0, 1, 2, 3].map((idx) => (
                <button key={idx} type="button" onClick={() => { setImageryIndex(idx); setTheme("imagery"); setOpacitySlider(50); setFormat("1:1"); setScreen("opt1-workspace"); }} style={zoneStyle("fullBleedPicker", idx)} className="absolute bg-transparent cursor-pointer" />
              ))}
            </div>
          )}

          {screen === "opt2-upload" && (
            <div className="relative w-full h-full">
              <img src={PAGE_ASSETS.bgUploadCover} alt="Export a panel on your background" className="w-full h-full object-cover pointer-events-none" />
              <button type="button" aria-label="Upload now" onClick={() => fileInputRef.current?.click()} style={zoneStyle("bgUploadCover", 0)} className="absolute rounded-full bg-transparent cursor-pointer" />
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
                  className="max-w-full max-h-full object-contain shadow-sm cursor-grab active:cursor-grabbing touch-none"
                />
              </div>

              <div className={`absolute z-10 left-[50%] right-[4.5%] ${screen === "opt1-workspace" ? "top-[53.5%]" : "top-[54.5%]"} bottom-[3%] flex flex-col justify-start gap-1.5 overflow-y-auto pr-2`}>
                {screen === "opt1-workspace" ? (
                  <>
                    <div className="flex flex-wrap items-end gap-2.5">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Format</label>
                        <select value={format} onChange={(e) => setFormat(e.target.value as FormatRatio)} className="h-6 lg:h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md">
                          <option value="1:1">1:1</option>
                          <option value="4:5">4:5</option>
                          <option value="9:16">9:16</option>
                          <option value="16:9">16:9</option>
                        </select>
                      </div>

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
                  </>
                ) : (
                  <>
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

                    {opt2Panels.map((p, idx) => {
                      const hasNext = idx + 1 < opt2Panels.length;
                      return (
                        <div key={p.id} className="flex flex-col gap-1.5 pt-0.5">
                          <div className="flex flex-wrap items-end gap-2.5">
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Shape</label>
                              <select
                                value={p.shape}
                                onChange={(e) => {
                                  const next = e.target.value as PanelShape;
                                  const nextH = next === "circle" ? p.widthInput : next === "cta-pill" && parseInt(p.heightInput, 10) > 140 ? "84" : p.heightInput;
                                  updateOpt2Panel(idx, { shape: next, heightInput: nextH });
                                }}
                                className="h-6 lg:h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md"
                              >
                                <option value="text-panel">Text panel</option>
                                <option value="circle">Circle</option>
                                <option value="cta-pill">CTA pill</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-0.5">
                              <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Rim calibration</label>
                              <select value={p.theme} onChange={(e) => updateOpt2Panel(idx, { theme: e.target.value as BackgroundTheme })} className="h-6 lg:h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md">
                                <option value="imagery">Full bleed image</option>
                                <option value="grey1200">Grey 1200</option>
                                <option value="white">White</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Size</label>
                            <div className="flex items-center gap-2 text-[11px] font-medium">
                              <input
                                type="number"
                                min={24}
                                max={4000}
                                value={p.widthInput}
                                onChange={(e) => updateOpt2Panel(idx, { widthInput: e.target.value, heightInput: p.shape === "circle" ? e.target.value : p.heightInput })}
                                className="w-[68px] h-6 lg:h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md"
                              />
                              <span>{p.shape === "circle" ? "px diameter" : "px wide x"}</span>
                              {p.shape !== "circle" && (
                                <>
                                  <input type="number" min={24} max={4000} value={p.heightInput} onChange={(e) => updateOpt2Panel(idx, { heightInput: e.target.value })} className="w-[68px] h-6 lg:h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md" />
                                  <span>px high</span>
                                </>
                              )}
                            </div>
                          </div>

                          {idx === 0 && (
                            <div className="flex flex-col gap-0.5 max-w-[260px]">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-semibold text-neutral-800 leading-tight">Opacity</label>
                                <span className="text-[10px] text-neutral-500 leading-tight">{opacitySlider}%</span>
                              </div>
                              <input type="range" min={0} max={100} value={opacitySlider} onChange={(e) => setOpacitySlider(Number(e.target.value))} className="w-full accent-neutral-900 cursor-pointer h-1.5 bg-neutral-300 rounded-lg" />
                            </div>
                          )}

                          {idx < 5 && (
                            <div className="flex flex-col items-start gap-1 pt-0.5">
                              <span className="text-[10px] font-semibold text-neutral-800 leading-tight">Add another panel?</span>
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={hasNext}
                                onClick={() => toggleExtraPanelAfter(idx)}
                                className="w-4 h-4 rounded-full border-[1.5px] border-neutral-900 bg-white flex items-center justify-center cursor-pointer"
                              >
                                {hasNext && <span className="w-2 h-2 rounded-full bg-neutral-900" />}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                <div className="pt-1 pb-2 flex flex-wrap items-center gap-2">
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
              <img src={stickerHeaderSrc} alt="Sticker Sheet Header" className="w-full h-auto block pointer-events-none" />
            </div>
          )}
          <div className="w-full bg-white px-6 sm:px-10 pt-1 pb-3 flex flex-wrap items-center justify-end gap-2">
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

          <div className={`w-full px-6 sm:px-10 py-8 space-y-12 ${theme === "grey1200" ? "bg-[#121317] text-white" : theme === "white" ? "bg-[#F8F9FA] text-[#121317] border-t border-neutral-200" : "bg-[#1E272C] text-white"}`}>
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
