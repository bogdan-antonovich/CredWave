import { readFileSync, writeFileSync } from "fs";
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
      "Plans from $29/month — no contracts, cancel anytime. AI-powered Google review replies for restaurants.",
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
  {
    path: "/refund",
    title: "Refund Policy — CredWave",
    description: "CredWave refund and cancellation policy.",
  },
  {
    path: "/blog",
    title: "Blog — CredWave",
    description: "Practical guides on Google review management, restaurant reputation, and getting more customers from your online presence.",
  },
  {
    path: "/blog/how-to-respond-to-negative-google-reviews",
    title: "How to Respond to Negative Google Reviews — CredWave",
    description: "A bad review doesn't have to damage your reputation. Here's a practical, step-by-step framework for responding to negative Google reviews — with real examples.",
  },
  {
    path: "/blog/how-to-respond-to-positive-google-reviews",
    title: "How to Respond to Positive Google Reviews — CredWave",
    description: "Most restaurants ignore five-star reviews entirely. Here's why that's a mistake, and how to respond in a way that builds loyalty and improves your Google ranking.",
  },
  {
    path: "/blog/google-review-response-templates",
    title: "Google Review Response Templates for Restaurants — CredWave",
    description: "Ready-to-use templates for responding to negative, mixed, and positive Google reviews — organized by scenario, with tips on how to personalize each one.",
  },
  {
    path: "/blog/how-to-get-more-google-reviews",
    title: "How to Get More Google Reviews for Your Restaurant — CredWave",
    description: "Review count is a direct Google local ranking factor. Here's exactly how to get more Google reviews from real customers — without violating Google's policies.",
  },
  {
    path: "/blog/why-respond-to-every-google-review",
    title: "Why Restaurants Should Respond to Every Google Review — CredWave",
    description: "Businesses that respond to reviews consistently convert more customers and rank higher. Here's what the research actually says.",
  },
  {
    path: "/blog/how-to-deal-with-fake-google-reviews",
    title: "How to Deal with Fake Google Reviews at Your Restaurant — CredWave",
    description: "Fake reviews are a growing problem. Here's how to identify them, report them to Google, respond publicly while you wait, and protect your reputation.",
  },
  {
    path: "/blog/restaurant-reputation-management",
    title: "Restaurant Reputation Management: The Complete Guide — CredWave",
    description: "Your restaurant's online reputation directly affects revenue. This guide covers the full strategy — earning reviews, monitoring them, and responding effectively.",
  },
];

function buildHtml(html, route) {
  const { path, title, description, jsonLd } = route;
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  const canonical = url === SITE_URL ? SITE_URL + "/" : url;

  const inject = [
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:site_name" content="CredWave" />`,
    ...(jsonLd
      ? [
          `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
        ]
      : []),
  ].join("\n    ");

  return html.replace("</head>", `    ${inject}\n  </head>`);
}

for (const route of routes) {
  // vite-ssg outputs dist/index.html for "/" and dist/pricing.html for "/pricing"
  // For nested routes like /blog/article-slug, it outputs dist/blog/article-slug.html
  const filePath =
    route.path === "/"
      ? join(distDir, "index.html")
      : join(distDir, `${route.path}.html`);

  const html = readFileSync(filePath, "utf-8");
  const updated = buildHtml(html, route);
  writeFileSync(filePath, updated);
  const label = route.path === "/" ? "dist/index.html" : `dist${route.path}.html`;
  console.log(`✓ ${label}`);
}
