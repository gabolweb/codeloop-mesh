import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const DOCS = path.join(ROOT, "docs");
const DATA = path.join(DOCS, "data");
const BRANDING = path.join(DOCS, "branding");
const OUT = path.join(DATA, "canonical");
const GENERATED_AT = new Date().toISOString();

const FINAL_BRAND_FOLDERS = {
  ecosystem: "01 — CodeLoop Ecosystem",
  cosmos: "02 — Cosmos",
  mainland: "03 — Mainland",
  bastion: "04 — Bastion",
  remotica: "05 — Remotica",
  remotez: "06 — RemoteZ",
  cacti: "07 — Cacti",
  utu: "08 — UTU",
  visionnaire: "09 — Visionnaire",
};

const SOURCE_PRIORITY = [
  "docs/master.md",
  "docs/padpod_documentacao.docx.md",
  "docs/branding/00 — Cross-Brand System/*",
  "docs/branding/{brand}/01 — Brand Bible.md",
  "docs/branding/{brand}/02 — Site Blueprint.md",
  "docs/data/index/codeloop-brands/data/brands.js",
  "docs/data/{slug}/config.json",
  "docs/data/{slug}/worktree.json",
  "docs/data/{slug}/gaps.json",
  "docs/data/{slug}/assets/logos/*",
  "docs/data/audit/knowledge-index.json",
  "docs/data/audit/enrichment-preview/{slug}.json",
];

const COMMON_PROTOCOLS = [
  {
    id: "protocol-gap-review",
    name: "Gap review workflow",
    status: "active",
    steps: [
      "Detect missing or weak field",
      "Generate governed draft",
      "Review against brand sources",
      "Approve for publishing",
    ],
  },
  {
    id: "protocol-padpod-context",
    name: "PAD/POD context isolation",
    status: "active",
    steps: [
      "Treat PAD as the portable content and behavior payload",
      "Treat POD as the component that operates the PAD",
      "Expose only section-local PAD data to the POD",
      "Use public/private field metadata for propagation decisions",
    ],
  },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function exists(file) {
  return fs.existsSync(file);
}

function rel(file) {
  return path.relative(ROOT, file);
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compact(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null && item !== "");
  return value;
}

function firstSentence(text) {
  if (!text) return "";
  const cleaned = String(text).replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(.{20,240}?[.!?])(\s|$)/);
  return match ? match[1] : cleaned.slice(0, 240);
}

function words(text) {
  return String(text || "")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function titleCaseFromSlug(slug) {
  return String(slug)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pathToPageSlug(brandSlug, pagePath) {
  if (pagePath === "/") return `page-${brandSlug}-root`;
  return `page-${brandSlug}-${slugify(pagePath)}`;
}

function loadBrandsJs() {
  const file = path.join(DATA, "index", "codeloop-brands", "data", "brands.js");
  if (!exists(file)) return {};
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window.BRANDS || {};
}

function loadRegistryDomains() {
  const file = path.join(DATA, "registry.json");
  if (!exists(file)) return {};
  const registry = readJson(file);
  const map = {};
  for (const site of registry.sites || []) {
    map[site.slug] = site.domains || [];
  }
  return map;
}

function loadKnowledgeIndex() {
  const file = path.join(DATA, "audit", "knowledge-index.json");
  if (!exists(file)) return { stats: {}, coverage: {}, files: [] };
  return readJson(file);
}

function loadCrossBrandSources() {
  const dir = path.join(BRANDING, "00 — Cross-Brand System");
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => rel(path.join(dir, name)));
}

function loadBranding(slug) {
  const folder = FINAL_BRAND_FOLDERS[slug];
  if (!folder) return null;
  const dir = path.join(BRANDING, folder);
  const bible = path.join(dir, "01 — Brand Bible.md");
  const blueprint = path.join(dir, "02 — Site Blueprint.md");
  if (!exists(bible) || !exists(blueprint)) return null;
  return {
    folder: rel(dir),
    bible: { path: rel(bible), text: fs.readFileSync(bible, "utf8") },
    blueprint: { path: rel(blueprint), text: fs.readFileSync(blueprint, "utf8") },
  };
}

function extractSection(markdown, headingPattern) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start < 0) return "";
  const level = (lines[start].match(/^#+/) || [""])[0].length;
  const collected = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const nextHeading = line.match(/^(#+)\s+/);
    if (nextHeading && nextHeading[1].length <= level) break;
    collected.push(line);
  }
  return collected.join("\n").trim();
}

function extractAtAGlance(markdown) {
  const section = extractSection(markdown, /^##\s+1\.\s+Brand at a Glance/i);
  const data = {};
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
    if (!match) continue;
    const key = slugify(match[1]).replace(/-/g, "_");
    const value = match[2].trim();
    if (!key || key === "field" || /^-+$/.test(value)) continue;
    data[key] = value;
  }
  return data;
}

function extractBullets(markdown, headingPattern) {
  const section = extractSection(markdown, headingPattern);
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .slice(0, 12);
}

function extractPaletteFromMarkdown(markdown) {
  const section = extractSection(markdown, /^###\s+Palette/i);
  const colors = {};
  for (const line of section.split(/\r?\n/)) {
    const hex = line.match(/#[0-9a-fA-F]{6}/);
    if (!hex) continue;
    const label = slugify(line.split(hex[0])[0]).replace(/-/g, "_") || `color_${Object.keys(colors).length + 1}`;
    colors[label] = hex[0].toUpperCase();
  }
  return colors;
}

function buildSourceManifest(slug, configFile, worktreeFile, gapsFile, branding, coverage, assets) {
  const sources = [
    { type: "schema", path: "docs/master.md", priority: 1 },
    { type: "architecture", path: "docs/padpod_documentacao.docx.md", priority: 1 },
    ...loadCrossBrandSources().map((sourcePath) => ({ type: "cross_brand", path: sourcePath, priority: 2 })),
  ];
  if (branding) {
    sources.push({ type: "brand_bible", path: branding.bible.path, priority: 3 });
    sources.push({ type: "site_blueprint", path: branding.blueprint.path, priority: 3 });
  }
  sources.push({ type: "brand_tokens", path: "docs/data/index/codeloop-brands/data/brands.js", priority: 4 });
  sources.push({ type: "config", path: rel(configFile), priority: 5 });
  sources.push({ type: "worktree", path: rel(worktreeFile), priority: 5 });
  sources.push({ type: "gaps", path: rel(gapsFile), priority: 5 });
  for (const asset of assets) sources.push({ type: "asset", path: asset.url, priority: 5 });
  sources.push({ type: "knowledge_index", path: "docs/data/audit/knowledge-index.json", priority: 6 });
  const preview = path.join(DATA, "audit", "enrichment-preview", `${slug}.json`);
  if (exists(preview)) sources.push({ type: "enrichment_preview", path: rel(preview), priority: 6 });
  return {
    priority_order: SOURCE_PRIORITY,
    kb_coverage: coverage,
    sources,
  };
}

function inferType(slug, config) {
  if (slug === "ecosystem") return "ecosystem";
  if (slug.includes("holding") || slug === "royalorbit") return "company";
  if (slug.includes("foundation") || config.site?.toLowerCase().includes("foundation")) return "community";
  if (["mainland", "bastion", "remotica", "remotez", "cacti", "utu", "visionnaire", "cosmos"].includes(slug)) return "brand";
  return "company";
}

function inferOrganization(slug, domain) {
  if (slug.startsWith("karon")) return "Karon";
  if (slug.startsWith("royalorbit")) return "Royal Orbit";
  if (domain?.includes("royalorbit.com")) return "Royal Orbit";
  return "CodeLoop";
}

function confidenceFor(slug, coverage, branding) {
  if (branding) return "high";
  if (coverage === "high") return "high";
  if (coverage === "medium") return "medium";
  if (coverage === "none") return "low";
  return "medium";
}

function reviewRequiredFor(state, coverage) {
  if (state === "generated" || coverage === "none") return true;
  return false;
}

function buildFieldMeta({ state, confidence, sourceRefs, reason, coverage, propagated = "public" }) {
  return {
    state,
    confidence,
    source_refs: sourceRefs,
    generation_reason: reason,
    review_required: reviewRequiredFor(state, coverage),
    visibility: propagated,
  };
}

function normalizeTheme(config, brandJs, branding) {
  const palette = {};
  const configPalette = config.theme?.palette || {};
  for (const [key, value] of Object.entries(configPalette)) {
    palette[snake(key)] = value;
  }
  if (brandJs?.colors) {
    for (const [key, value] of Object.entries(brandJs.colors)) palette[snake(key)] = value;
  }
  const markdownPalette = branding ? extractPaletteFromMarkdown(branding.bible.text) : {};
  for (const [key, value] of Object.entries(markdownPalette)) palette[key] = value;

  const fonts = {
    heading: brandJs?.fonts?.display || config.fonts?.heading || config.fonts?.display || "Inter Tight",
    body: brandJs?.fonts?.text || config.fonts?.body || "Inter",
    display: brandJs?.fonts?.display || config.fonts?.display || config.fonts?.heading || "Inter Tight",
    mono: config.fonts?.mono || (brandJs?.fonts?.text === "JetBrains Mono" ? "JetBrains Mono" : "Inter"),
    google_fonts_url: config.fonts?.google_fonts_url || (brandJs?.fontGoogle ? `https://fonts.googleapis.com/css2?${brandJs.fontGoogle}` : null),
  };

  return {
    identity_id: `identity-${config.slug}`,
    theme: {
      mode: brandJs?.style === "dark" ? "dark" : "light",
      variant: config.theme?.variant || "gradient-vibrant",
      palette,
      scale: brandJs?.scale || [],
      semantics: brandJs?.semantics || {},
    },
    typography: fonts,
    layout: {
      container_max_width: "1200px",
      grid_columns: 12,
      spacing_scale: [4, 8, 12, 16, 24, 32, 48, 64, 96],
      radius_scale: {
        sm: `${brandJs?.radii?.sm ?? 4}px`,
        md: `${brandJs?.radii?.md ?? 8}px`,
        lg: `${brandJs?.radii?.lg ?? 16}px`,
        xl: `${brandJs?.radii?.xl ?? 32}px`,
      },
    },
    motion: {
      default_duration: 0.8,
      easing: "power3.out",
      library: "gsap",
      reduced_motion_fallback: true,
      brand_art_type: brandJs?.artType || null,
    },
  };
}

function snake(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, "");
}

function collectAssets(slug) {
  const dir = path.join(DATA, slug, "assets", "logos");
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /\.(png|svg|webp|jpg|jpeg)$/i.test(name))
    .sort()
    .map((name, index) => {
      const file = path.join(dir, name);
      const type = name.includes(slug) ? "primary" : "secondary";
      return {
        id: `asset-${slug}-logo-${index + 1}`,
        type,
        format: path.extname(name).slice(1).toLowerCase(),
        url: rel(file),
        width: null,
        height: null,
        background: "transparent",
        usage: index === 0 ? ["website_header", "footer", "social_profile"] : ["brand_library"],
        alt: `${titleCaseFromSlug(slug)} logo`,
      };
    });
}

function buildBrandCore(slug, config, brandJs, branding, coverage, sourceRefs) {
  const glance = branding ? extractAtAGlance(branding.bible.text) : {};
  const manifesto = branding ? extractSection(branding.bible.text, /^##\s+3\.\s+Manifesto/i) : "";
  const positioning = branding ? extractSection(branding.bible.text, /^##\s+2\.\s+Positioning Statement/i) : "";
  const values = extractBullets(branding?.bible.text || "", /^##\s+11\.\s+Operating Principles/i).map((item, index) => ({
    id: `value-${slug}-${index + 1}`,
    title: item.split(/[.:]/)[0].replace(/\*\*/g, "").trim().slice(0, 80),
    description: item.replace(/\*\*/g, "").trim(),
  }));
  const fallbackValues = [
    {
      id: `value-${slug}-1`,
      title: "Operational clarity",
      description: `${config.site} should make decisions, ownership, and next actions legible across the identity.`,
    },
    {
      id: `value-${slug}-2`,
      title: "Governed originality",
      description: "Every strong claim must remain traceable to source material, confidence, and review status.",
    },
    {
      id: `value-${slug}-3`,
      title: "Portable execution",
      description: "Every web section is structured as a reusable PAD/POD unit that can move across surfaces.",
    },
  ];

  const tagline = brandJs?.tagline || glance.tagline || config.metadata?.description || `${config.site} digital identity`;
  const shortDescription = firstSentence(brandJs?.positioning || config.metadata?.description || config.footer?.description || tagline);
  const longDescription =
    firstSentence(positioning) ||
    brandJs?.positioning ||
    config.footer?.description ||
    `${config.site} is serialized as a governed digital identity with web, brand, content, SEO, assets, and ownership layers.`;

  return {
    identity_id: `identity-${slug}`,
    brand_name: config.site,
    tagline,
    short_description: shortDescription,
    long_description: longDescription,
    mission: glance.mission || firstSentence(extractSection(branding?.bible.text || "", /^##\s+\d+\.\s+Mission/i)) || generatedMission(config, brandJs),
    vision: glance.vision || null,
    values: values.length ? values : fallbackValues,
    positioning: {
      category: brandJs?.subtitle || glance.category || inferType(slug, config),
      market: brandJs?.endeavor || glance.market || "Digital identity and web operating infrastructure",
      statement: firstSentence(positioning) || brandJs?.positioning || null,
      differentiators: compact([brandJs?.value, brandJs?.method, brandJs?.archetype]),
      competitors: [],
      anti_positioning: extractBullets(branding?.bible.text || "", /^###\s+Banned/i),
    },
    narrative: {
      origin_story: firstSentence(extractSection(branding?.bible.text || "", /^##\s+4\./i)),
      founder_message: null,
      manifesto: manifesto || null,
      elevator_pitch: `${config.site}: ${tagline}`,
      one_liner: brandJs?.hero || tagline,
    },
    source_meta: buildFieldMeta({
      state: branding || brandJs ? "source" : "generated",
      confidence: confidenceFor(slug, coverage, branding),
      sourceRefs,
      reason: branding ? "brand bible and site blueprint mapped into master brand_core" : "fallback identity synthesis from config, worktree, and available brand tokens",
      coverage,
    }),
  };
}

function generatedMission(config, brandJs) {
  if (brandJs?.value && brandJs?.method) {
    return `To turn ${stripTerminalPunctuation(brandJs.value).toLowerCase()} into an operating system through ${stripTerminalPunctuation(brandJs.method)}.`;
  }
  return `To make ${config.site} a governed, traceable, and expressive digital identity across web, content, assets, and operations.`;
}

function stripTerminalPunctuation(value) {
  return String(value || "").trim().replace(/[.!?]+$/g, "");
}

function buildBrandVoice(slug, config, brandJs, branding, coverage, sourceRefs) {
  const voicePrinciples = extractBullets(branding?.bible.text || "", /^###\s+Voice principles/i);
  const banned = extractBullets(branding?.bible.text || "", /^###\s+Banned/i);
  const lexicon = extractBullets(branding?.bible.text || "", /^##\s+8\.\s+Lexicon/i);
  const mood = brandJs?.mood || [];
  return {
    identity_id: `identity-${slug}`,
    language_default: "en-US",
    supported_languages: ["en-US", "pt-BR", "es-ES"],
    tone: {
      primary: mood[0]?.toLowerCase() || "institutional",
      secondary: mood[1]?.toLowerCase() || "strategic",
      avoid: compact([...banned, "empty hype", "untraceable claims"]).slice(0, 12),
    },
    style: {
      sentence_length: "medium",
      technical_depth: ["cosmos", "bastion", "mainland"].includes(slug) ? "high" : "medium",
      formality: "premium",
      emotional_intensity: "controlled",
    },
    vocabulary: {
      preferred_terms: compact(["Dynamic Work", "Augmented Intelligence", brandJs?.venture, brandJs?.initiative, ...lexicon]).slice(0, 24),
      blocked_terms: compact(["cheap", "generic", ...banned]).slice(0, 16),
      canonical_terms: {
        AI: "Augmented Intelligence",
        workers: "Loopers",
        companies: "Partners",
        initiative: "Endeavor",
      },
    },
    copy_rules: {
      cta_style: "action-oriented",
      headline_style: "specific, concrete, and brand-modulated",
      description_style: "clear, strategic, concrete, source-traceable",
      voice_principles: voicePrinciples,
    },
    source_meta: buildFieldMeta({
      state: branding || brandJs ? "source" : "generated",
      confidence: confidenceFor(slug, coverage, branding),
      sourceRefs,
      reason: "voice rails inherited from cross-brand rules and modulated by available brand sources",
      coverage,
    }),
  };
}

function buildDomains(slug, config, registryDomains) {
  const allDomains = Array.from(new Set(compact([config.domain, ...(registryDomains[slug] || [])])));
  return {
    identity_id: `identity-${slug}`,
    domains: allDomains.map((domain, index) => ({
      domain,
      type: index === 0 ? "primary" : domain.includes("test") || domain === "localhost" ? "staging" : "secondary",
      status: domain.includes("test") || domain === "localhost" ? "pending" : "active",
      registrar: null,
      dns_provider: null,
      hosting_provider: null,
      ssl: {
        enabled: !domain.includes("test") && domain !== "localhost",
        issuer: null,
        expires_at: null,
        auto_renew: true,
        status: !domain.includes("test") && domain !== "localhost" ? "unknown" : "not_applicable",
      },
      dns_records: [],
      ownership: {
        owner_email: null,
        admin_workspace: null,
        recovery_email: null,
        shared_admin_account: null,
      },
    })),
  };
}

function buildNavigation(config) {
  return {
    website_id: `website-${config.slug}`,
    brand_label: config.nav?.brand || config.site,
    items: (config.nav?.items || []).map((item, index) => ({
      label: item.label,
      href: item.href,
      type: item.href?.startsWith("http") ? "external" : "internal",
      visibility: "public",
      order: index + 1,
      children: [],
    })),
    cta: {
      label: config.nav?.cta_label || "Get Started",
      href: config.nav?.cta_href || "/",
      variant: "primary",
      tracking_event: "nav_cta_clicked",
    },
  };
}

function buildFooter(config) {
  return {
    website_id: `website-${config.slug}`,
    brand: config.footer?.brand || config.site,
    description: config.footer?.description || config.metadata?.description || null,
    columns: [
      {
        title: "Links",
        links: config.footer?.links || [],
      },
      {
        title: "Resources",
        links: config.footer?.resources || [],
      },
    ],
    social: (config.footer?.social || []).map((item) => ({
      ...item,
      platform: slugify(item.label),
    })),
    legal_links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  };
}

function buildSeo(slug, config, pages) {
  const base = config.metadata?.url || `https://${config.domain}`;
  return {
    profile: {
      identity_id: `identity-${slug}`,
      canonical_base_url: base,
      default_title: config.metadata?.title || config.site,
      default_description: config.metadata?.description || null,
      default_og_image: config.metadata?.og_image || "/opengraph-image",
      robots: "index,follow",
      llms_txt: `/${slug}/llms.txt`,
    },
    page_seo: pages.map((page) => ({
      page_id: page.id,
      title: page.title,
      description: page.sections[0]?.content?.subheadline || page.sections[0]?.content?.description || config.metadata?.description || null,
      canonical: `${base.replace(/\/$/, "")}${page.path === "/" ? "" : page.path}`,
      og_image: config.metadata?.og_image || "/opengraph-image",
    })),
  };
}

function splitPad(pad = {}) {
  const content = {};
  const design = {};
  const motion = {};
  const extras = {};
  for (const [key, value] of Object.entries(pad)) {
    if (key === "_pin") motion.pin = value;
    else if (key === "_animation") motion.animation = value;
    else if (key === "_bridge") motion.bridge = value;
    else if (key === "_layout") design.layout = value;
    else if (key.startsWith("_")) extras[key.slice(1)] = value;
    else content[key] = value;
  }
  return { content, design, motion, extras };
}

function buildGeneratedValue(field, gap, config, brandJs) {
  const brand = config.site;
  const headline = gap.headline || titleCaseFromSlug(gap.section_id || field);
  const tagline = brandJs?.tagline || config.metadata?.description || `${brand} digital identity`;
  const value = brandJs?.value || "governed digital presence";
  const method = brandJs?.method || "structured PAD/POD execution";
  if (field === "subtitle") {
    return `${headline} becomes a focused operating layer for ${brand}.`;
  }
  if (field === "description" || field === "body") {
    return `${headline} translates ${tagline} into a concrete web surface: clear context in the PAD, deliberate action in the POD, and enough traceability for teams to review, reuse, and publish with confidence.`;
  }
  if (field === "mission") {
    return generatedMission(config, brandJs);
  }
  if (["features", "items", "highlights", "values"].includes(field)) {
    const itemName = field === "values" ? "value" : "item";
    return [
      {
        id: `${slugify(headline)}-${itemName}-1`,
        title: "Context with ownership",
        description: `${brand} keeps the source, confidence, and review state visible before content becomes public.`,
      },
      {
        id: `${slugify(headline)}-${itemName}-2`,
        title: "Distinct operating voice",
        description: `${value} is expressed with language, structure, and interaction patterns specific to this identity.`,
      },
      {
        id: `${slugify(headline)}-${itemName}-3`,
        title: "Portable PAD/POD blocks",
        description: `${method} makes this section reusable across websites, documents, emails, and managed knowledge bases.`,
      },
    ];
  }
  return `${headline} requires reviewed ${field} content for ${brand}.`;
}

function buildPages(slug, config, worktree, gaps, coverage, sourceRefs, brandJs, branding) {
  const gapMap = new Map();
  for (const gap of gaps.gaps || []) {
    const key = `${gap.page}::${gap.section_id}`;
    if (!gapMap.has(key)) gapMap.set(key, []);
    gapMap.get(key).push(gap);
  }
  const baseConfidence = confidenceFor(slug, coverage, branding);
  const generatedFills = [];
  const pages = (worktree.pages || []).map((page, pageIndex) => {
    const pageId = pathToPageSlug(slug, page.path);
    const sections = (page.sections || []).map((section, sectionIndex) => {
      const { content, design, motion, extras } = splitPad(section.pad || {});
      const fieldMeta = {};
      for (const field of Object.keys(content)) {
        fieldMeta[field] = buildFieldMeta({
          state: "source",
          confidence: baseConfidence,
          sourceRefs: [rel(path.join(DATA, slug, "worktree.json"))],
          reason: `field present in source worktree pad for ${page.path}#${section.id}`,
          coverage,
        });
      }
      const sectionGaps = gapMap.get(`${page.path}::${section.id}`) || [];
      for (const gap of sectionGaps) {
        if (content[gap.field] === undefined || gap.reason === "source_language_portuguese" || gap.reason === "insufficient_content") {
          const generated = buildGeneratedValue(gap.field, gap, config, brandJs);
          content[gap.field] = generated;
          fieldMeta[gap.field] = buildFieldMeta({
            state: "generated",
            confidence: coverage === "none" ? "low" : baseConfidence === "high" ? "medium" : baseConfidence,
            sourceRefs: compact([
              rel(path.join(DATA, slug, "gaps.json")),
              branding?.bible.path,
              branding?.blueprint.path,
              "docs/data/index/codeloop-brands/data/brands.js",
            ]),
            reason: `generated to resolve ${gap.reason} gap: ${gap.needed}`,
            coverage,
          });
          generatedFills.push({
            page: page.path,
            section_id: section.id,
            pod: section.pod,
            field: gap.field,
            reason: gap.reason,
            state: "generated",
            review_required: true,
          });
        }
      }
      return {
        id: `${pageId}--${section.id}`,
        page_id: pageId,
        section_key: section.id,
        pod: section.pod,
        pad: section.pad || {},
        component: section.pod,
        order: sectionIndex + 1,
        status: "active",
        content,
        design: {
          theme_variant: config.theme?.variant || "gradient-vibrant",
          background: "var(--pod-bg)",
          layout: design.layout?.variant || design.layout || "adaptive",
          ...design,
          padpod_extras: extras,
        },
        motion,
        tracking: {
          impression_event: `${slug}_${slugify(page.path)}_${slugify(section.id)}_viewed`,
          cta_events: Object.keys(content)
            .filter((key) => key.startsWith("cta_") && key.endsWith("_label"))
            .map((key) => `${slug}_${slugify(section.id)}_${slugify(key)}_clicked`),
        },
        field_meta: fieldMeta,
      };
    });
    return {
      id: pageId,
      website_id: `website-${slug}`,
      path: page.path,
      slug: page.path === "/" ? "home" : slugify(page.path),
      title: page.title || titleCaseFromSlug(page.path),
      status: "draft",
      template: pageIndex === 0 ? "landing" : "dynamic",
      language: "en-US",
      seo: {},
      access: {
        visibility: "public",
        requires_auth: false,
      },
      sections,
    };
  });
  return { pages, generatedFills };
}

function buildComponentRegistry(pages) {
  const components = new Map();
  for (const page of pages) {
    for (const section of page.sections) {
      if (!components.has(section.component)) {
        components.set(section.component, {
          component: section.component,
          category: "section",
          description: `${section.component} PAD/POD section component`,
          allowed_fields: {},
          source: "observed_worktree",
        });
      }
      for (const [field, value] of Object.entries(section.content || {})) {
        components.get(section.component).allowed_fields[field] = {
          type: Array.isArray(value) ? "array" : typeof value,
          required: ["headline", "title"].includes(field),
          max_length: typeof value === "string" ? Math.max(90, value.length) : null,
        };
      }
    }
  }
  return Array.from(components.values()).sort((a, b) => a.component.localeCompare(b.component));
}

function buildContentGaps(slug, gaps, generatedFills) {
  const generatedKeys = new Set(generatedFills.map((gap) => `${gap.page}::${gap.section_id}::${gap.field}`));
  return {
    identity_id: `identity-${slug}`,
    total_original_gaps: gaps.total_gaps || (gaps.gaps || []).length,
    kb_coverage: gaps.kb_coverage || "unknown",
    original_gaps: (gaps.gaps || []).map((gap) => ({
      ...gap,
      canonical_state: generatedKeys.has(`${gap.page}::${gap.section_id}::${gap.field}`) ? "generated_for_review" : "pending",
    })),
    generated_fills: generatedFills,
  };
}

function buildGovernance(slug, coverage, branding, sourceRefs) {
  return {
    identity_id: `identity-${slug}`,
    owner: {
      organization: null,
      accountable_role: "Brand steward",
      review_role: "Senior editor",
      technical_owner: "Digital identity maintainer",
    },
    lifecycle: {
      current_state: "generated",
      approval_state: "review_required",
      created_at: GENERATED_AT,
      updated_at: GENERATED_AT,
    },
    rules: {
      no_personal_email_for_critical_assets: true,
      generated_content_requires_review: true,
      canonical_language: "en-US",
      localization_requires_named_editor: true,
    },
    confidence: confidenceFor(slug, coverage, branding),
    source_refs: sourceRefs,
  };
}

function buildIdentity({ slug, config, worktree, gaps, registryDomains, brandJs, branding, knowledgeIndex }) {
  const coverage = gaps.kb_coverage || knowledgeIndex.coverage?.[slug]?.best_confidence || "unknown";
  const assets = collectAssets(slug);
  const sourceRefs = compact([
    "docs/master.md",
    "docs/padpod_documentacao.docx.md",
    ...(branding ? [branding.bible.path, branding.blueprint.path] : []),
    "docs/data/index/codeloop-brands/data/brands.js",
    rel(path.join(DATA, slug, "config.json")),
    rel(path.join(DATA, slug, "worktree.json")),
    rel(path.join(DATA, slug, "gaps.json")),
  ]);
  const sourceManifest = buildSourceManifest(
    slug,
    path.join(DATA, slug, "config.json"),
    path.join(DATA, slug, "worktree.json"),
    path.join(DATA, slug, "gaps.json"),
    branding,
    coverage,
    assets,
  );
  const organization = inferOrganization(slug, config.domain);
  const digitalIdentity = {
    id: `identity-${slug}`,
    slug,
    name: config.site,
    legal_name: null,
    type: inferType(slug, config),
    status: "active",
    parent_identity_id: slug === "ecosystem" ? null : "identity-ecosystem",
    ecosystem: organization === "CodeLoop" ? "CodeLoop" : organization,
    description: config.metadata?.description || brandJs?.positioning || null,
    mission: null,
    vision: null,
    values: [],
    positioning: {},
    brand_voice: {},
    created_at: GENERATED_AT,
    updated_at: GENERATED_AT,
  };

  const { pages, generatedFills } = buildPages(slug, config, worktree, gaps, coverage, sourceRefs, brandJs, branding);
  const flattenedPages = pages.map((page) => ({ ...page, sections: page.sections.map((section) => section.id) }));

  const brandCore = buildBrandCore(slug, config, brandJs, branding, coverage, sourceRefs);
  digitalIdentity.mission = brandCore.mission;
  digitalIdentity.values = brandCore.values;
  digitalIdentity.positioning = brandCore.positioning;

  const brandVoice = buildBrandVoice(slug, config, brandJs, branding, coverage, sourceRefs);
  digitalIdentity.brand_voice = brandVoice.tone;

  return {
    $schema: "../schema/digital-identity.schema.json",
    schema_version: "1.0.0",
    generated_at: GENERATED_AT,
    source_priority: SOURCE_PRIORITY,
    source_manifest: sourceManifest,
    digital_identity: digitalIdentity,
    brand_core: brandCore,
    brand_voice: brandVoice,
    design_system: normalizeTheme(config, brandJs, branding),
    brand_assets: {
      identity_id: `identity-${slug}`,
      logos: assets,
      images: [],
      videos: [],
      documents: [],
      social_templates: [],
      open_graph_assets: [
        {
          type: "default_og",
          url: config.metadata?.og_image || "/opengraph-image",
          width: 1200,
          height: 630,
        },
      ],
      asset_rules: {
        naming_convention: "{identity_slug}-{asset_type}-{variant}-{size}",
        preferred_formats: ["svg", "webp", "avif", "png"],
        max_file_size_kb: 500,
      },
    },
    domains: buildDomains(slug, config, registryDomains),
    email_authentication: {
      identity_id: `identity-${slug}`,
      domain: config.domain,
      spf: { enabled: false, record: null, status: "unknown" },
      dkim: { enabled: false, selector: null, public_key_status: "unknown", provider: null },
      dmarc: { enabled: false, policy: "none", rua: null, status: "unknown" },
      mx: { provider: null, status: "unknown" },
    },
    websites: [
      {
        id: `website-${slug}`,
        identity_id: `identity-${slug}`,
        name: worktree.site || config.site,
        slug,
        domain: config.domain,
        environment: config.domain?.includes("test") ? "staging" : "production",
        framework: "static",
        status: "active",
        repository: { provider: null, url: null, branch: null },
        deployment: { provider: null, project_id: null, last_deploy_at: null },
        global_config: {
          nav_id: `navigation-${slug}`,
          footer_id: `footer-${slug}`,
          theme_id: `design-system-${slug}`,
          seo_profile_id: `seo-profile-${slug}`,
        },
        pages: flattenedPages.map((page) => page.id),
      },
    ],
    navigation: buildNavigation(config),
    footer: buildFooter(config),
    pages,
    component_registry: buildComponentRegistry(pages),
    content_gaps: buildContentGaps(slug, gaps, generatedFills),
    seo: buildSeo(slug, config, pages),
    tracking: {
      identity_id: `identity-${slug}`,
      setup_status: "planned",
      analytics: [],
      pixels: [],
      events: pages.flatMap((page) => page.sections.map((section) => section.tracking.impression_event)),
    },
    compliance: {
      identity_id: `identity-${slug}`,
      privacy_policy_url: "/privacy",
      terms_url: "/terms",
      cookie_banner: { enabled: true, mode: "notice" },
      lgpd_basis: "review_required",
    },
    social: {
      profiles: (config.footer?.social || []).map((item) => ({
        platform: slugify(item.label),
        url: item.href,
        status: "active",
      })),
      content_system: {
        canonical_language: "en-US",
        voice_profile_id: `brand-voice-${slug}`,
        approval_required: true,
      },
    },
    communication: {
      channels: [
        {
          type: "website_form",
          address: "/contact",
          status: "planned",
        },
      ],
      flows: [
        {
          id: `flow-${slug}-contact`,
          name: "Website contact intake",
          status: "planned",
          trigger: "contact_form_submitted",
        },
      ],
    },
    audiences: {
      personas: compact([
        brandJs?.archetype
          ? {
              id: `persona-${slug}-primary`,
              name: brandJs.archetype,
              description: brandJs.positioning || brandJs.heroSub || null,
            }
          : null,
      ]),
      segments: [
        { id: `audience-${slug}-partners`, name: "Partners", priority: "primary" },
        { id: `audience-${slug}-loopers`, name: "Loopers", priority: "secondary" },
      ],
    },
    protocols: COMMON_PROTOCOLS,
    governance: buildGovernance(slug, coverage, branding, sourceRefs),
  };
}

function buildSchema() {
  const object = { type: "object" };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://codeloop.co/schemas/digital-identity.schema.json",
    title: "Canonical Digital Identity",
    type: "object",
    required: [
      "schema_version",
      "generated_at",
      "source_manifest",
      "digital_identity",
      "brand_core",
      "brand_voice",
      "design_system",
      "brand_assets",
      "domains",
      "websites",
      "navigation",
      "footer",
      "pages",
      "component_registry",
      "content_gaps",
      "seo",
      "tracking",
      "compliance",
      "social",
      "communication",
      "audiences",
      "protocols",
      "governance",
    ],
    additionalProperties: true,
    properties: {
      schema_version: { type: "string" },
      generated_at: { type: "string" },
      source_priority: { type: "array", items: { type: "string" } },
      source_manifest: object,
      digital_identity: {
        type: "object",
        required: ["id", "slug", "name", "type", "status", "ecosystem", "created_at", "updated_at"],
        properties: {
          id: { type: "string" },
          slug: { type: "string" },
          name: { type: "string" },
          type: { enum: ["brand", "product", "company", "district", "campaign", "personal_brand", "community", "ecosystem"] },
          status: { enum: ["draft", "active", "archived", "deprecated"] },
        },
      },
      brand_core: object,
      brand_voice: object,
      design_system: object,
      brand_assets: object,
      domains: object,
      email_authentication: object,
      websites: { type: "array", items: object },
      navigation: object,
      footer: object,
      pages: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "website_id", "path", "title", "sections"],
          properties: {
            id: { type: "string" },
            website_id: { type: "string" },
            path: { type: "string" },
            title: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "page_id", "section_key", "pod", "pad", "component", "order", "content", "design", "motion", "tracking", "field_meta"],
              },
            },
          },
        },
      },
      component_registry: { type: "array", items: object },
      content_gaps: object,
      seo: object,
      tracking: object,
      compliance: object,
      social: object,
      communication: object,
      audiences: object,
      protocols: { type: "array", items: object },
      governance: object,
    },
  };
}

function validateIdentity(identity) {
  const errors = [];
  const required = buildSchema().required;
  for (const key of required) {
    if (identity[key] === undefined) errors.push(`missing top-level key ${key}`);
  }
  const slug = identity.digital_identity?.slug;
  if (!slug) errors.push("missing digital_identity.slug");
  const websiteIds = new Set((identity.websites || []).map((website) => website.id));
  const pageIds = new Set((identity.pages || []).map((page) => page.id));
  for (const page of identity.pages || []) {
    if (!websiteIds.has(page.website_id)) errors.push(`${slug}: page ${page.id} references missing website ${page.website_id}`);
    for (const section of page.sections || []) {
      if (section.page_id !== page.id) errors.push(`${slug}: section ${section.id} has wrong page_id`);
      if (!section.field_meta || typeof section.field_meta !== "object") errors.push(`${slug}: section ${section.id} missing field_meta`);
      for (const field of Object.keys(section.content || {})) {
        const meta = section.field_meta[field];
        if (!meta) errors.push(`${slug}: section ${section.id} field ${field} missing field_meta`);
        else if (!Array.isArray(meta.source_refs) || meta.source_refs.length === 0) {
          errors.push(`${slug}: section ${section.id} field ${field} has no source_refs`);
        }
      }
    }
  }
  for (const website of identity.websites || []) {
    for (const pageId of website.pages || []) {
      if (!pageIds.has(pageId)) errors.push(`${slug}: website ${website.id} references missing page ${pageId}`);
    }
  }
  return errors;
}

function main() {
  const brandsJs = loadBrandsJs();
  const registryDomains = loadRegistryDomains();
  const knowledgeIndex = loadKnowledgeIndex();
  const slugs = fs
    .readdirSync(DATA)
    .filter((name) => {
      const dir = path.join(DATA, name);
      return fs.statSync(dir).isDirectory() && exists(path.join(dir, "config.json")) && exists(path.join(dir, "worktree.json")) && exists(path.join(dir, "gaps.json"));
    })
    .sort();

  const schema = buildSchema();
  writeJson(path.join(OUT, "schema", "digital-identity.schema.json"), schema);

  const identities = [];
  const report = {
    generated_at: GENERATED_AT,
    schema: "docs/data/canonical/schema/digital-identity.schema.json",
    totals: {
      identities: 0,
      pages: 0,
      sections: 0,
      original_gaps: 0,
      generated_fills: 0,
      pending_gaps: 0,
    },
    by_identity: [],
    conflicts: [],
  };

  for (const slug of slugs) {
    const config = readJson(path.join(DATA, slug, "config.json"));
    const worktree = readJson(path.join(DATA, slug, "worktree.json"));
    const gaps = readJson(path.join(DATA, slug, "gaps.json"));
    const branding = loadBranding(slug);
    const identity = buildIdentity({
      slug,
      config,
      worktree,
      gaps,
      registryDomains,
      brandJs: brandsJs[slug],
      branding,
      knowledgeIndex,
    });
    const errors = validateIdentity(identity);
    if (errors.length) {
      throw new Error(`Validation failed for ${slug}:\n${errors.join("\n")}`);
    }
    writeJson(path.join(OUT, "identities", `${slug}.json`), identity);
    identities.push(identity);
    const pages = identity.pages.length;
    const sections = identity.pages.reduce((sum, page) => sum + page.sections.length, 0);
    const generated = identity.content_gaps.generated_fills.length;
    const original = identity.content_gaps.total_original_gaps;
    report.totals.pages += pages;
    report.totals.sections += sections;
    report.totals.original_gaps += original;
    report.totals.generated_fills += generated;
    report.totals.pending_gaps += Math.max(0, original - generated);
    report.by_identity.push({
      slug,
      name: identity.digital_identity.name,
      kb_coverage: identity.content_gaps.kb_coverage,
      confidence: identity.governance.confidence,
      has_final_branding: Boolean(branding),
      has_brand_tokens: Boolean(brandsJs[slug]),
      pages,
      sections,
      original_gaps: original,
      generated_fills: generated,
      pending_gaps: Math.max(0, original - generated),
      source_count: identity.source_manifest.sources.length,
    });
  }

  report.totals.identities = identities.length;

  const index = {
    generated_at: GENERATED_AT,
    schema_version: "1.0.0",
    identity_count: identities.length,
    source_priority: SOURCE_PRIORITY,
    identities: identities.map((identity) => ({
      slug: identity.digital_identity.slug,
      name: identity.digital_identity.name,
      type: identity.digital_identity.type,
      status: identity.digital_identity.status,
      ecosystem: identity.digital_identity.ecosystem,
      domain: identity.websites[0]?.domain || null,
      kb_coverage: identity.content_gaps.kb_coverage,
      confidence: identity.governance.confidence,
      file: `docs/data/canonical/identities/${identity.digital_identity.slug}.json`,
      pages: identity.pages.length,
      sections: identity.pages.reduce((sum, page) => sum + page.sections.length, 0),
      original_gaps: identity.content_gaps.total_original_gaps,
      generated_fills: identity.content_gaps.generated_fills.length,
      review_required: true,
      sources: identity.source_manifest.sources.map((source) => source.path),
    })),
  };

  writeJson(path.join(OUT, "index.json"), index);
  writeJson(path.join(OUT, "reports", "enrichment-report.json"), report);
  console.log(
    `Generated ${report.totals.identities} identities, ${report.totals.pages} pages, ${report.totals.sections} sections, ${report.totals.generated_fills} governed fills.`,
  );
}

main();
