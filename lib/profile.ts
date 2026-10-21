// Source of truth for opportunity / event matching. Edit freely.

export const profile = {
  name: "Aluinn",
  university: {
    name: "UCL",
    degree: "BSc History & Philosophy of Science",
    years: "2025-2028/29",
    firstYearAverage: "71-72% (First)",
  },
  aLevels: ["Economics", "History", "Geography", "Music"],
  school: "Reading School",
  work: [
    "Inside Sales Analyst (Bosch design registrations, Salesforce/CRM)",
    "Commercial Finance Assistant (accounting cycle, FX exposure)",
    "Bauer Media commercial intern",
  ],
  insightExperiences: ["Nomura Insider Series (Investment Banking)", "FCA Insight Day"],
  projects: [
    {
      name: "Trim",
      note: "2nd place, SpaceX/Grok Bot Commerce London Hackathon (Tavily API)",
    },
    { name: "NEXUS", note: "Digital-asset portfolio/news/journal platform (founder)" },
    { name: "Kori Club", note: "Drop-based clothing brand on Shopify (founder)" },
  ],
  roles: [
    "UCL Economics & Finance Society, Marketing Executive",
    "Independent music artist / producer",
  ],
  skills: [
    "Excel",
    "Python",
    "SAP",
    "Salesforce",
    "Xero",
    "Google AI Studio",
    "Claude Code",
    "Bloomberg Market Concepts",
  ],
  interests: ["tech", "AI", "crypto", "fashion", "music production", "finance"],
} as const;

export type Profile = typeof profile;

// ---- CV matching ------------------------------------------------------
// Weighted keyword groups used to score listings (0-100). Weights (0-10) and
// keywords are editable in Settings; these are the defaults. Short ALL-CAPS
// keywords (AI, FX, CRM, SAP, VC) match case-sensitively.
export type KeywordGroup = { key: string; label: string; weight: number; keywords: string[] };

export const matchGroups: KeywordGroup[] = [
  {
    key: "finance",
    label: "Finance & markets",
    weight: 9,
    keywords: [
      "commercial finance", "finance", "financial", "FX", "foreign exchange", "accounting", "accounts",
      "banking", "investment bank", "markets", "trading", "equity", "fixed income", "asset management",
      "private equity", "corporate finance", "M&A", "treasury", "Bloomberg", "risk",
      "Nomura", "Goldman Sachs", "J.P. Morgan", "JPMorgan", "Morgan Stanley", "Barclays", "Citi",
      "UBS", "Deutsche Bank", "HSBC", "Lazard", "Rothschild", "Evercore", "BlackRock", "FCA",
    ],
  },
  {
    key: "salesOps",
    label: "Sales, CRM & analysis",
    weight: 6,
    keywords: [
      "Salesforce", "CRM", "sales", "sales operations", "analyst", "business analyst", "operations",
      "SAP", "Xero", "Excel", "data analysis", "insights",
    ],
  },
  {
    key: "techAI",
    label: "Tech & AI",
    weight: 9,
    keywords: [
      "Python", "AI", "artificial intelligence", "machine learning", "LLM", "generative AI", "product",
      "product management", "product analyst", "startup", "scale-up", "hackathon", "Claude Code",
      "software", "data", "fintech", "crypto", "blockchain", "digital assets", "venture capital", "VC",
      "Anthropic", "OpenAI", "DeepMind",
    ],
  },
  {
    key: "marketing",
    label: "Marketing & media",
    weight: 5,
    keywords: [
      "commercial", "content", "brand", "marketing", "media", "social media", "communications",
      "e-commerce", "ecommerce", "Shopify", "fashion", "music", "partnerships",
    ],
  },
  {
    key: "policy",
    label: "Policy & research",
    weight: 7,
    keywords: [
      "government", "policy", "science policy", "public policy", "technology policy", "AI governance",
      "AI safety", "regulation", "regulatory", "research", "think tank", "ethics", "history of science",
      "philosophy",
    ],
  },
];

/** Year of study (1 = first year) in the UCL academic year containing `now`. */
export function studyYear(now = new Date()) {
  const start = 2025;
  const y = now.getFullYear() - start + (now.getMonth() >= 8 ? 1 : 0);
  return Math.max(1, y);
}
