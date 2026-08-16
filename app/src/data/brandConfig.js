// Font brand sẽ bổ sung sau. Chỉ cần sửa file này, không cần chạm App.jsx.
// Copy font vào: app/public/assets/Font/
// Sau đó điền đúng filename bên dưới.
export const brandFont = {
  family: "PlotFlowBrand",
  regular: "", // ví dụ: /assets/Font/Brand-Regular.otf
  medium: "",
  semibold: "",
  bold: "",
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
      ([src, weight]) => `@font-face { font-family: '${config.family}'; src: url('${src}'); font-weight: ${weight}; font-style: normal; font-display: swap; }`
    )
    .join("\n");
}
