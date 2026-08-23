const DEFAULT_LANDING = {
  positioning: "Project positioning statement goes here — one clear promise designed to make the right buyer want to keep exploring.",
  valuePillars: [
    { index: "01", title: "Positioning", copy: "Define the single reason this project deserves attention." },
    { index: "02", title: "Location value", copy: "Translate location and connectivity into a clear buyer benefit." },
    { index: "03", title: "Product value", copy: "Frame the product mix, lifestyle and ownership proposition." },
  ],
  location: {
    description: "Use this section to explain where the project sits, what it connects to, and why that matters in daily life or long-term value.",
    destinations: ["Key destination", "Key destination", "Key destination"],
  },
  products: [
    { name: "Collection A", meta: "Typology · Area range · Bedroom / frontage · Pricing cue" },
    { name: "Collection B", meta: "Typology · Area range · Bedroom / frontage · Pricing cue" },
    { name: "Collection C", meta: "Typology · Area range · Bedroom / frontage · Pricing cue" },
  ],
  lifestyle: [
    { title: "Everyday living", copy: "A short narrative about how this part of the project improves everyday life." },
    { title: "Landscape & wellness", copy: "A short narrative about how this part of the project improves everyday life." },
    { title: "Commerce & community", copy: "A short narrative about how this part of the project improves everyday life." },
  ],
  trust: {
    copy: "Developer story, track record, legal confidence, awards or delivery proof can be introduced here without turning the page into a corporate profile.",
    proof: ["Proof point", "Proof point", "Proof point"],
  },
  resources: [
    { name: "Project brochure", status: "Placeholder" },
    { name: "Masterplan", status: "Placeholder" },
    { name: "Floorplans", status: "Placeholder" },
    { name: "Sales policy", status: "Placeholder" },
    { name: "Price list", status: "Placeholder" },
    { name: "Payment schedule", status: "Placeholder" },
  ],
  faq: [
    "What is the project positioning?",
    "What product types are available?",
    "What is the current sales status?",
    "Which sales resources can a buyer request?",
  ],
};

function withLanding(project, landing = {}) {
  return {
    ...project,
    landing: {
      ...DEFAULT_LANDING,
      ...landing,
      location: { ...DEFAULT_LANDING.location, ...(landing.location || {}) },
      trust: { ...DEFAULT_LANDING.trust, ...(landing.trust || {}) },
    },
  };
}

export const PROJECTS = [
  withLanding({ id: "vinhomes-saigon-park", code: "VSP", name: "Vinhomes Saigon Park", developer: "Vinhomes", location: "Hóc Môn, TP.HCM", status: "Active", tone: "sage", masterplan: true }),
  withLanding({ id: "vinhomes-green-paradise", code: "VGP", name: "Vinhomes Green Paradise", developer: "Vinhomes", location: "Cần Giờ, TP.HCM", status: "Active", tone: "sea" }),
  withLanding({ id: "vinhomes-grand-park", code: "VGP2", name: "Vinhomes Grand Park", developer: "Vinhomes", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "sky" }),
  withLanding({ id: "the-global-city", code: "TGC", name: "The Global City", developer: "Masterise Homes", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "sand" }),
  withLanding({ id: "lumiere-riverside", code: "LR", name: "Lumière Riverside", developer: "Masterise Homes", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "mist" }),
  withLanding({ id: "eaton-park", code: "EP", name: "Eaton Park", developer: "Gamuda Land", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "olive" }),
  withLanding({ id: "akari-city", code: "AC", name: "Akari City", developer: "Nam Long", location: "Bình Tân, TP.HCM", status: "Active", tone: "peach" }),
  withLanding({ id: "waterpoint", code: "WP", name: "Waterpoint", developer: "Nam Long", location: "Long An", status: "Active", tone: "lake" }),
  withLanding({ id: "celesta-rise", code: "CR", name: "Celesta Rise", developer: "Keppel Land", location: "Nhà Bè, TP.HCM", status: "Active", tone: "stone" }),
  withLanding({ id: "gladia-by-the-waters", code: "GW", name: "Gladia by the Waters", developer: "Khang Điền", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "mint" }),
  withLanding({ id: "metropole-thu-thiem", code: "MTT", name: "The Metropole Thủ Thiêm", developer: "SonKim Land", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "clay" }),
  withLanding({ id: "eco-retreat", code: "ER", name: "Eco Retreat", developer: "Ecopark", location: "Long An", status: "Planning", tone: "forest" }),
];

export function getProjectById(id) {
  return PROJECTS.find((project) => project.id === id) || null;
}
