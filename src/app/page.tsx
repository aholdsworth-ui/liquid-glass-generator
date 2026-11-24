"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PAGE_ASSETS, BG_ASSETS } from "@/lib/assetPaths";
import {
  GlassShape,
  GlassTheme,
  renderStandaloneGlassPanel,
  renderRefractedGlassPatch,
  generateStandaloneGlassSvg,
  generateCompositedGlassSvg,
} from "@/lib/liquidGlassEngine";

type ScreenId =
  | "home"
  | "opt1-bg-select"
  | "opt1-imagery-select"
  | "opt1-workspace"
  | "opt2-upload"
  | "opt2-workspace"
  | "opt3-bg-select"
  | "opt3-sheet";

type FormatRatio = "1:1" | "4:5" | "9:16" | "16:9";

const FORMAT_DIMENSIONS: Record<FormatRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

const LOCKED_THEME_OPACITY: Record<GlassTheme, number> = {
  imagery: 35,
  grey1200: 40,
  white: 80,
};

const STICKER_CATEGORIES: {
  id: string;
  title: string;
  count: number;
  shape: GlassShape;
  sizes: [number, number][];
}[] = [
  {
    id: "squares",
    title: "Square Text Panels",
    count: 20,
    shape: "text-panel",
    sizes: [
      [120, 120], [160, 160], [200, 200], [240, 240], [280, 280],
      [320, 320], [360, 360], [400, 400], [440, 440], [480, 480],
      [520, 520], [560, 560], [600, 600], [640, 640], [700, 700],
      [760, 760], [820, 820], [880, 880], [920, 920], [960, 960],
    ],
  },
  {
    id: "horizontal",
    title: "Horizontal Text Panels",
    count: 20,
    shape: "text-panel",
    sizes: [
      [330, 110], [420, 110], [480, 140], [560, 160], [640, 180],
      [720, 220], [840, 240], [920, 260], [960, 300], [960, 420],
      [960, 540], [800, 360], [880, 480], [1040, 420], [1200, 360],
      [1200, 520], [1400, 440], [1400, 680], [1680, 320], [1760, 840],
    ],
  },
  {
    id: "vertical",
    title: "Vertical Text Panels",
    count: 20,
    shape: "text-panel",
    sizes: [
      [260, 360], [300, 420], [340, 480], [380, 520], [420, 560],
      [460, 640], [480, 720], [520, 780], [560, 840], [600, 920],
      [720, 920], [640, 960], [760, 1080], [840, 1120], [920, 1150],
      [960, 1230], [840, 1440], [920, 1600], [960, 1680], [960, 1760],
    ],
  },
  {
    id: "pills",
    title: "CTA Pills",
    count: 10,
    shape: "cta-pill",
    sizes: [
      [160, 52], [205, 64], [205, 80], [260, 72], [300, 80],
      [360, 88], [420, 80], [480, 96], [560, 104], [680, 112],
    ],
  },
  {
    id: "circles",
    title: "Circles",
    count: 10,
    shape: "circle",
    sizes: [
      [56, 56], [72, 72], [88, 88], [104, 104], [120, 120],
      [160, 160], [200, 200], [260, 260], [340, 340], [440, 440],
    ],
  },
];

function StickerCard({
  width,
  height,
  shape,
  theme,
  isOpen,
  onToggleMenu,
  onExportPng,
  onExportSvg,
}: {
  width: number;
  height: number;
  shape: GlassShape;
  theme: GlassTheme;
  isOpen: boolean;
  onToggleMenu: (next: boolean) => void;
  onExportPng: (canvas: HTMLCanvasElement, sizeStr: string, shape: GlassShape) => void;
  onExportSvg: (svgStr: string, sizeStr: string, shape: GlassShape) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const lockedOpacity = LOCKED_THEME_OPACITY[theme] / 100;

  useEffect(() => {
    setPreviewUrl("");
    const el = cardRef.current;
    if (!el) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !cancelled) {
          observer.disconnect();
          const maxPreviewDim = 220;
          const scale = Math.min(1, maxPreviewDim / Math.max(width, height));
          const pw = Math.max(20, Math.round(width * scale));
          const ph = Math.max(20, Math.round(height * scale));
          const scaledRadius = Math.max(4, 20 * scale);
          const thumbCanvas = renderStandaloneGlassPanel({
            width: pw,
            height: ph,
            shape,
            theme,
            frostOpacity: lockedOpacity,
            customRadius: scaledRadius,
          });
          if (!cancelled) {
            setPreviewUrl(thumbCanvas.toDataURL("image/png"));
          }
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [width, height, shape, theme, lockedOpacity]);

  const handleChoosePng = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGenerating) return;
    setIsGenerating(true);
    requestAnimationFrame(() => {
      const fullCanvas = renderStandaloneGlassPanel({
        width,
        height,
        shape,
        theme,
        frostOpacity: lockedOpacity,
      });
      onExportPng(fullCanvas, `${width}x${height}`, shape);
      setIsGenerating(false);
      onToggleMenu(false);
    });
  };

  const handleChooseSvg = (e: React.MouseEvent) => {
    e.stopPropagation();
    const svgStr = generateStandaloneGlassSvg({
      width,
      height,
      shape,
      theme,
      frostOpacity: lockedOpacity,
    });
    onExportSvg(svgStr, `${width}x${height}`, shape);
    onToggleMenu(false);
  };

  return (
    <div
      ref={cardRef}
      onClick={(e) => {
        e.stopPropagation();
        onToggleMenu(!isOpen);
      }}
      className={`relative group flex flex-col items-end justify-between gap-2 p-3.5 rounded-xl border transition cursor-pointer w-full ${
        theme === "white"
          ? "border-neutral-200/80 hover:border-neutral-400 bg-white/60 hover:bg-white"
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
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-20 flex items-center justify-center p-2"
          >
            <div className="w-40 rounded-xl bg-white text-[#121317] shadow-xl border border-neutral-200 overflow-hidden flex flex-col divide-y divide-neutral-100">
              <button
                type="button"
                onClick={handleChoosePng}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 flex items-center justify-between transition cursor-pointer"
              >
                <span>{isGenerating ? "Exporting..." : "Export .png"}</span>
              </button>
              <button
                type="button"
                onClick={handleChooseSvg}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 flex items-center justify-between transition cursor-pointer"
              >
                <span>Export .svg</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <span
        className={`text-[11px] font-medium flex items-center gap-1.5 ${
          theme === "white" ? "text-neutral-700" : "text-neutral-300"
        }`}
      >
        {`${width}px X ${height}px`}
      </span>
    </div>
  );
}

export default function Page() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [theme, setTheme] = useState<GlassTheme>("imagery");
  const [imageryOption, setImageryOption] = useState<number>(1);
  const [format, setFormat] = useState<FormatRatio>("1:1");
  const [shape, setShape] = useState<GlassShape>("text-panel");
  const [widthInput, setWidthInput] = useState("420");
  const [heightInput, setHeightInput] = useState("180");
  const [opacitySlider, setOpacitySlider] = useState(35);
  const [activeStickerFilter, setActiveStickerFilter] = useState("all");
  const [openStickerMenuKey, setOpenStickerMenuKey] = useState<string | null>(null);

  const [panelPos, setPanelPos] = useState({ x: 330, y: 450 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  const [holdingBgImg, setHoldingBgImg] = useState<HTMLImageElement | null>(null);
  const [uploadedBgImg, setUploadedBgImg] = useState<HTMLImageElement | null>(null);
  const [uploadedBgDims, setUploadedBgDims] = useState({ width: 1920, height: 1080 });
  const [toastMsg, setToastMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const stageDims =
    screen === "opt2-workspace" ? uploadedBgDims : FORMAT_DIMENSIONS[format];

  const parsedW = Math.max(0, parseInt(widthInput || "0", 10) || 0);
  const parsedH =
    shape === "circle" ? parsedW : Math.max(0, parseInt(heightInput || "0", 10) || 0);
  const hasValidSize = parsedW >= 24 && parsedH >= 24;

  const selectThemeAndDefaultOpacity = (nextTheme: GlassTheme) => {
    setTheme(nextTheme);
    setOpacitySlider(LOCKED_THEME_OPACITY[nextTheme]);
  };

  useEffect(() => {
    const closeMenus = () => setOpenStickerMenuKey(null);
    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
  }, []);

  useEffect(() => {
    if (screen !== "opt1-workspace") return;
    const ratioAssets = BG_ASSETS[format];
    if (!ratioAssets) return;
    const src =
      theme === "white"
        ? ratioAssets.white
        : theme === "grey1200"
        ? ratioAssets.grey1200
        : ratioAssets.imagery?.[imageryOption] || ratioAssets.imagery?.[1];
    if (!src) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      setHoldingBgImg(img);
      setPanelPos({
        x: Math.max(20, Math.round((FORMAT_DIMENSIONS[format].width - Math.max(80, parsedW)) / 2)),
        y: Math.max(20, Math.round((FORMAT_DIMENSIONS[format].height - Math.max(80, parsedH)) / 2)),
      });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [screen, format, theme, imageryOption]);

  const drawWorkspace = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const bgSource = screen === "opt2-workspace" ? uploadedBgImg : holdingBgImg;
    if (!bgSource) return;

    canvas.width = stageDims.width;
    canvas.height = stageDims.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, stageDims.width, stageDims.height);
    ctx.drawImage(bgSource, 0, 0, stageDims.width, stageDims.height);

    if (hasValidSize) {
      const patch = renderRefractedGlassPatch(
        bgSource,
        stageDims.width,
        stageDims.height,
        panelPos.x,
        panelPos.y,
        {
          width: parsedW,
          height: parsedH,
          shape,
          theme,
          frostOpacity: opacitySlider / 100,
        }
      );
      ctx.drawImage(patch, Math.round(panelPos.x), Math.round(panelPos.y));
    }
  }, [
    screen,
    uploadedBgImg,
    holdingBgImg,
    stageDims,
    hasValidSize,
    parsedW,
    parsedH,
    panelPos,
    shape,
    theme,
    opacitySlider,
  ]);

  useEffect(() => {
    if (screen === "opt1-workspace" || screen === "opt2-workspace") {
      drawWorkspace();
    }
  }, [screen, drawWorkspace]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!hasValidSize || !previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleX = stageDims.width / rect.width;
    const scaleY = stageDims.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if (
      clickX >= panelPos.x &&
      clickX <= panelPos.x + parsedW &&
      clickY >= panelPos.y &&
      clickY <= panelPos.y + parsedH
    ) {
      setIsDragging(true);
      dragOffset.current = { dx: clickX - panelPos.x, dy: clickY - panelPos.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      const nx = Math.max(0, Math.min(stageDims.width - parsedW, clickX - parsedW / 2));
      const ny = Math.max(0, Math.min(stageDims.height - parsedH, clickY - parsedH / 2));
      setPanelPos({ x: nx, y: ny });
      setIsDragging(true);
      dragOffset.current = { dx: parsedW / 2, dy: parsedH / 2 };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleX = stageDims.width / rect.width;
    const scaleY = stageDims.height / rect.height;
    const curX = (e.clientX - rect.left) * scaleX;
    const curY = (e.clientY - rect.top) * scaleY;

    const nx = Math.max(
      -parsedW * 0.25,
      Math.min(stageDims.width - parsedW * 0.75, curX - dragOffset.current.dx)
    );
    const ny = Math.max(
      -parsedH * 0.25,
      Math.min(stageDims.height - parsedH * 0.75, curY - dragOffset.current.dy)
    );
    setPanelPos({ x: nx, y: ny });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const downloadCanvas = (canvas: HTMLCanvasElement, filename: string) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg(`Downloaded ${filename}`);
      setTimeout(() => setToastMsg(""), 2800);
    }, "image/png");
  };

  const downloadSvg = (svgContent: string, filename: string) => {
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastMsg(`Downloaded ${filename}`);
    setTimeout(() => setToastMsg(""), 2800);
  };

  const handleExportPng = () => {
    if (!hasValidSize) return;
    if (screen === "opt1-workspace") {
      const isolated = renderStandaloneGlassPanel({
        width: parsedW,
        height: parsedH,
        shape,
        theme,
        frostOpacity: opacitySlider / 100,
      });
      downloadCanvas(isolated, `glass-${shape}-${theme}-${parsedW}x${parsedH}.png`);
    } else if (screen === "opt2-workspace" && uploadedBgImg) {
      const out = document.createElement("canvas");
      out.width = uploadedBgDims.width;
      out.height = uploadedBgDims.height;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(uploadedBgImg, 0, 0, uploadedBgDims.width, uploadedBgDims.height);
      const patch = renderRefractedGlassPatch(
        uploadedBgImg,
        uploadedBgDims.width,
        uploadedBgDims.height,
        panelPos.x,
        panelPos.y,
        {
          width: parsedW,
          height: parsedH,
          shape,
          theme,
          frostOpacity: opacitySlider / 100,
        }
      );
      ctx.drawImage(patch, Math.round(panelPos.x), Math.round(panelPos.y));
      downloadCanvas(out, `glass-composited-${uploadedBgDims.width}x${uploadedBgDims.height}.png`);
    }
  };

  const handleExportSvg = () => {
    if (!hasValidSize) return;
    if (screen === "opt1-workspace") {
      const svgStr = generateStandaloneGlassSvg({
        width: parsedW,
        height: parsedH,
        shape,
        theme,
        frostOpacity: opacitySlider / 100,
      });
      downloadSvg(svgStr, `glass-${shape}-${theme}-${parsedW}x${parsedH}.svg`);
    } else if (screen === "opt2-workspace" && uploadedBgImg) {
      const svgStr = generateCompositedGlassSvg(
        uploadedBgImg,
        uploadedBgDims.width,
        uploadedBgDims.height,
        panelPos.x,
        panelPos.y,
        {
          width: parsedW,
          height: parsedH,
          shape,
          theme,
          frostOpacity: opacitySlider / 100,
        }
      );
      downloadSvg(svgStr, `glass-composited-${uploadedBgDims.width}x${uploadedBgDims.height}.svg`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const sample = document.createElement("canvas");
      sample.width = 24;
      sample.height = 24;
      const sCtx = sample.getContext("2d");
      if (sCtx) {
        sCtx.drawImage(img, 0, 0, 24, 24);
        const px = sCtx.getImageData(0, 0, 24, 24).data;
        let lum = 0,
          whites = 0;
        for (let i = 0; i < px.length; i += 4) {
          lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240) whites++;
        }
        const avgLum = lum / (24 * 24);
        if (whites > 24 * 24 * 0.5) selectThemeAndDefaultOpacity("white");
        else if (avgLum < 45) selectThemeAndDefaultOpacity("grey1200");
        else selectThemeAndDefaultOpacity("imagery");
      }

      setUploadedBgDims({ width: img.naturalWidth, height: img.naturalHeight });
      setUploadedBgImg(img);
      const initW = Math.min(480, Math.round(img.naturalWidth * 0.35));
      const initH = Math.min(190, Math.round(img.naturalHeight * 0.2));
      setWidthInput(String(initW));
      setHeightInput(String(initH));
      setPanelPos({
        x: Math.round((img.naturalWidth - initW) / 2),
        y: Math.round((img.naturalHeight - initH) / 2),
      });
      setScreen("opt2-workspace");
    };
    img.src = url;
  };

  const visibleCategories =
    activeStickerFilter === "all"
      ? STICKER_CATEGORIES
      : STICKER_CATEGORIES.filter((c) => c.id === activeStickerFilter);

  const stickerHeaderBg =
    theme === "grey1200"
      ? PAGE_ASSETS.stickerSheetGrey1200
      : theme === "white"
      ? PAGE_ASSETS.stickerSheetWhite
      : PAGE_ASSETS.stickerSheetImagery;

  return (
    <main className="min-h-screen w-full bg-[#F1F3F4] flex flex-col items-center justify-start py-4 md:py-6 px-3 md:px-6 font-sans text-[#121317]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Navigation Bar */}
      <div className="w-full max-w-[1200px] flex items-center justify-between mb-2.5 h-8 px-1 sticky top-2 z-30">
        {screen !== "home" ? (
          <button
            onClick={() => {
              if (screen === "opt1-imagery-select") setScreen("opt1-bg-select");
              else if (screen === "opt1-workspace")
                setScreen(theme === "imagery" ? "opt1-imagery-select" : "opt1-bg-select");
              else if (screen === "opt2-workspace") setScreen("opt2-upload");
              else if (screen === "opt3-sheet") setScreen("opt3-bg-select");
              else setScreen("home");
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-black bg-white/95 backdrop-blur px-3.5 py-1.5 rounded-full border border-neutral-200 shadow-sm transition cursor-pointer"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          {toastMsg && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shadow-sm">
              ✓ {toastMsg}
            </span>
          )}
          {screen !== "home" && (
            <button
              onClick={() => setScreen("home")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-black bg-white/90 backdrop-blur px-3.5 py-1.5 rounded-full border border-neutral-200 shadow-sm transition cursor-pointer"
            >
              Home
            </button>
          )}
        </div>
      </div>

      {screen !== "opt3-sheet" ? (
        <div className="relative w-full max-w-[1200px] aspect-[16/9] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/90 select-none">
          {/* 1. HOME SCREEN */}
          {screen === "home" && (
            <>
              <img
                src={PAGE_ASSETS.cover16_9}
                alt="Welcome to our glass panel and pill generator"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-[8%] left-[8%] right-[8%] h-[22%] grid grid-cols-3 gap-4">
                <button
                  onClick={() => setScreen("opt1-bg-select")}
                  aria-label="Export just a panel to size"
                  className="rounded-2xl hover:bg-black/[0.03] transition cursor-pointer"
                />
                <button
                  onClick={() => setScreen("opt2-upload")}
                  aria-label="Export a panel on your background"
                  className="rounded-2xl hover:bg-black/[0.03] transition cursor-pointer"
                />
                <button
                  onClick={() => setScreen("opt3-bg-select")}
                  aria-label="Select from our sticker sheet"
                  className="rounded-2xl hover:bg-black/[0.03] transition cursor-pointer"
                />
              </div>
            </>
          )}

          {/* 2. OPTION 1 — BACKGROUND CONTEXT */}
          {screen === "opt1-bg-select" && (
            <>
              <img
                src={PAGE_ASSETS.exportJustPanelCover}
                alt="Export just a panel to size"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-[8%] left-[12%] right-[12%] h-[22%] grid grid-cols-3 gap-6">
                <button
                  onClick={() => {
                    selectThemeAndDefaultOpacity("imagery");
                    setScreen("opt1-imagery-select");
                  }}
                  aria-label="Full bleed image"
                  className="rounded-2xl hover:bg-black/[0.03] transition cursor-pointer"
                />
                <button
                  onClick={() => {
                    selectThemeAndDefaultOpacity("grey1200");
                    setFormat("1:1");
                    setScreen("opt1-workspace");
                  }}
                  aria-label="Grey 1200"
                  className="rounded-2xl hover:bg-black/[0.03] transition cursor-pointer"
                />
                <button
                  onClick={() => {
                    selectThemeAndDefaultOpacity("white");
                    setFormat("1:1");
                    setScreen("opt1-workspace");
                  }}
                  aria-label="White"
                  className="rounded-2xl hover:bg-black/[0.03] transition cursor-pointer"
                />
              </div>
            </>
          )}

          {/* 3. OPTION 1 — FULL BLEED 4-IMAGE PICKER */}
          {screen === "opt1-imagery-select" && (
            <>
              <img
                src={PAGE_ASSETS.fullBleedImageCover}
                alt="Select an example background"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-[8%] left-[5%] right-[5%] h-[45%] grid grid-cols-4 gap-4">
                {[1, 4, 3, 2].map((optNum) => (
                  <button
                    key={optNum}
                    onClick={() => {
                      setImageryOption(optNum);
                      selectThemeAndDefaultOpacity("imagery");
                      setFormat("1:1");
                      setScreen("opt1-workspace");
                    }}
                    aria-label={`Image option ${optNum}`}
                    className="rounded-xl hover:ring-4 hover:ring-blue-500/60 transition cursor-pointer"
                  />
                ))}
              </div>
            </>
          )}

          {/* 4. OPTION 2 — UPLOAD COVER */}
          {screen === "opt2-upload" && (
            <>
              <img
                src={PAGE_ASSETS.exportOnBgCover}
                alt="Export a panel on your background"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload now"
                className="absolute bottom-[8%] left-[32%] right-[32%] h-[20%] rounded-full hover:bg-black/[0.03] transition cursor-pointer"
              />
            </>
          )}

          {/* 5. WORKSPACE — OPTION 1 & OPTION 2 (CONTROLS IN GREEN DOTTED CLEAR ZONE) */}
          {(screen === "opt1-workspace" || screen === "opt2-workspace") && (
            <>
              <img
                src={
                  screen === "opt1-workspace"
                    ? PAGE_ASSETS.exportJustPanelInternal
                    : PAGE_ASSETS.exportOnBgInternal
                }
                alt="Workspace"
                className="w-full h-full object-cover"
              />

              {/* Left Interactive Canvas Stage */}
              <div className="absolute left-[4.5%] w-[43%] top-[18%] bottom-[8%] flex items-center justify-center overflow-hidden">
                <canvas
                  ref={previewCanvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={`max-w-full max-h-full object-contain shadow-sm ${
                    hasValidSize ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                  }`}
                />
              </div>

              {/* Lower-Right Green Dotted Clear Zone: Menus, Inputs, Opacity & Export Buttons */}
              <div className="absolute left-[52.7%] right-[6%] top-[62.5%] bottom-[3.5%] flex flex-col justify-start gap-1.5 lg:gap-2 select-auto">
                <div className="flex flex-wrap items-end gap-3">
                  {screen === "opt1-workspace" && (
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-neutral-800 leading-tight">
                        Format
                      </label>
                      <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value as FormatRatio)}
                        className="h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md focus:outline-none"
                      >
                        <option value="1:1">1:1</option>
                        <option value="4:5">4:5</option>
                        <option value="9:16">9:16</option>
                        <option value="16:9">16:9</option>
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-semibold text-neutral-800 leading-tight">
                      Shape
                    </label>
                    <select
                      value={shape}
                      onChange={(e) => {
                        const next = e.target.value as GlassShape;
                        setShape(next);
                        if (next === "circle") setHeightInput(widthInput);
                        else if (next === "cta-pill" && parseInt(heightInput, 10) > 140) {
                          setHeightInput("84");
                        }
                      }}
                      className="h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md focus:outline-none"
                    >
                      <option value="text-panel">Text panel</option>
                      <option value="circle">Circle</option>
                      <option value="cta-pill">CTA pill</option>
                    </select>
                  </div>

                  {screen === "opt2-workspace" && (
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-neutral-800 leading-tight">
                        Rim calibration
                      </label>
                      <select
                        value={theme}
                        onChange={(e) =>
                          selectThemeAndDefaultOpacity(e.target.value as GlassTheme)
                        }
                        className="h-7 px-2 text-[11px] font-medium bg-white border border-neutral-800 rounded-md focus:outline-none"
                      >
                        <option value="imagery">Full bleed image</option>
                        <option value="grey1200">Grey 1200</option>
                        <option value="white">White</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] font-semibold text-neutral-800 leading-tight">
                    Size
                  </label>
                  <div className="flex items-center gap-2 text-[11px] font-medium">
                    <input
                      type="number"
                      min={24}
                      max={4000}
                      value={widthInput}
                      onChange={(e) => {
                        setWidthInput(e.target.value);
                        if (shape === "circle") setHeightInput(e.target.value);
                      }}
                      className="w-[72px] h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md focus:outline-none"
                    />
                    <span>{shape === "circle" ? "px diameter" : "px wide x"}</span>
                    {shape !== "circle" && (
                      <>
                        <input
                          type="number"
                          min={24}
                          max={4000}
                          value={heightInput}
                          onChange={(e) => setHeightInput(e.target.value)}
                          className="w-[72px] h-7 px-2 text-[11px] bg-white border border-neutral-800 rounded-md focus:outline-none"
                        />
                        <span>px high</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 max-w-[260px]">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-neutral-800 leading-tight">
                      Opacity
                    </label>
                    <span className="text-[10px] text-neutral-500 leading-tight">
                      {opacitySlider}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={opacitySlider}
                    onChange={(e) => setOpacitySlider(Number(e.target.value))}
                    className="w-full accent-neutral-900 cursor-pointer h-1.5 bg-neutral-300 rounded-lg"
                  />
                </div>

                <div className="pt-0.5 flex flex-col gap-1 max-w-[340px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleExportPng}
                      disabled={!hasValidSize}
                      className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-40 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Export .png
                    </button>
                    <button
                      onClick={handleExportSvg}
                      disabled={!hasValidSize}
                      className="px-4 py-1 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-40 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Export .svg
                    </button>
                  </div>
                  <span className="text-[10px] text-neutral-500 leading-tight">
                    {screen === "opt1-workspace"
                      ? `Exports ${parsedW || 0}×${parsedH || 0}px panel only`
                      : `Exports ${uploadedBgDims.width}×${uploadedBgDims.height}px image + panel`}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* 6. OPTION 3 — STICKER SHEET COVER */}
          {screen === "opt3-bg-select" && (
            <>
              <img
                src={PAGE_ASSETS.stickerSheetCover}
                alt="Sticker sheet"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-[8%] left-[12%] right-[12%] h-[22%] grid grid-cols-3 gap-6">
                <button
                  onClick={() => {
                    selectThemeAndDefaultOpacity("imagery");
                    setActiveStickerFilter("all");
                    setOpenStickerMenuKey(null);
                    setScreen("opt3-sheet");
                  }}
                  aria-label="Full bleed image"
                  className="rounded-2xl hover:bg-black/[0.03] transition cursor-pointer"
                />
                <button
                  onClick={() => {
                    selectThemeAndDefaultOpacity("grey1200");
                    setActiveStickerFilter("all");
                    setOpenStickerMenuKey(null);
                    setScreen("opt3-sheet");
                  }}
                  aria-label="Grey 1200"
                  className="rounded-2xl hover:bg-black/[0.03] transition cursor-pointer"
                />
                <button
                  onClick={() => {
                    selectThemeAndDefaultOpacity("white");
                    setActiveStickerFilter("all");
                    setOpenStickerMenuKey(null);
                    setScreen("opt3-sheet");
                  }}
                  aria-label="White"
                  className="rounded-2xl hover:bg-black/[0.03] transition cursor-pointer"
                />
              </div>
            </>
          )}
        </div>
      ) : (
        /* 7. OPTION 3 — SCROLLING 80-ASSET STICKER SHEET (RED-OUTLINED COPY REMOVED) */
        <div className="relative w-full max-w-[1200px] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/90 flex flex-col">
          {stickerHeaderBg && (
            <div className="w-full aspect-[16/4.3] overflow-hidden bg-white">
              <img
                src={stickerHeaderBg}
                alt="Sticker sheet header"
                className="w-full h-full object-cover object-top"
              />
            </div>
          )}

          {/* Clean Centered Category Filter Bar (Duplicate Left Copy Removed) */}
          <div className="w-full px-6 py-3 bg-white border-b border-neutral-200 flex flex-wrap items-center justify-center gap-2">
            {[
              { id: "all", label: "All (80)" },
              { id: "squares", label: "Squares (20)" },
              { id: "horizontal", label: "Horizontal (20)" },
              { id: "vertical", label: "Vertical (20)" },
              { id: "pills", label: "CTA Pills (10)" },
              { id: "circles", label: "Circles (10)" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveStickerFilter(tab.id);
                  setOpenStickerMenuKey(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border ${
                  activeStickerFilter === tab.id
                    ? "bg-[#121317] text-white border-[#121317]"
                    : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            className={`w-full px-6 sm:px-10 py-10 space-y-12 ${
              theme === "grey1200"
                ? "bg-[#121317] text-white"
                : theme === "white"
                ? "bg-[#F8F9FA] text-[#121317]"
                : "bg-[#1E272C] text-white"
            }`}
          >
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
                        onToggleMenu={(nextOpen) =>
                          setOpenStickerMenuKey(nextOpen ? itemKey : null)
                        }
                        onExportPng={(canvas, sizeStr, sh) =>
                          downloadCanvas(canvas, `sticker-${sh}-${theme}-${sizeStr}.png`)
                        }
                        onExportSvg={(svgStr, sizeStr, sh) =>
                          downloadSvg(svgStr, `sticker-${sh}-${theme}-${sizeStr}.svg`)
                        }
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
