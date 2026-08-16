const A = "/assets";

export const houseCatalog = [
  { id: "HOUSE_CH71_SAN_VUON", name: "CH 71 sân vườn", fileName: "CH 71 san vuon.png", src: `${A}/houses/CH 71 san vuon.png`, group: "House" },
  { id: "HOUSE_CH59_LK_SAN_VUON", name: "CH-59 · LK sân vườn", fileName: "CH-59-LK Sân vườn.jpg", src: `${A}/houses/CH-59-LK Sân vườn.jpg`, group: "House" },
  { id: "HOUSE_CH53_LK_XE_KHE", name: "CH-53 · LK xe khe", fileName: "CH-53-LK xe khe.jpg", src: `${A}/houses/CH-53-LK xe khe.jpg`, group: "House" },
  { id: "HOUSE_CH15_LK_XE_KHE", name: "CH-15 · LK xe khe", fileName: "CH-15-LK xe khe.jpg", src: `${A}/houses/CH-15-LK xe khe.jpg`, group: "House" },
  { id: "HOUSE_CH75_LK_XE_KHE", name: "CH-75 · LK xe khe", fileName: "CH-75-LK xe khe.jpg", src: `${A}/houses/CH-75-LK xe khe.jpg`, group: "House" },
  { id: "HOUSE_CH53_LK", name: "CH-53 · LK", fileName: "CH-53 LK.jpg", src: `${A}/houses/CH-53 LK.jpg`, group: "House" },
];

export const amenityCatalog = [
  { id: "AMENITY_VINWONDERS", name: "VinWonders", fileName: "vinwonders.jpg", src: `${A}/amenities/vinwonders.jpg`, group: "Lifestyle" },
  { id: "AMENITY_BROCHURE_19", name: "Tiện ích Brochure 19", fileName: "Brochure Vinhomes Saigon Park_Page_19_Image_0001.jpg", src: `${A}/amenities/Brochure Vinhomes Saigon Park_Page_19_Image_0001.jpg`, group: "Featured" },
  { id: "AMENITY_HONGKONG", name: "Hong Kong", fileName: "hongkong.jpg", src: `${A}/amenities/hongkong.jpg`, group: "Lifestyle" },
  { id: "AMENITY_VINCOM", name: "Vincom", fileName: "vincom.jpg", src: `${A}/amenities/vincom.jpg`, group: "Retail" },
  { id: "AMENITY_BROCHURE_25", name: "Tiện ích Brochure 25", fileName: "Brochure Vinhomes Saigon Park_Page_25_Image_0001.jpg", src: `${A}/amenities/Brochure Vinhomes Saigon Park_Page_25_Image_0001.jpg`, group: "Featured" },
  { id: "AMENITY_GOLF", name: "Golf", fileName: "golf.jpg", src: `${A}/amenities/golf.jpg`, group: "Lifestyle" },
  { id: "AMENITY_UNIVERSITY", name: "University", fileName: "uni.jpg", src: `${A}/amenities/uni.jpg`, group: "Education" },
  { id: "AMENITY_SCHOOL", name: "School", fileName: "school.jpg", src: `${A}/amenities/school.jpg`, group: "Education" },
  { id: "AMENITY_CULTURE", name: "Culture", fileName: "culture.jpg", src: `${A}/amenities/culture.jpg`, group: "Culture" },
];

export const logoCatalog = [
  { id: "LOGO_GOLD", name: "Saigon Park · Gold", src: "/assets/ui/logo_gold.png", group: "Logo" },
  { id: "LOGO_BLACK", name: "Saigon Park · Black", src: "/assets/ui/logo_black.png", group: "Logo" },
  { id: "LOGO_BLUE", name: "Saigon Park · Blue", src: "/assets/ui/logo_blue.png", group: "Logo" },
  { id: "LOGO_RED", name: "Saigon Park · Red", src: "/assets/ui/logo_red.png", group: "Logo" },
  { id: "LOGO_WHITE", name: "Saigon Park · White", src: "/assets/ui/logo_white.png", group: "Logo" },
  { id: "LOGO_ROSE_GOLD", name: "Saigon Park · Rose Gold", src: "/assets/ui/logo_rose_gold.png", group: "Logo" },
];

export const badgeCatalog = [
  { id: "BADGE_HOT_DEAL", name: "Hot Deal", src: "/assets/ui/badge_hotdeal.png", group: "Primary" },
  { id: "BADGE_VE_O_SOM", name: "Về ở sớm", src: "/assets/ui/badge_veosom.png", group: "Primary" },
];

export const pinAssets = {
  pin3D: "/assets/ui/pin_3d.png",
  pin2D: "/assets/ui/pin_2d.png",
};

export const templateAsset = `${A}/template/template.png`;

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function normalizeAssetKey(value) {
  return stripDiacritics(value)
    .toUpperCase()
    .replace(/\.[A-Z0-9]+$/i, "")
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

export function findCatalogAsset(catalog, value) {
  if (!value) return null;
  const wanted = normalizeAssetKey(value);
  return (
    catalog.find((item) => normalizeAssetKey(item.id) === wanted) ||
    catalog.find((item) => normalizeAssetKey(item.name) === wanted) ||
    catalog.find((item) => normalizeAssetKey(item.fileName) === wanted) ||
    catalog.find((item) => normalizeAssetKey(item.name).includes(wanted) || wanted.includes(normalizeAssetKey(item.name))) ||
    null
  );
}
