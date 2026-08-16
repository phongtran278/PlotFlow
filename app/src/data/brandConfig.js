// PlotFlow brand font is bundled with the app so rendering is consistent on macOS and Windows.
// Font files live in: app/public/assets/font/
export const brandFont = {
  family: "PlotFlowBrand",
  regular: "/assets/font/SVN-Gilroy-Regular.otf",
  medium: "/assets/font/SVN-Gilroy-Medium.otf",
  semibold: "/assets/font/SVN-Gilroy-SemiBold.otf",
  bold: "/assets/font/SVN-Gilroy-Bold.otf",
};

export function buildBrandFontCss(config = brandFont) {
  const faces = [
    [config.regular, 400],
    [config.medium, 500],
    [config.semibold, 600],
    [config.bold, 700],
  ].filter(([src]) => src);

  return faces
    .map(
      ([src, weight]) => `@font-face { font-family: '${config.family}'; src: url('${src}') format('opentype'); font-weight: ${weight}; font-style: normal; font-display: swap; }`
    )
    .join("\n");
}
