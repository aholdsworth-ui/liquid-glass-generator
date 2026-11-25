export interface ZoneRect { left: number; top: number; width: number; height: number; }
export const GFS_MOMENTUM_DRIVE_URL = "https://drive.google.com/corp/drive/folders/1M1OORV7B5g5e-TGADNOJTaPDynvCoWAK";
export const PAGE_ASSETS = {
  "home": "/assets/glass-panel-app_16_9-cover.png?v=1795645950",
  "slidesPreCover": "/assets/glass-panel-app_16_9-export-just-a-panel-pre-cover.png?v=1795645950",
  "slidesCreateCover": "/assets/glass-panel-app_16_9-export-just-a-panel-cover.png?v=1795645950",
  "slidesFullBleedCover": "/assets/glass-panel-app_16_9-full-bleed-image-cover.png?v=1795645950",
  "slidesInternal": "/assets/glass-panel-app_16_9-export-just-a-panel-internal-page.png?v=1795645950",
  "stickerCover": "/assets/glass-panel-app_16_9-sticker-sheet-cover.png?v=1795645950",
  "stickerImagery": "/assets/glass-panel-app_16_9-sticker-sheet-internal-imagery.png?v=1795645950",
  "stickerGrey1200": "/assets/glass-panel-app_16_9-sticker-sheet-internal-grey-1200.png?v=1795645950",
  "stickerWhite": "/assets/glass-panel-app_16_9-sticker-sheet-internal-white.png?v=1795645950",
  "bgUploadCover": "/assets/glass-panel-app_16_9-export-a-panel-on-your-background-cover.png?v=1795645950",
  "bgInternal": "/assets/glass-panel-app_16_9-export-on-a-background-internal-page.png?v=1795645950"
} as const;
export const BG_ASSETS = { imageryExamples: [
  "/assets/3._background_imagery_3a._1_1_glass_panel_app_1_1_image_option_1.png?v=1795645950",
  "/assets/glass-panel-app-16-9-image-option-4.png?v=1795645950",
  "/assets/glass-panel-app-16-9-image-option-3.png?v=1795645950",
  "/assets/glass-panel-app-1-1-image-option-2.png?v=1795645950"
], grey1200: "/assets/glass-panel-app_9_16-grey-1200.png?v=1795645950", white: "/assets/glass-panel-app_9_16-white.png?v=1795645950" } as const;
export const BUTTON_ZONES: Record<string, ZoneRect[]> = {
  "home": [
    {
      "left": 25.71,
      "top": 72.56,
      "width": 20.82,
      "height": 12.57
    },
    {
      "left": 54.88,
      "top": 72.56,
      "width": 18.11,
      "height": 12.57
    }
  ],
  "slidesPreCover": [
    {
      "left": 26.91,
      "top": 62.93,
      "width": 18.32,
      "height": 21.19
    },
    {
      "left": 54.82,
      "top": 62.93,
      "width": 18.22,
      "height": 22.76
    }
  ],
  "slidesCreateCover": [
    {
      "left": 11.28,
      "top": 75.84,
      "width": 21.81,
      "height": 9.8
    },
    {
      "left": 29.04,
      "top": 60.98,
      "width": 40.15,
      "height": 24.33
    },
    {
      "left": 69.61,
      "top": 75.47,
      "width": 16.5,
      "height": 9.8
    }
  ],
  "stickerCover": [
    {
      "left": 24,
      "top": 72.0,
      "width": 20.0,
      "height": 11.0
    },
    {
      "left": 48,
      "top": 72.0,
      "width": 20.0,
      "height": 11.0
    },
    {
      "left": 72,
      "top": 72.0,
      "width": 20.0,
      "height": 11.0
    }
  ],
  "bgUploadCover": [
    {
      "left": 26.39,
      "top": 62.93,
      "width": 16.71,
      "height": 24.06
    },
    {
      "left": 54.67,
      "top": 62.93,
      "width": 21.4,
      "height": 23.41
    }
  ],
  "fullBleedPhotos": [
    {
      "left": 7.5,
      "top": 45.0,
      "width": 20.5,
      "height": 36.0
    },
    {
      "left": 29.0,
      "top": 45.0,
      "width": 20.5,
      "height": 36.0
    },
    {
      "left": 50.5,
      "top": 45.0,
      "width": 20.5,
      "height": 36.0
    },
    {
      "left": 72.0,
      "top": 45.0,
      "width": 20.5,
      "height": 36.0
    }
  ]
};
