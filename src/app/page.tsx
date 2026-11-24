"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, RotateCcw, Download, Check } from "lucide-react";
import {
  BackgroundTheme,
  PanelShape,
  FormatRatio,
  FORMAT_DIMENSIONS,
  renderStandaloneGlassPanel,
  renderRefractedGlassPatch
} from "@/lib/liquidGlassEngine";
import { ASSET_MAP } from "@/lib/assetPaths";

type ScreenId =
  | "home"
  | "opt1-bg-select"
  | "opt1-imagery-select"
  | "opt1-workspace"
  | "opt2-upload"
  | "opt2-workspace"
  | "opt3-bg-select"
  | "opt3-sheet";

interface StickerPreset {
  label: string;
  shape: PanelShape;
  width: number;
  height: number;
}

const STICKER_PRESETS: StickerPreset[] = [
  { label: "420px X 110px", shape: "text-panel", width: 420, height: 110 },
  { label: "330px X 110px", shape: "text-panel", width: 330, height: 110 },
  { label: "420px X 80px", shape: "cta-pill", width: 420, height: 80 },
  { label: "205px X 80px", shape: "cta-pill", width: 205, height: 80 },
  { label: "560px X 220px", shape: "text-panel", width: 560, height: 220 },
  { label: "120px X 120px", shape: "circle", width: 120, height: 120 }
];

function StickerCard({
  preset,
  theme,
  onDownload
}: {
  preset: StickerPreset;
  theme: BackgroundTheme;
  onDownload: (canvas: HTMLCanvasElement, preset: StickerPreset) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = renderStandaloneGlassPanel({
      width: preset.width,
      height: preset.height,
      shape: preset.shape,
      theme,
      frostOpacity: 0.25
    });
    canvasRef.current = c;
    setPreviewUrl(c.toDataURL("image/png"));
  }, [preset, theme]);

  return (
    <button
      onClick={() => canvasRef.current && onDownload(canvasRef.current, preset)}
      className="group flex flex-col items-end gap-1.5 p-3 rounded-xl hover:bg-white/10 transition cursor-pointer w-full"
      title="Click to download .png"
    >
      <div className="w-full h-20 flex items-center justify-center overflow-hidden">
        {previewUrl && (
          <img
            src={previewUrl}
            alt={preset.label}
            className="max-w-full max-h-full object-contain transition-transform group-hover:scale-[1.02]"
          />
        )}
      </div>
      <span
        className={
          "text-[11px] font-medium flex items-center gap-1 " +
          (theme === "white" ? "text-neutral-600" : "text-neutral-300")
        }
      >
        {preset.label}
        <Download className="w-3 h-3 opacity-60 group-hover:opacity-100" />
      </span>
    </button>
  );
}

export default function HomePage() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [theme, setTheme] = useState<BackgroundTheme>("imagery");
  const [imageryOption, setImageryOption] = useState<1 | 2 | 3 | 4>(1);
  const [format, setFormat] = useState<FormatRatio>("1:1");
  const [shape, setShape] = useState<PanelShape>("text-panel");
  const [widthInput, setWidthInput] = useState("420");
  const [heightInput, setHeightInput] = useState("180");
  const [opacitySlider, setOpacitySlider] = useState(25);

  const [panelPos, setPanelPos] = useState({ x: 330, y: 450 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  const [stageBgImg, setStageBgImg] = useState<HTMLImageElement | null>(null);
  const [uploadedBgImg, setUploadedBgImg] = useState<HTMLImageElement | null>(null);
  const [uploadedBgDims, setUploadedBgDims] = useState({ width: 1920, height: 1080 });
  const [toastMsg, setToastMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const stageDims =
    screen === "opt2-workspace" ? uploadedBgDims : FORMAT_DIMENSIONS[format];

  const parsedW = Math.max(0, parseInt(widthInput || "0", 10) || 0);
  const parsedH = shape === "circle" ? parsedW : Math.max(0, parseInt(heightInput || "0", 10) || 0);
  const hasValidSize = parsedW >= 24 && parsedH >= 24;

  // Load exact supplied holding background image for Option 1
  useEffect(() => {
    if (screen !== "opt1-workspace") return;
    const folder = FORMAT_DIMENSIONS[format].folder as "1-1" | "4-5" | "9-16" | "16-9";
    const key =
      theme === "white"
        ? "white"
        : theme === "grey1200"
        ? "grey-1200"
        : ("image-option-" + imageryOption);
    const src = ASSET_MAP.backgrounds[folder][key as keyof typeof ASSET_MAP.backgrounds["1-1"]];

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setStageBgImg(img);
      setPanelPos({
        x: Math.max(20, Math.round((FORMAT_DIMENSIONS[format].width - Math.max(80, parsedW)) / 2)),
        y: Math.max(20, Math.round((FORMAT_DIMENSIONS[format].height - Math.max(80, parsedH)) / 2))
      });
    };
    img.src = src;
  }, [screen, format, theme, imageryOption]);

  const drawWorkspace = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const bgSource = screen === "opt2-workspace" ? uploadedBgImg : stageBgImg;
    if (!bgSource) return;

    canvas.width = stageDims.width;
    canvas.height = stageDims.height;
    const ctx = canvas.getContext("2d")!;
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
          frostOpacity: opacitySlider / 100
        }
      );
      ctx.drawImage(patch, Math.round(panelPos.x), Math.round(panelPos.y));
    }
  }, [
    screen,
    uploadedBgImg,
    stageBgImg,
    stageDims,
    hasValidSize,
    parsedW,
    parsedH,
    panelPos,
    shape,
    theme,
    opacitySlider
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
      setToastMsg("Downloaded " + filename);
      setTimeout(() => setToastMsg(""), 2800);
    }, "image/png");
  };

  const handleExport = () => {
    if (!hasValidSize) return;
    if (screen === "opt1-workspace") {
      const isolated = renderStandaloneGlassPanel({
        width: parsedW,
        height: parsedH,
        shape,
        theme,
        frostOpacity: opacitySlider / 100
      });
      downloadCanvas(isolated, "glass-" + shape + "-" + theme + "-" + parsedW + "x" + parsedH + ".png");
    } else if (screen === "opt2-workspace" && uploadedBgImg) {
      const out = document.createElement("canvas");
      out.width = uploadedBgDims.width;
      out.height = uploadedBgDims.height;
      const ctx = out.getContext("2d")!;
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
          frostOpacity: opacitySlider / 100
        }
      );
      ctx.drawImage(patch, Math.round(panelPos.x), Math.round(panelPos.y));
      downloadCanvas(out, "glass-composited-" + uploadedBgDims.width + "x" + uploadedBgDims.height + ".png");
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
      const sCtx = sample.getContext("2d")!;
      sCtx.drawImage(img, 0, 0, 24, 24);
      const px = sCtx.getImageData(0, 0, 24, 24).data;
      let lum = 0, whites = 0;
      for (let i = 0; i < px.length; i += 4) {
        lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240) whites++;
      }
      const avgLum = lum / (24 * 24);
      if (whites > 24 * 24 * 0.5) setTheme("white");
      else if (avgLum < 45) setTheme("grey1200");
      else setTheme("imagery");

      setUploadedBgDims({ width: img.naturalWidth, height: img.naturalHeight });
      setUploadedBgImg(img);
      const initW = Math.min(480, Math.round(img.naturalWidth * 0.35));
      const initH = Math.min(190, Math.round(img.naturalHeight * 0.2));
      setWidthInput(String(initW));
      setHeightInput(String(initH));
      setPanelPos({
        x: Math.round((img.naturalWidth - initW) / 2),
        y: Math.round((img.naturalHeight - initH) / 2)
      });
      setScreen("opt2-workspace");
    };
    img.src = url;
  };

  const currentPageBg =
    screen === "home"
      ? ASSET_MAP.pages.cover
      : screen === "opt1-bg-select"
      ? ASSET_MAP.pages.exportJustPanelCover
      : screen === "opt1-imagery-select"
      ? ASSET_MAP.pages.fullBleedImageCover
      : screen === "opt1-workspace"
      ? ASSET_MAP.pages.exportJustPanelInternal
      : screen === "opt2-upload"
      ? ASSET_MAP.pages.exportOnBackgroundCover
      : screen === "opt2-workspace"
      ? ASSET_MAP.pages.exportOnBackgroundInternal
      : screen === "opt3-bg-select"
      ? ASSET_MAP.pages.stickerSheetCover
      : theme === "grey1200"
      ? ASSET_MAP.pages.stickerSheetGrey1200
      : theme === "white"
      ? ASSET_MAP.pages.stickerSheetWhite
      : ASSET_MAP.pages.stickerSheetImagery;

  return (
    <div className="min-h-screen w-full bg-[#F1F3F4] flex flex-col items-center justify-center p-3 md:p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Navigation Bar */}
      <div className="w-full max-w-[1280px] flex items-center justify-between mb-2.5 h-8 px-1">
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
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-black bg-white px-3 py-1.5 rounded-full border border-neutral-200 shadow-sm transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {toastMsg && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> {toastMsg}
            </span>
          )}
          {screen !== "home" && (
            <button
              onClick={() => setScreen("home")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-black px-3 py-1.5 rounded-full hover:bg-white/80 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Home
            </button>
          )}
        </div>
      </div>

      {/* Exact 16:9 Stage Using Your Supplied Branded Pages */}
      <div className="relative w-full max-w-[1280px] aspect-[16/9] bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/90 select-none">
        <img
          src={currentPageBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* 1. HOME CLICK ZONES */}
        {screen === "home" && (
          <>
            <button
              aria-label="Export just a panel to size"
              onClick={() => setScreen("opt1-bg-select")}
              className="absolute top-[73%] left-[8%] w-[23%] h-[16%] rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
            />
            <button
              aria-label="Export a panel on your background"
              onClick={() => setScreen("opt2-upload")}
              className="absolute top-[73%] left-[36%] w-[28%] h-[16%] rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
            />
            <button
              aria-label="Select from our sticker sheet"
              onClick={() => setScreen("opt3-bg-select")}
              className="absolute top-[73%] left-[68%] w-[25%] h-[16%] rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
            />
          </>
        )}

        {/* 2. OPTION 1 BACKGROUND SELECT CLICK ZONES */}
        {screen === "opt1-bg-select" && (
          <>
            <button
              aria-label="Full bleed image"
              onClick={() => {
                setTheme("imagery");
                setScreen("opt1-imagery-select");
              }}
              className="absolute top-[73%] left-[9%] w-[21%] h-[16%] rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
            />
            <button
              aria-label="Grey 1200"
              onClick={() => {
                setTheme("grey1200");
                setFormat("1:1");
                setScreen("opt1-workspace");
              }}
              className="absolute top-[73%] left-[39%] w-[22%] h-[16%] rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
            />
            <button
              aria-label="White"
              onClick={() => {
                setTheme("white");
                setFormat("1:1");
                setScreen("opt1-workspace");
              }}
              className="absolute top-[73%] left-[70%] w-[20%] h-[16%] rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
            />
          </>
        )}

        {/* 3. OPTION 1 FULL-BLEED 4 THUMBNAIL CLICK ZONES */}
        {screen === "opt1-imagery-select" && (
          <>
            {([1, 4, 3, 2] as const).map((optNum, idx) => (
              <button
                key={optNum}
                aria-label={"Select example background " + (idx + 1)}
                onClick={() => {
                  setImageryOption(optNum);
                  setTheme("imagery");
                  setFormat("1:1");
                  setScreen("opt1-workspace");
                }}
                style={{ left: (5.5 + idx * 22.5) + "%" }}
                className="absolute top-[49.5%] w-[21.5%] h-[38.8%] rounded-sm hover:ring-4 hover:ring-blue-500/70 transition cursor-pointer"
              />
            ))}
          </>
        )}

        {/* 4. OPTION 2 UPLOAD NOW BUTTON CLICK ZONE */}
        {screen === "opt2-upload" && (
          <button
            aria-label="Upload now"
            onClick={() => fileInputRef.current?.click()}
            className="absolute top-[73.5%] left-[35%] w-[30%] h-[15%] rounded-full hover:bg-black/[0.03] transition cursor-pointer"
          />
        )}

        {/* 5. WORKSPACE OVERLAYS (LEFT CANVAS + RIGHT CONTROLS BELOW YOUR SUPPLIED COPY) */}
        {(screen === "opt1-workspace" || screen === "opt2-workspace") && (
          <>
            {/* Left Canvas Area */}
            <div className="absolute left-[5.5%] top-[21%] w-[40%] h-[70%] flex items-center justify-center overflow-hidden">
              <canvas
                ref={previewCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={
                  "max-w-full max-h-full object-contain shadow-sm " +
                  (hasValidSize ? "cursor-grab active:cursor-grabbing" : "cursor-default")
                }
              />
            </div>

            {/* Right Controls Area (Positioned cleanly underneath your supplied instruction text) */}
            <div className="absolute left-[50%] top-[51%] w-[43%] flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-4">
                {screen === "opt1-workspace" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-neutral-800">Format</label>
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
                  <label className="text-[11px] font-semibold text-neutral-800">Shape</label>
                  <select
                    value={shape}
                    onChange={(e) => {
                      const next = e.target.value as PanelShape;
                      setShape(next);
                      if (next === "circle") setHeightInput(widthInput);
                      else if (next === "cta-pill" && parseInt(heightInput, 10) > 140) {
                        setHeightInput("84");
                      }
                    }}
                    className="h-8 px-2.5 text-xs font-medium bg-white border border-neutral-800 rounded-md focus:outline-none"
                  >
                    <option value="text-panel">Text panel</option>
                    <option value="circle">Circle</option>
                    <option value="cta-pill">CTA pill</option>
                  </select>
                </div>
              </div>

              {/* Pixel Dimensions */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-neutral-800">Size</label>
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
                    className="w-20 h-8 px-2.5 text-xs bg-white border border-neutral-800 rounded-md focus:outline-none"
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
                        className="w-20 h-8 px-2.5 text-xs bg-white border border-neutral-800 rounded-md focus:outline-none"
                      />
                      <span>px high</span>
                    </>
                  )}
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="flex flex-col gap-1 max-w-[280px]">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-800">Opacity</label>
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

              {/* Export Button */}
              <div className="pt-1 flex items-center justify-end max-w-[300px]">
                <button
                  onClick={handleExport}
                  disabled={!hasValidSize}
                  className="px-6 py-1.5 rounded-full border-[1.5px] border-neutral-900 bg-white hover:bg-neutral-900 hover:text-white disabled:opacity-40 text-[11px] font-bold tracking-wider uppercase transition cursor-pointer"
                >
                  EXPORT
                </button>
              </div>
            </div>
          </>
        )}

        {/* 6. OPTION 3 STICKER SHEET COVER CLICK ZONES */}
        {screen === "opt3-bg-select" && (
          <>
            <button
              aria-label="Full bleed image"
              onClick={() => {
                setTheme("imagery");
                setScreen("opt3-sheet");
              }}
              className="absolute top-[73%] left-[9%] w-[21%] h-[16%] rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
            />
            <button
              aria-label="Grey 1200"
              onClick={() => {
                setTheme("grey1200");
                setScreen("opt3-sheet");
              }}
              className="absolute top-[73%] left-[39%] w-[22%] h-[16%] rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
            />
            <button
              aria-label="White"
              onClick={() => {
                setTheme("white");
                setScreen("opt3-sheet");
              }}
              className="absolute top-[73%] left-[70%] w-[20%] h-[16%] rounded-2xl hover:bg-black/[0.04] transition cursor-pointer"
            />
          </>
        )}

        {/* 7. OPTION 3 STICKER SHEET GALLERY */}
        {screen === "opt3-sheet" && (
          <div
            className={
              "absolute left-0 right-0 bottom-0 top-[42%] px-[6%] py-5 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4 items-center " +
              (theme === "imagery" ? "bg-[#263238]/90" : "")
            }
          >
            {STICKER_PRESETS.map((preset) => (
              <StickerCard
                key={preset.label}
                preset={preset}
                theme={theme}
                onDownload={(canvas, p) =>
                  downloadCanvas(
                    canvas,
                    "sticker-" + p.shape + "-" + theme + "-" + p.width + "x" + p.height + ".png"
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
