export interface FabSource {
  id: string;
  name: string;
  url: string;
  type: "rss" | "html" | "json";
  category: "listing" | "expansion" | "both";
  priority: "high" | "medium" | "low";
}

export const SOURCES: FabSource[] = [

  // ── TIER 1: Direct facility listing / disposition sources ─────────────────
  // These are the highest signal sources — actual fab listings and auctions
  {
    id: "atreg_newsletter",
    name: "ATREG Semiconductor Transactions Newsletter",
    url: "https://atreg.com/newsletters/",
    type: "html",
    category: "listing",
    priority: "high",
  },
  {
    id: "heritage_global",
    name: "Heritage Global Partners — Semiconductor Auctions",
    url: "https://www.hgpauction.com/search/?q=semiconductor+fab+cleanroom",
    type: "html",
    category: "listing",
    priority: "high",
  },
  {
    id: "moov_fab",
    name: "Moov Technologies — Used Semiconductor Equipment",
    url: "https://moov.co/categories/semiconductor-equipment",
    type: "html",
    category: "listing",
    priority: "high",
  },
  {
    id: "equipnet",
    name: "EquipNet — Semiconductor Equipment Marketplace",
    url: "https://www.equipnet.com/used-equipment/semiconductor-equipment/",
    type: "html",
    category: "listing",
    priority: "medium",
  },
  {
    id: "la_semi_case",
    name: "LA Semiconductor — CourtListener Docket 5:24-cv-02215",
    url: "https://www.courtlistener.com/docket/68649684/semiconductor-components-industries-llc-v-la-semiconductor-llc/",
    type: "html",
    category: "listing",
    priority: "high",
  },
  {
    id: "idaho_dol_warn",
    name: "Idaho DOL — WARN Notices",
    url: "https://www.labor.idaho.gov/dnn/Businesses/WARN-Act-Notices",
    type: "html",
    category: "listing",
    priority: "high",
  },

  // ── TIER 2: CHIPS Act / government expansion sources ──────────────────────
  {
    id: "chips_program_office",
    name: "CHIPS Program Office — Awards and Updates",
    url: "https://www.nist.gov/semiconductors/chips-program-news-and-updates",
    type: "html",
    category: "expansion",
    priority: "high",
  },
  {
    id: "commerce_chips",
    name: "Commerce Department — CHIPS Act Announcements",
    url: "https://www.commerce.gov/tags/chips-and-science-act",
    type: "html",
    category: "expansion",
    priority: "high",
  },
  {
    id: "doe_manufacturing",
    name: "DOE — Advanced Manufacturing Announcements",
    url: "https://www.energy.gov/eere/articles/advanced-manufacturing",
    type: "html",
    category: "expansion",
    priority: "medium",
  },

  // ── TIER 3: Industry trade press — targeted, low noise ────────────────────
  {
    id: "semi_org",
    name: "SEMI.org — Semiconductor Industry Press Releases",
    url: "https://www.semi.org/en/blogs/press-releases",
    type: "html",
    category: "both",
    priority: "high",
  },
  {
    id: "semi_equipment_forecast",
    name: "SEMI.org — Equipment Market Data",
    url: "https://www.semi.org/en/products-services/market-data/sems",
    type: "html",
    category: "expansion",
    priority: "medium",
  },
  {
    id: "sia_press",
    name: "Semiconductor Industry Association — Press Releases",
    url: "https://www.semiconductors.org/category/press-releases/",
    type: "html",
    category: "both",
    priority: "high",
  },
  {
    id: "semianalysis",
    name: "SemiAnalysis — Fab Economics",
    url: "https://www.semianalysis.com/feed",
    type: "rss",
    category: "both",
    priority: "medium",
  },
  {
    id: "semiconductor_digest",
    name: "Semiconductor Digest RSS",
    url: "https://www.semiconductor-digest.com/feed/",
    type: "rss",
    category: "both",
    priority: "low",
  },

  // ── TIER 4: Regional / company-specific ───────────────────────────────────
  {
    id: "east_idaho_news",
    name: "East Idaho News — Semiconductor / Pocatello",
    url: "https://www.eastidahonews.com/?s=semiconductor+fab",
    type: "html",
    category: "listing",
    priority: "high",
  },
  {
    id: "idaho_business_review",
    name: "Idaho Business Review — Manufacturing",
    url: "https://idahobusinessreview.com/category/manufacturing/",
    type: "html",
    category: "both",
    priority: "medium",
  },
  {
    id: "skywater_news",
    name: "SkyWater Technology — News",
    url: "https://www.skywatertechnology.com/news/",
    type: "html",
    category: "both",
    priority: "high",
  },
];
