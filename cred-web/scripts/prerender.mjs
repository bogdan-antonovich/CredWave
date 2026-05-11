import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist");

const SITE_URL = "https://credwave.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CredWave",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-powered Google review management for restaurants. Generate and post on-brand replies automatically.",
  url: SITE_URL,
  offers: [
    { "@type": "Offer", name: "Starter", price: "29", priceCurrency: "USD" },
    { "@type": "Offer", name: "Growth", price: "79", priceCurrency: "USD" },
    { "@type": "Offer", name: "Scale", price: "149", priceCurrency: "USD" },
  ],
};

const routes = [
  {
    path: "/",
    title: "CredWave — AI Google Review Management for Restaurants",
    description:
      "Restaurants that respond to every Google review earn 35% more. CredWave generates AI-written replies in 3 tones and posts them directly to Google — automatically.",
    jsonLd,
  },
  {
    path: "/pricing",
    title: "Pricing — CredWave",
    description:
      "Start free for 14 days. Plans from $29/month — no contracts, cancel anytime. AI-powered Google review replies for restaurants.",
  },
  {
    path: "/demo",
    title: "Live Demo — CredWave",
    description:
      "See AI-generated Google review responses for any restaurant in real time. No sign-up required.",
  },
  {
    path: "/contact",
    title: "Contact — CredWave",
    description: "Get in touch with the CredWave team.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy — CredWave",
    description: "How CredWave collects, uses, and protects your data.",
  },
  {
    path: "/terms",
    title: "Terms of Service — CredWave",
    description: "CredWave terms of service and user agreement.",
  },
];

const baseHtml = readFileSync(join(distDir, "index.html"), "utf-8");

function buildHtml(html, route) {
  const { path, title, description, jsonLd } = route;
  const url = `${SITE_URL}${path === "/" ? "" : path}`;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${description}" />`,
  );

  const inject = [
    `<link rel="canonical" href="${url === SITE_URL ? SITE_URL + "/" : url}" />`,
    `<meta property="og:image" content="https://credwave.app/meta.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url === SITE_URL ? SITE_URL + "/" : url}" />`,
    `<meta property="og:site_name" content="CredWave" />`,
    ...(jsonLd
      ? [
          `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
        ]
      : []),
  ].join("\n    ");

  html = html.replace("</head>", `    ${inject}\n  </head>`);

  return html;
}

for (const route of routes) {
  const html = buildHtml(baseHtml, route);

  if (route.path === "/") {
    writeFileSync(join(distDir, "index.html"), html);
    console.log("✓ dist/index.html");
  } else {
    const dir = join(distDir, route.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    console.log(`✓ dist${route.path}/index.html`);
  }
}
