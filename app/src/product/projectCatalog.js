import { createProjectProfile } from "../project/ProjectProfile.js";
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
    profile: createProjectProfile(project.profile),
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
  withLanding({
    id: "vinhomes-saigon-park",
    code: "VSP",
    name: "Vinhomes Saigon Park",
    developer: "Vinhomes",
    location: "Xuân Thới Sơn, TP.HCM",
    status: "Active",
    tone: "sage",
    masterplan: true,
    profile: {
      legacyStorage: true,
      topology: { kind: "low-rise", hierarchy: ["zone", "subzone", "lot"] },
      overview: { configured: true, groups: ["Hoàn thiện", "Giãn xây", "Xây thô"] },
      detail: { template: "sales-poster-v1" },
    },
  }, VINHOMES_SAIGON_PARK_LANDING),
  withLanding({
    id: "la-home-river-park",
    code: "LAHRP",
    name: "LA HOME – RIVER PARK",
    developer: "Prodezi Long An",
    location: "Xã Lương Hòa, Tây Ninh (Bến Lức, Long An cũ)",
    status: "Setup",
    tone: "lake",
    masterplan: false,
    profile: {
      legacyStorage: false,
      topology: { kind: "low-rise", hierarchy: ["zone", "subzone", "lot"] },
      overview: { configured: false, groups: [] },
      detail: { template: "sales-poster-v1" },
    },
  }, {
    positioning: "River Park – phân khu tại khu đô thị sinh thái LA Home, nơi cảnh quan kênh xanh, kết nối cửa ngõ phía Tây TP.HCM và hệ tiện ích nội khu cùng tạo nên nhịp sống cân bằng.",
    valuePillars: [
      { index: "01", title: "Kết nối cửa ngõ phía Tây", copy: "Mặt tiền đại lộ Lương Hòa – Bình Chánh, lộ giới 60m, trong mạng lưới kết nối các tuyến cao tốc và vành đai vùng." },
      { index: "02", title: "Cảnh quan ven kênh", copy: "River Park gắn với hệ kênh xanh, công viên trung tâm và các không gian đi bộ, thư giãn ven mặt nước." },
      { index: "03", title: "Đô thị tích hợp", copy: "Thừa hưởng quy hoạch tổng thể LA Home khoảng 100ha và vị trí liền kề khu công nghiệp sinh thái Prodezi quy mô 400ha." },
    ],
    location: {
      description: "Phân khu River Park thuộc LA Home, trên đại lộ Lương Hòa – Bình Chánh tại xã Lương Hòa, tỉnh Tây Ninh (khu vực Bến Lức, Long An trước sáp nhập). Vị trí được chủ đầu tư giới thiệu trong liên kết hạ tầng cửa ngõ phía Tây TP.HCM. Thời gian di chuyển trong tài liệu là ước tính tham khảo, không bảo đảm cho mọi hành trình.",
      destinations: ["Bình Chánh – kết nối cửa ngõ TP.HCM", "Cao tốc TP.HCM – Trung Lương", "Cao tốc Bến Lức – Long Thành và hệ thống Vành đai 3, 4"],
    },
    products: [
      { name: "Nhà phố liền kề", meta: "Các mẫu nhà phố nội khu, bao gồm dòng hai mặt tiền và dòng mặt tiền ngang 5–6m; thông số theo bảng hàng." },
      { name: "Nhà phố thương mại", meta: "Sản phẩm dọc trục thương mại, với các vị trí được giới thiệu ở lộ giới 18m và 60m." },
      { name: "Biệt thự & Shop villa", meta: "Các dòng sản phẩm biệt thự song lập và biệt thự thương mại; vị trí và diện tích theo sơ đồ/bảng hàng chính thức." },
    ],
    lifestyle: [
      { title: "Công viên và mặt nước", copy: "Công viên trung tâm, công viên nội khu cùng cảnh quan ven kênh góp phần hình thành môi trường sống gần thiên nhiên." },
      { title: "Giáo dục và vận động", copy: "Định hướng trường học liên cấp và trung tâm thể dục thể thao đa năng trong hệ tiện ích của phân khu." },
      { title: "Thương mại và cộng đồng", copy: "Phố thương mại Thịnh Vượng, không gian dạo bộ và khu thương mại tạo điểm gặp gỡ, sinh hoạt thường nhật." },
    ],
    trust: {
      copy: "Chủ đầu tư là Công ty Cổ phần Prodezi Long An; đơn vị phát triển là Hướng Việt Holdings (HVH). River Park được giới thiệu ngày 03/06/2025, sau phân khu LA Sol. Nội dung tham khảo từ website chính thức LA Home, không thay thế hồ sơ pháp lý, bảng giá hoặc hợp đồng mua bán.",
      proof: ["Chủ đầu tư: Prodezi Long An", "Phát triển: Hướng Việt Holdings", "Nguồn: lahome.com.vn"],
    },
    resources: [
      { name: "Mặt bằng River Park – PDF A3", status: "Drive · PDF 70,5 MB", description: "Nguồn mặt bằng do chủ workspace cung cấp; chờ nhập và cấu hình thành Overview tương tác.", url: "https://drive.google.com/file/d/1NLgYaknfNY_QOQS2Qj84VExUEM9Ahy3x/view" },
      { name: "Mặt bằng River Park – PNG", status: "Drive · PNG", description: "Ảnh mặt bằng A3 để đối chiếu với bản PDF.", url: "https://drive.google.com/file/d/1xPd9tAfwICP4ZTojCvTRYcv1QWR9qiq7/view" },
      { name: "River Park – giới thiệu chính thức", status: "LA Home · Official", description: "Thông tin vị trí, tiện ích, phân khu, sản phẩm và đối tác.", url: "https://lahome.com.vn/riverpark/" },
      { name: "LA Home – website chủ đầu tư", status: "LA Home · Official", description: "Tổng quan khu đô thị sinh thái LA Home, tài liệu và thông tin liên hệ.", url: "https://lahome.com.vn/" },
      { name: "Bảng hàng và giá River Park", status: "Chưa cung cấp", description: "Chờ file bảng hàng chính thức để liên kết từng mã căn với Detail." },
    ],
    faq: [
      { question: "River Park là dự án riêng hay một phân khu?", answer: "River Park là một phân khu thuộc khu đô thị sinh thái LA Home. Quy mô khoảng 100ha là của toàn LA Home, không phải riêng River Park." },
      { question: "Ai là chủ đầu tư và đơn vị phát triển?", answer: "Chủ đầu tư: Công ty Cổ phần Prodezi Long An. Đơn vị phát triển: Hướng Việt Holdings (HVH), theo thông tin công bố của LA Home." },
      { question: "River Park có các loại hình sản phẩm nào?", answer: "Trang chính thức giới thiệu các nhóm nhà phố liền kề, nhà phố thương mại, biệt thự song lập và shop villa. Chi tiết từng căn phải xác nhận theo bảng hàng cập nhật." },
      { question: "Đã có thể xem mặt bằng từng căn trên PlotFlow chưa?", answer: "Đã nhận liên kết PDF mặt bằng A3 từ Drive. Overview tương tác và dữ liệu chi tiết từng căn sẽ được cấu hình sau khi nhập và kiểm tra nguồn mặt bằng, bảng hàng tương ứng." },
    ],
  }),
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
