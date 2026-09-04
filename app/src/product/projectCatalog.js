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
    proof: ["Developer track record", "Verified project information", "Sales support ecosystem"],
  },
  resources: [
    { name: "Project brochure", status: "Demo resource", description: "Brand story, project overview, highlights and key visuals in one shareable document." },
    { name: "Masterplan", status: "Demo resource", description: "Overall site plan used to understand zones, roads, amenities and project structure." },
    { name: "Floorplans", status: "Demo resource", description: "Typical product layouts, dimensions and product-level planning information." },
    { name: "Sales policy", status: "Demo resource", description: "Commercial policy, payment terms, incentives and eligibility conditions." },
    { name: "Price list", status: "Lead-gated later", description: "Current product pricing and available inventory, suitable for controlled lead access." },
    { name: "Payment schedule", status: "Demo resource", description: "Milestones and timing for deposits, installments and handover payments." },
  ],
  faq: [
    { question: "What is the project positioning?", answer: "Use this answer area to explain the core positioning in plain language, then connect that promise to location, product and lifestyle value." },
    { question: "What product types are available?", answer: "Summarize the main product collections, typical sizes and who each collection is most relevant for. Detailed inventory can live in Overview or a sales resource." },
    { question: "What is the current sales status?", answer: "Explain whether the project is planning, launching, actively selling or nearing handover, and point visitors to the latest verified sales materials." },
    { question: "Which sales resources can a buyer request?", answer: "Typical resources include the brochure, masterplan, floorplans, sales policy, price list and payment schedule. Sensitive files can later require lead submission." },
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

const VINHOMES_SAIGON_PARK_LANDING = {
  positioning: "Thành phố công viên tri thức hàng đầu Châu Á — một đại đô thị sinh thái, giáo dục và trải nghiệm mới tại cửa ngõ Tây Bắc TP.HCM.",
  valuePillars: [
    { index: "01", title: "1,080 ha urban scale", copy: "Quy mô đại đô thị lớn với mật độ xây dựng khoảng 30%, tạo dư địa cho cảnh quan, tiện ích và hệ sinh thái đô thị đồng bộ." },
    { index: "02", title: "Knowledge-city ecosystem", copy: "Định hướng thành phố công viên tri thức với hệ giáo dục, nghiên cứu, vui chơi và thương mại được tổ chức trong một hệ sinh thái all-in-one." },
    { index: "03", title: "Northwest gateway", copy: "Vị trí tại khu Tây Bắc TP.HCM được đặt trong bối cảnh các trục kết nối lớn như Metro số 2, Vành Đai 3 và cao tốc TP.HCM – Mộc Bài." },
  ],
  location: {
    description: "Dự án nằm tại xã Xuân Thới Sơn, khu vực cửa ngõ Tây Bắc TP.HCM. Landing page có thể kể câu chuyện kết nối theo hướng hạ tầng, giáo dục và khả năng tiếp cận các cực đô thị mới.",
    destinations: ["Metro số 2 Bến Thành – Tham Lương", "Cao tốc TP.HCM – Mộc Bài", "Cụm đại học trong nước & quốc tế"],
  },
  products: [
    { name: "Liền kề giãn xây", meta: "Diện tích tham khảo 50–60 m² · 4 tầng · nhóm sản phẩm thấp tầng" },
    { name: "Liền kề tự hoàn thiện", meta: "Sản phẩm thấp tầng · khách hàng chủ động hoàn thiện theo tiêu chuẩn áp dụng" },
    { name: "Liền kề CĐT hoàn thiện", meta: "Sản phẩm thấp tầng · chủ đầu tư hoàn thiện · thông tin chi tiết theo tài liệu bàn giao" },
  ],
  lifestyle: [
    { title: "Knowledge & education", copy: "Cụm trường đại học trong nước và quốc tế khoảng 150 ha cùng hệ thống 36 trường học tạo một narrative giáo dục rất khác biệt cho dự án." },
    { title: "Parks & discovery", copy: "Botanica Park khoảng 27 ha, vườn hoa mái kính và VinWonders tạo lớp trải nghiệm thiên nhiên, giải trí và khám phá cho đại đô thị." },
    { title: "Global community", copy: "Global Village khoảng 19.3 ha và các tiện ích thương mại – ẩm thực giúp lifestyle section kể câu chuyện giao thoa cộng đồng thay vì liệt kê tiện ích." },
  ],
  trust: {
    copy: "Vinhomes là chủ đầu tư dự án. Với wireframe này, phần Trust ưu tiên các dữ kiện có thể kiểm chứng từ Vinhomes Market thay vì dùng claim marketing khó duy trì lâu dài.",
    proof: ["Chủ đầu tư: Vinhomes", "Quy mô 1,080 ha · 5 khu", "Khởi công 2026 · đang xây dựng"],
  },
  resources: [
    { name: "Sales policy — Công viên Tri Thức 1", status: "Official document", description: "Chính sách bán hàng cho quỹ căn thô giãn xây; đây là ví dụ điển hình của resource cần cập nhật theo từng đợt bán." },
    { name: "Sales policy — Công viên Quốc Tế", status: "Official document", description: "Chính sách bán hàng cho quỹ căn thô và hoàn thiện tại Khu Công viên Quốc Tế." },
    { name: "Deposit policy", status: "Official document", description: "Chính sách ký quỹ của Khu Công viên Tri Thức 1, dùng để minh họa nhóm tài liệu giao dịch." },
    { name: "Minimum finishing standard", status: "Official document", description: "Bảng tiêu chuẩn hoàn thiện tối thiểu cho nhà ở thấp tầng, giúp khách hiểu rõ mức bàn giao." },
    { name: "Furniture specification", status: "Official document", description: "Danh mục đồ rời nội thất theo thiết kế; phù hợp để demo nhóm tài liệu sản phẩm/bàn giao." },
    { name: "Handover standard", status: "Verified document", description: "Tiêu chuẩn bàn giao dòng sản phẩm chủ đầu tư hoàn thiện, có thể mở trực tiếp hoặc lead-gate tùy chiến lược." },
  ],
  faq: [
    { question: "Vinhomes Sài Gòn Park có quy mô bao nhiêu?", answer: "Theo Vinhomes Market, dự án có tổng diện tích khoảng 1.080 ha, mật độ xây dựng khoảng 30% và quy mô phát triển gồm 5 khu. Đây là nhóm dữ liệu nên đặt gần đầu landing để khách nắm quy mô rất nhanh." },
    { question: "Dự án được định vị như thế nào?", answer: "Vinhomes Market giới thiệu dự án theo định vị “Thành phố công viên tri thức hàng đầu Châu Á”, kết hợp đô thị sinh thái với giáo dục, nghiên cứu, giải trí và hệ tiện ích all-in-one." },
    { question: "Dự án hiện đang ở giai đoạn nào?", answer: "Thông tin trên Vinhomes Market ghi thời điểm khởi công năm 2026 và tiến độ hiện tại là đang xây dựng. Khi triển khai production, mục này nên lấy từ nguồn dữ liệu có ngày cập nhật rõ ràng." },
    { question: "Khách hàng có thể xem những tài liệu gì?", answer: "Nguồn chính thức hiện có các nhóm tài liệu như chính sách bán hàng, chính sách ký quỹ, tiêu chuẩn hoàn thiện, danh mục nội thất và tiêu chuẩn bàn giao. PlotFlow có thể gom chúng thành một Resource Center dễ xem hơn." },
  ],
};

export const PROJECTS = [
  withLanding({ id: "vinhomes-saigon-park", code: "VSP", name: "Vinhomes Saigon Park", developer: "Vinhomes", location: "Xuân Thới Sơn, TP.HCM", status: "Active", tone: "sage", masterplan: true }, VINHOMES_SAIGON_PARK_LANDING),
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
