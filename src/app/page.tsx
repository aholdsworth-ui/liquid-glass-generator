"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  BackgroundTheme,
  FormatRatio,
  PanelShape,
  FORMAT_DIMENSIONS,
  renderStandaloneGlassPanel,
  renderRefractedGlassPatch,
  generateStandaloneGlassSvg,
  generateCompositedGlassSvg,
} from "@/lib/liquidGlassEngine";

type AppScreen =
  | "home"
  | "opt1-bg-select"
  | "opt1-imagery-select"
  | "opt1-workspace"
  | "opt2-upload"
  | "opt2-workspace"
  | "opt3-bg-select"
  | "opt3-sheet";

const LOCKED_THEME_OPACITY: Record<BackgroundTheme, number> = {
  imagery: 35,
  grey1200: 40,
  white: 80,
};

interface StickerCategory {
  id: string;
  title: string;
  shape: PanelShape;
  sizes: [number, number][];
}

const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: "squares",
    title: "Square Text Panels",
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
    shape: "cta-pill",
    sizes: [
      [160, 52], [205, 64], [205, 80], [260, 72], [300, 80],
      [360, 88], [420, 80], [480, 96], [560, 104], [680, 112],
    ],
  },
  {
    id: "circles",
    title: "Circles",
    shape: "circle",
    sizes: [
      [56, 56], [72, 72], [88, 88], [104, 104], [120, 120],
      [160, 160], [200, 200], [260, 260], [340, 340], [440, 440],
    ],
  },
];

const IMAGERY_THUMB_ORDER = [1, 4, 3, 2] as const;

export default function LiquidGlassGeneratorApp() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [theme, setTheme] = useState<BackgroundTheme>("imagery");
  const [imageryOption, setImageryOption] = useState<number>(1);
  const [format, setFormat] = useState<FormatRatio>("1:1");
  const [shape, setShape] = useState<PanelShape>("text-panel");
  const [widthInput, setWidthInput] = useState<string>("420");
  const [heightInput, setHeightInput] = useState<string>("180");
  const [opacitySlider, setOpacitySlider] = useState<number>(35);
  const [activeStickerFilter, setActiveStickerFilter] = useState<string>("all");
  const [openStickerMenuKey, setOpenStickerMenuKey] = useState<string | null>(null);

  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>({ x: 180, y: 180 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const [uploadedBgUrl, setUploadedBgUrl] = useState<string | null>(null);
  const [uploadedBgDims, setUploadedBgDims] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loadedBgImg, setLoadedBgImg] = useState<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const applyThemeWithCalibratedOpacity = (nextTheme: BackgroundTheme) => {
    setTheme(nextTheme);
    setOpacitySlider(LOCKED_THEME_OPACITY[nextTheme]);
  };

  useEffect(() => {
    const closeMenus = () => setOpenStickerMenuKey(null);
    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
  }, []);

  const getOption1BgUrl = useCallback(() => {
    const folder = FORMAT_DIMENSIONS[format].folder;
    if (theme === "white") return `/backgrounds/${folder}/white.jpg`;
    if (theme === "grey1200") return `/backgrounds/${folder}/grey-1200.jpg`;
    return `/backgrounds/${folder}/image-option-${imageryOption}.jpg`;
  }, [format, theme, imageryOption]);

  const stageDims =
    screen === "opt2-workspace" ? uploadedBgDims : FORMAT_DIMENSIONS[format];

  const parsedW = Math.max(0, parseInt(widthInput || "0", 10) || 0);
  const parsedH = shape === "circle" ? parsedW : Math.max(0, parseInt(heightInput || "0", 10) || 0);
  const hasValidSize = parsedW >= 24 && parsedH >= 24;

  useEffect(() => {
    let activeSrc: string | null = null;
    if (screen === "opt1-workspace") {
      activeSrc = getOption1BgUrl();
    } else if (screen === "opt2-workspace" && uploadedBgUrl) {
      activeSrc = uploadedBgUrl;
    }
    if (!activeSrc) {
      setLoadedBgImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setLoadedBgImg(img);
      const targetW = screen === "opt2-workspace" ? img.naturalWidth : FORMAT_DIMENSIONS[format].width;
      const targetH = screen === "opt2-workspace" ? img.naturalHeight : FORMAT_DIMENSIONS[format].height;
      setPanelPos((prev) => ({
        x: Math.max(0, Math.min(targetW - Math.max(60, parsedW), prev.x || Math.round((targetW - parsedW) / 2))),
        y: Math.max(0, Math.min(targetH - Math.max(60, parsedH), prev.y || Math.round((targetH - parsedH) / 2))),
      }));
    };
    img.src = activeSrc;
  }, [screen, getOption1BgUrl, uploadedBgUrl, format]);

  const detectImageTheme = (img: HTMLImageElement): BackgroundTheme => {
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 32;
    sampleCanvas.height = 32;
    const sCtx = sampleCanvas.getContext("2d");
    if (!sCtx) return "imagery";
    sCtx.drawImage(img, 0, 0, 32, 32);
    const d = sCtx.getImageData(0, 0, 32, 32).data;
    let brightSum = 0;
    let nearWhiteCount = 0;
    for (let i = 0; i < d.length; i += 4) {
      brightSum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (d[i] > 242 && d[i + 1] > 242 && d[i + 2] > 242) nearWhiteCount++;
    }
    const avgLum = brightSum / (32 * 32);
    if (nearWhiteCount > 32 * 32 * 0.55) return "white";
    if (avgLum < 45) return "grey1200";
    return "imagery";
  };

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !loadedBgImg) return;
    if (screen !== "opt1-workspace" && screen !== "opt2-workspace") return;

    canvas.width = stageDims.width;
    canvas.height = stageDims.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, stageDims.width, stageDims.height);
    ctx.drawImage(loadedBgImg, 0, 0, stageDims.width, stageDims.height);

    if (hasValidSize) {
      const patch = renderRefractedGlassPatch(
        loadedBgImg,
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
    loadedBgImg,
    stageDims,
    hasValidSize,
    parsedW,
    parsedH,
    panelPos,
    shape,
    theme,
    opacitySlider,
  ]);

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

    const nx = Math.max(-parsedW * 0.25, Math.min(stageDims.width - parsedW * 0.75, curX - dragOffset.current.dx));
    const ny = Math.max(-parsedH * 0.25, Math.min(stageDims.height - parsedH * 0.75, curY - dragOffset.current.dy));
    setPanelPos({ x: nx, y: ny });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const triggerCanvasDownload = (canvas: HTMLCanvasElement, filename: string) => {
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
    }, "image/png");
  };

  const triggerSvgDownload = (svgString: string, filename: string) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      triggerCanvasDownload(
        isolated,
        `liquid-glass-${shape}-${theme}-${parsedW}x${parsedH}.png`
      );
    } else if (screen === "opt2-workspace" && loadedBgImg) {
      const out = document.createElement("canvas");
      out.width = uploadedBgDims.width;
      out.height = uploadedBgDims.height;
      const ctx = out.getContext("2d")!;
      ctx.drawImage(loadedBgImg, 0, 0, uploadedBgDims.width, uploadedBgDims.height);
      const refracted = renderRefractedGlassPatch(
        loadedBgImg,
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
      ctx.drawImage(refracted, Math.round(panelPos.x), Math.round(panelPos.y));
      triggerCanvasDownload(
        out,
        `liquid-glass-composited-${uploadedBgDims.width}x${uploadedBgDims.height}.png`
      );
    }
  };

  const handleExportVector = () => {
    if (!hasValidSize) return;
    if (screen === "opt1-workspace") {
      const svgStr = generateStandaloneGlassSvg({
        width: parsedW,
        height: parsedH,
        shape,
        theme,
        frostOpacity: opacitySlider / 100,
      });
      triggerSvgDownload(
        svgStr,
        `liquid-glass-${shape}-${theme}-${parsedW}x${parsedH}.svg`
      );
    } else if (screen === "opt2-workspace" && loadedBgImg) {
      const svgStr = generateCompositedGlassSvg(
        loadedBgImg,
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
      triggerSvgDownload(
        svgStr,
        `liquid-glass-composited-${uploadedBgDims.width}x${uploadedBgDims.height}.svg`
      );
    }
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const detected = detectImageTheme(img);
      applyThemeWithCalibratedOpacity(detected);
      setUploadedBgDims({ width: img.naturalWidth, height: img.naturalHeight });
      setUploadedBgUrl(url);
      const initW = Math.min(480, Math.round(img.naturalWidth * 0.35));
      const initH = Math.min(200, Math.round(img.naturalHeight * 0.22));
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

  return (
    <main className="min-h-screen w-full bg-[#F4F5F7] flex flex-col items-center justify-start py-4 md:py-6 px-3 md:px-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleUploadFile}
      />

      {/* Top Navigation Bar */}
      <div className="w-full max-w-[1280px] flex items-center justify-between mb-2 px-1 h-8 sticky top-2 z-30">
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
            className="text-xs font-medium text-neutral-700 hover:text-neutral-950 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur border border-neutral-200 shadow-sm transition cursor-pointer"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}
        {screen !== "home" && (
          <button
            onClick={() => setScreen("home")}
            className="text-xs font-medium text-neutral-600 hover:text-neutral-950 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-neutral-200 shadow-sm transition cursor-pointer"
          >
            Start over
          </button>
        )}
      </div>

      {screen !== "opt3-sheet" ? (
        <div className="relative w-full max-w-[1280px] aspect-[16/9] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/80 select-none">
          {/* 1. MAIN LANDING PAGE */}
          {screen === "home" && (
            <div className="relative w-full h-full">
              <img
                src="/pages/cover-16-9.jpg"
                alt="Welcome to our glass panel and pill generator"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setScreen("opt1-bg-select")}
                style={{ left: "9%", top: "73%", width: "21%", height: "18%" }}
                className="absolute rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="Export just a panel to size"
              />
              <button
                onClick={() => setScreen("opt2-upload")}
                style={{ left: "37%", top: "73%", width: "26%", height: "18%" }}
                className="absolute rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="Export a panel on your background"
              />
              <button
                onClick={() => setScreen("opt3-bg-select")}
                style={{ left: "69%", top: "73%", width: "23%", height: "18%" }}
                className="absolute rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="Select from our sticker sheet"
              />
            </div>
          )}

          {/* 2. OPTION 1 — SELECT BACKGROUND TYPE */}
          {screen === "opt1-bg-select" && (
            <div className="relative w-full h-full">
              <img
                src="/pages/export-just-panel-cover.jpg"
                alt="Export just a panel to size"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => {
                  applyThemeWithCalibratedOpacity("imagery");
                  setScreen("opt1-imagery-select");
                }}
                style={{ left: "11%", top: "74%", width: "17%", height: "16%" }}
                className="absolute rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="Full bleed image"
              />
              <button
                onClick={() => {
                  applyThemeWithCalibratedOpacity("grey1200");
                  setFormat("1:1");
                  setScreen("opt1-workspace");
                }}
                style={{ left: "41%", top: "74%", width: "18%", height: "16%" }}
                className="absolute rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="Grey 1200"
              />
              <button
                onClick={() => {
                  applyThemeWithCalibratedOpacity("white");
                  setFormat("1:1");
                  setScreen("opt1-workspace");
                }}
                style={{ left: "73%", top: "74%", width: "15%", height: "16%" }}
                className="absolute rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="White"
              />
            </div>
          )}

          {/* 3. OPTION 1 — FULL BLEED 4-IMAGE PICKER */}
          {screen === "opt1-imagery-select" && (
            <div className="relative w-full h-full">
              <img
                src="/pages/full-bleed-image-cover.jpg"
                alt="Select an example background"
                className="w-full h-full object-cover"
              />
              {IMAGERY_THUMB_ORDER.map((optNum, idx) => {
                const leftPositions = ["5.5%", "28.0%", "50.5%", "72.9%"];
                return (
                  <button
                    key={optNum}
                    onClick={() => {
                      setImageryOption(optNum);
                      applyThemeWithCalibratedOpacity("imagery");
                      setFormat("1:1");
                      setScreen("opt1-workspace");
                    }}
                    style={{
                      left: leftPositions[idx],
                      top: "49.8%",
                      width: "21.5%",
                      height: "38.5%",
                    }}
                    className="absolute rounded-lg hover:ring-4 hover:ring-blue-500/60 transition cursor-pointer"
                    aria-label={`Example image ${idx + 1}`}
                  />
                );
              })}
            </div>
          )}

          {/* 4. OPTION 2 — UPLOAD COVER */}
          {screen === "opt2-upload" && (
            <div className="relative w-full h-full">
              <img
                src="/pages/export-on-background-cover.jpg"
                alt="Export a panel on your background"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ left: "35%", top: "74.5%", width: "30%", height: "16%" }}
                className="absolute rounded-full hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="Upload now"
              />
            </div>
          )}

          {/* 5. WORKSPACE FOR OPTION 1 & OPTION 2 */}
          {(screen === "opt1-workspace" || screen === "opt2-workspace") && (
            <div className="relative w-full h-full">
              <img
                src={
                  screen === "opt1-workspace"
                    ? "/pages/export-just-panel-internal.jpg"
                    : "/pages/export-on-background-internal.jpg"
                }
                alt="Workspace"
                className="w-full h-full object-cover pointer-events-none"
              />

              <div
                style={{ left: "5%", top: "20%", width: "41%", height: "73%" }}
                className="absolute flex items-center justify-center p-2"
              >
                <div className="relative w-full h-full flex items-center justify-center">
                  <canvas
                    ref={previewCanvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className={`max-w-full max-h-full object-contain shadow-md border border-neutral-200/70 ${
                      hasValidSize ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                    }`}
                  />
                </div>
              </div>

              <div
                style={{ left: "50.1%", top: "51.5%", width: "43%", height: "45%" }}
                className="absolute flex flex-col justify-start gap-2.5 text-[#121317]"
              >
                <div className="flex flex-wrap items-end gap-4">
                  {screen === "opt1-workspace" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold tracking-tight text-neutral-800">
                        Format
                      </label>
                      <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value as FormatRatio)}
                        className="h-8 px-2.5 text-xs font-medium bg-white border border-neutral-800 rounded-md focus:outline-none"
                      >
                        <option value="1:1">1:1</option>
                        <option value="4:5">4:5</option>
                        <option value="9:16">9:16</option>
                        <option value="16:9">16:9</option>
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold tracking-tight text-neutral-800">
                      Shape
                    </label>
                    <select
                      value={shape}
                      onChange={(e) => {
                        const nextShape = e.target.value as PanelShape;
                        setShape(nextShape);
                        if (nextShape === "circle") {
                          setHeightInput(widthInput);
                        } else if (nextShape === "cta-pill" && parseInt(heightInput, 10) > 140) {
                          setHeightInput("88");
                        }
                      }}
                      className="h-8 px-2.5 text-xs font-medium bg-white border border-neutral-800 rounded-md focus:outline-none"
                    >
                      <option value="text-panel">Text panel</option>
                      <option value="circle">Circle</option>
                      <option value="cta-pill">CTA pill</option>
                    </select>
                  </div>

                  {screen === "opt2-workspace" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold tracking-tight text-neutral-800">
                        Glass tone
                      </label>
                      <select
                        value={theme}
                        onChange={(e) => applyThemeWithCalibratedOpacity(e.target.value as BackgroundTheme)}
                        className="h-8 px-2.5 text-xs font-medium bg-white border border-neutral-800 rounded-md focus:outline-none"
                      >
                        <option value="imagery">Full bleed image</option>
                        <option value="grey1200">Grey 1200</option>
                        <option value="white">White</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold tracking-tight text-neutral-800">
                    Size
                  </label>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="number"
                      min={24}
                      max={4000}
                      value={widthInput}
                      onChange={(e) => {
                        setWidthInput(e.target.value);
                        if (shape === "circle") setHeightInput(e.target.value);
                      }}
                      className="w-20 h-8 px-2 text-xs bg-white border border-neutral-800 rounded-md focus:outline-none"
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
                          className="w-20 h-8 px-2 text-xs bg-white border border-neutral-800 rounded-md focus:outline-none"
                        />
                        <span>px high</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 max-w-[280px]">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold tracking-tight text-neutral-800">
                      Opacity
                    </label>
                    <span className="text-[11px] text-neutral-500">{opacitySlider}%</span>
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

                {/* Dual Export Buttons: Export .png & Export vector */}
                <div className="pt-1 flex flex-col gap-1.5 max-w-[380px]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={handleExportPng}
                      disabled={!hasValidSize}
                      className="px-5 py-1.5 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-40 text-xs font-semibold transition cursor-pointer"
                    >
                      Export .png
                    </button>
                    <button
                      onClick={handleExportVector}
                      disabled={!hasValidSize}
                      className="px-5 py-1.5 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-40 text-xs font-semibold transition cursor-pointer"
                    >
                      Export vector
                    </button>
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    {screen === "opt1-workspace"
                      ? `Panel only: ${parsedW || 0}×${parsedH || 0}px`
                      : `Set on background: ${uploadedBgDims.width}×${uploadedBgDims.height}px`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 6. OPTION 3 — STICKER SHEET BACKGROUND SELECTOR */}
          {screen === "opt3-bg-select" && (
            <div className="relative w-full h-full">
              <img
                src="/pages/sticker-sheet-cover.jpg"
                alt="Sticker sheet"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => {
                  applyThemeWithCalibratedOpacity("imagery");
                  setActiveStickerFilter("all");
                  setOpenStickerMenuKey(null);
                  setScreen("opt3-sheet");
                }}
                style={{ left: "11%", top: "74%", width: "17%", height: "16%" }}
                className="absolute rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="Full bleed image"
              />
              <button
                onClick={() => {
                  applyThemeWithCalibratedOpacity("grey1200");
                  setActiveStickerFilter("all");
                  setOpenStickerMenuKey(null);
                  setScreen("opt3-sheet");
                }}
                style={{ left: "41%", top: "74%", width: "18%", height: "16%" }}
                className="absolute rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="Grey 1200"
              />
              <button
                onClick={() => {
                  applyThemeWithCalibratedOpacity("white");
                  setActiveStickerFilter("all");
                  setOpenStickerMenuKey(null);
                  setScreen("opt3-sheet");
                }}
                style={{ left: "73%", top: "74%", width: "15%", height: "16%" }}
                className="absolute rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
                aria-label="White"
              />
            </div>
          )}
        </div>
      ) : (
        /* 7. OPTION 3 — FULL SCROLLING 80-ASSET STICKER SHEET */
        <div className="w-full max-w-[1280px] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/80 flex flex-col">
          <div className="relative w-full aspect-[16/4.4] overflow-hidden bg-white">
            <img
              src={
                theme === "grey1200"
                  ? "/pages/sticker-sheet-internal-grey-1200.png"
                  : theme === "white"
                  ? "/pages/sticker-sheet-internal-white.jpg"
                  : "/pages/sticker-sheet-internal-imagery.jpg"
              }
              alt={`Sticker sheet ${theme}`}
              className="w-full h-auto object-cover object-top pointer-events-none"
            />
          </div>

          <div className="w-full px-6 py-3.5 bg-white border-y border-neutral-200 flex flex-wrap items-center justify-between gap-3 sticky top-12 z-20">
            <div className="flex flex-wrap items-center gap-2">
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
            <span className="text-xs text-neutral-500">
              Click any panel to choose Export .png or Export vector ({LOCKED_THEME_OPACITY[theme]}% opacity)
            </span>
          </div>

          <div
            className={`w-full px-6 sm:px-10 py-10 space-y-12 ${
              theme === "grey1200"
                ? "bg-[#121317] text-white"
                : theme === "white"
                ? "bg-[#F8F9FA] text-[#121317]"
                : "bg-[#1C242B] text-white"
            }`}
          >
            {visibleCategories.map((cat) => (
              <section key={cat.id} className="space-y-4">
                <div className="flex items-baseline justify-between border-b border-current/15 pb-2">
                  <h3 className="text-lg font-semibold tracking-tight">{cat.title}</h3>
                  <span className="text-xs opacity-60">{cat.sizes.length} sizes</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
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
                        onDownloadPng={(canvas) =>
                          triggerCanvasDownload(
                            canvas,
                            `sticker-${cat.shape}-${theme}-${w}x${h}.png`
                          )
                        }
                        onDownloadSvg={(svgStr) =>
                          triggerSvgDownload(
                            svgStr,
                            `sticker-${cat.shape}-${theme}-${w}x${h}.svg`
                          )
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

function StickerCard({
  width,
  height,
  shape,
  theme,
  isOpen,
  onToggleMenu,
  onDownloadPng,
  onDownloadSvg,
}: {
  width: number;
  height: number;
  shape: PanelShape;
  theme: BackgroundTheme;
  isOpen: boolean;
  onToggleMenu: (open: boolean) => void;
  onDownloadPng: (canvas: HTMLCanvasElement) => void;
  onDownloadSvg: (svgStr: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
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
          const maxPreviewDim = 240;
          const scale = Math.min(1, maxPreviewDim / Math.max(width, height));
          const pw = Math.max(20, Math.round(width * scale));
          const ph = Math.max(20, Math.round(height * scale));
          const scaledRadius = Math.max(4, 20 * scale);

          const thumb = renderStandaloneGlassPanel({
            width: pw,
            height: ph,
            shape,
            theme,
            frostOpacity: lockedOpacity,
            customRadius: scaledRadius,
          });
          if (!cancelled) {
            setPreviewUrl(thumb.toDataURL("image/png"));
          }
        }
      },
      { rootMargin: "250px" }
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [width, height, shape, theme, lockedOpacity]);

  const handleChoosePng = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExporting) return;
    setIsExporting(true);
    requestAnimationFrame(() => {
      const fullCanvas = renderStandaloneGlassPanel({
        width,
        height,
        shape,
        theme,
        frostOpacity: lockedOpacity,
      });
      onDownloadPng(fullCanvas);
      setIsExporting(false);
      onToggleMenu(false);
    });
  };

  const handleChooseVector = (e: React.MouseEvent) => {
    e.stopPropagation();
    const svgStr = generateStandaloneGlassSvg({
      width,
      height,
      shape,
      theme,
      frostOpacity: lockedOpacity,
    });
    onDownloadSvg(svgStr);
    onToggleMenu(false);
  };

  return (
    <div
      ref={cardRef}
      onClick={(e) => {
        e.stopPropagation();
        onToggleMenu(!isOpen);
      }}
      className={`relative group flex flex-col items-end justify-between gap-2 p-4 rounded-xl border transition cursor-pointer w-full ${
        theme === "white"
          ? "border-neutral-200/90 bg-white/80 hover:bg-white hover:border-neutral-400 shadow-sm"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/25"
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

        {/* Stacked Mini Dropdown Menu Over the Panel Image */}
        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-20 flex items-center justify-center p-2"
          >
            <div className="w-40 rounded-xl bg-white text-[#121317] shadow-xl border border-neutral-200 overflow-hidden flex flex-col divide-y divide-neutral-100">
              <button
                type="button"
                onClick={handleChoosePng}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 transition cursor-pointer"
              >
                {isExporting ? "Exporting..." : "Export .png"}
              </button>
              <button
                type="button"
                onClick={handleChooseVector}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-neutral-100 transition cursor-pointer"
              >
                Export vector
              </button>
            </div>
          </div>
        )}
      </div>

      <span
        className={`text-[11px] font-medium tracking-tight ${
          theme === "white" ? "text-neutral-700" : "text-neutral-300"
        } group-hover:underline`}
      >
        {width}px X {height}px
      </span>
    </div>
  );
}
