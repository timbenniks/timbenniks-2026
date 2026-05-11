// Responsive image width presets, tuned so the browser can always pick a
// variant within ~25% of the rendered size. Each set is named after its
// layout context (see `sizes` notes below) rather than image content, so the
// same set can be reused across components with matching layouts.
//
// Selection rule: pick the smallest array whose lower bound is <= the
// smallest 1x rendered width at your smallest breakpoint, and whose upper
// bound covers ~2x the largest 1x rendered width.

// 100vw full-bleed (hero backgrounds, full-width photo strips).
// sizes: "100vw"
export const fullBleedWidths = [480, 768, 1024, 1280, 1600, 1920, 2400];

// ~50vw on desktop, 100vw on mobile (split heroes, half-page art).
// sizes: "(min-width: 768px) 50vw, 100vw"
export const heroSplitWidths = [360, 480, 640, 768, 960, 1280, 1440];

// Feature card: ~720px on desktop, 100vw on mobile.
// sizes: "(min-width: 1024px) 720px, 100vw"
export const cardFeatureWidths = [360, 480, 640, 720, 900];

// Standard card: 33vw lg, 50vw md, 100vw sm.
// sizes: "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
export const cardStandardWidths = [320, 384, 480, 640, 800];

// Press-kit primary headshot: ~50vw desktop, 66vw mobile.
// sizes: "(min-width: 768px) 50vw, 66vw"
export const headshotPrimaryWidths = [360, 480, 720, 900, 1280, 1600];

// Press-kit secondary headshot: ~16vw desktop, 33vw mobile.
// sizes: "(min-width: 768px) 16vw, 33vw"
export const headshotSecondaryWidths = [160, 240, 320, 480, 640];

// 33vw card on desktop, 100vw on mobile (e.g. on-stage photo grid).
// sizes: "(min-width: 768px) 33vw, 100vw"
export const cardThirdsWidths = [360, 480, 640, 800, 1024, 1280];

// Fixed-size square (ImageTextSection uses [size, size*2, size*3] by design,
// which is already optimal for fixed-size 1x/2x/3x rendering — no preset).
