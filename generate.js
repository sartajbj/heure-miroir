"use strict";

/**
 * Heure Miroir Plus
 * Static hour-page generator
 *
 * Source:
 *   heures.json
 *   heure-template.html
 *
 * Output:
 *   heure-miroir-XXhXX.html
 *   sitemap.xml
 *
 * No external dependencies.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;

const CONFIG = Object.freeze({
  domain: "https://heuremiroirplus.com",
  language: "fr-FR",

  databaseFile: path.join(ROOT, "heures.json"),
  templateFile: path.join(ROOT, "heure-template.html"),
  sitemapFile: path.join(ROOT, "sitemap.xml"),

  generatedPrefix: "heure-miroir-",
  generatedSuffix: ".html"
});


/* =========================================================
   BASIC HELPERS
========================================================= */

function fail(message) {
  console.error(`\n[generate] ERREUR: ${message}\n`);
  process.exit(1);
}


function readUTF8(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`Impossible de lire ${path.basename(filePath)} : ${error.message}`);
  }
}


function writeUTF8(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, "utf8");
  } catch (error) {
    fail(`Impossible d'écrire ${path.basename(filePath)} : ${error.message}`);
  }
}


function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function escapeAttribute(value) {
  return escapeHTML(value);
}


function escapeJSONForHTML(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}


function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}


/* =========================================================
   TIME HELPERS
========================================================= */

function normalizeTime(value) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[h.]/g, ":")
    .replace(/\s+/g, "");

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}


function displayTime(value) {
  const normalized = normalizeTime(value);

  if (!normalized) {
    return "";
  }

  return normalized.replace(":", "h");
}


function slugTime(value) {
  const normalized = normalizeTime(value);

  if (!normalized) {
    return "";
  }

  return normalized.replace(":", "h");
}


function outputFilename(value) {
  const slug = slugTime(value);

  if (!slug) {
    return "";
  }

  return `${CONFIG.generatedPrefix}${slug}${CONFIG.generatedSuffix}`;
}


function publicPath(value) {
  const slug = slugTime(value);

  if (!slug) {
    return "";
  }

  return `/${CONFIG.generatedPrefix}${slug}`;
}


function absoluteURL(value) {
  return `${CONFIG.domain}${publicPath(value)}`;
}


/* =========================================================
   ENTRY HELPERS
========================================================= */

function getInterpretations(entry) {
  const source =
    entry &&
    typeof entry.interpretations === "object" &&
    entry.interpretations !== null
      ? entry.interpretations
      : {};

  return {
    essentiel: normalizeWhitespace(
      source.essentiel || entry.resume || ""
    ),

    amour: normalizeWhitespace(
      source.amour || ""
    ),

    travail: normalizeWhitespace(
      source.travail || ""
    ),

    numerologie: normalizeWhitespace(
      source.numerologie || ""
    ),

    symbolique: normalizeWhitespace(
      source.symbolique || ""
    ),

    psychologie: normalizeWhitespace(
      source.psychologie || ""
    )
  };
}


function getCategory(entry) {
  return normalizeWhitespace(entry.categorie || "").toLowerCase();
}


function getType(entry) {
  return normalizeWhitespace(entry.type || "Heure miroir");
}


function getSummary(entry) {
  return normalizeWhitespace(
    entry.resume ||
    entry.interpretations?.essentiel ||
    ""
  );
}


function categoryInfo(entry) {
  const category = getCategory(entry);

  const categories = {
    double: {
      label: "Heure double",
      page: "/heures-doubles",
      pageLabel: "Heures doubles"
    },

    inversee: {
      label: "Heure inversée",
      page: "/heures-inversees",
      pageLabel: "Heures inversées"
    },

    inverse: {
      label: "Heure inversée",
      page: "/heures-inversees",
      pageLabel: "Heures inversées"
    },

    triple: {
      label: "Heure triple",
      page: "/heures-triples",
      pageLabel: "Heures triples"
    },

    sequentielle: {
      label: "Heure séquentielle",
      page: "/heures-sequentielles",
      pageLabel: "Heures séquentielles"
    },

    sequential: {
      label: "Heure séquentielle",
      page: "/heures-sequentielles",
      pageLabel: "Heures séquentielles"
    }
  };

  return categories[category] || {
    label: getType(entry),
    page: "/toutes-les-heures",
    pageLabel: "Toutes les heures"
  };
}


/* =========================================================
   VALIDATION
========================================================= */

function loadDatabase() {
  const raw = readUTF8(CONFIG.databaseFile);

  let data;

  try {
    data = JSON.parse(raw);
  } catch (error) {
    fail(`heures.json contient un JSON invalide : ${error.message}`);
  }

  const entries = Array.isArray(data)
    ? data
    : Array.isArray(data.heures)
      ? data.heures
      : null;

  if (!entries) {
    fail('heures.json doit contenir un tableau "heures".');
  }

  if (entries.length === 0) {
    fail("heures.json ne contient aucune heure.");
  }

  return {
    metadata:
      !Array.isArray(data) && typeof data === "object"
        ? data
        : {},
    entries
  };
}


function validateEntries(entries) {
  const seenTimes = new Set();
  const seenURLs = new Set();

  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== "object") {
      fail(`Entrée #${index + 1} invalide dans heures.json.`);
    }

    const time = normalizeTime(entry.heure);

    if (!time) {
      fail(
        `Heure invalide à l'entrée #${index + 1}: "${entry.heure ?? ""}".`
      );
    }

    if (seenTimes.has(time)) {
      fail(`Heure dupliquée dans heures.json : ${time}.`);
    }

    seenTimes.add(time);

    const expectedPath = publicPath(time);

    if (entry.url) {
      const suppliedPath = String(entry.url).trim();

      if (suppliedPath !== expectedPath) {
        fail(
          `URL incohérente pour ${time}. Attendu: "${expectedPath}", reçu: "${suppliedPath}".`
        );
      }
    }

    if (seenURLs.has(expectedPath)) {
      fail(`URL dupliquée : ${expectedPath}.`);
    }

    seenURLs.add(expectedPath);

    if (!getSummary(entry)) {
      fail(`Résumé manquant pour ${time}.`);
    }

    if (!getCategory(entry)) {
      fail(`Catégorie manquante pour ${time}.`);
    }

    const interpretations = getInterpretations(entry);

    if (!interpretations.essentiel) {
      fail(`Interprétation "essentiel" manquante pour ${time}.`);
    }
  }
}


/* =========================================================
   SEO TEXT
========================================================= */

function buildTitle(entry) {
  const time = displayTime(entry.heure);

  return `${time} : Signification de l'Heure Miroir | Heure Miroir Plus`;
}


function buildMetaDescription(entry) {
  const time = displayTime(entry.heure);

  return (
    `${time} : découvrez la signification de cette heure miroir ` +
    `en amour, en numérologie, ainsi que ses lectures symbolique ` +
    `et psychologique.`
  );
}


/* =========================================================
   RELATED HOURS
========================================================= */

function buildRelatedEntries(currentEntry, allEntries, limit = 4) {
  const currentTime = normalizeTime(currentEntry.heure);
  const currentCategory = getCategory(currentEntry);

  const sameCategory = [];
  const otherCategories = [];

  for (const entry of allEntries) {
    const time = normalizeTime(entry.heure);

    if (!time || time === currentTime) {
      continue;
    }

    if (getCategory(entry) === currentCategory) {
      sameCategory.push(entry);
    } else {
      otherCategories.push(entry);
    }
  }

  const sortedSameCategory = sortEntriesByTime(sameCategory);
  const sortedOtherCategories = sortEntriesByTime(otherCategories);

  const currentMinutes = timeToMinutes(currentTime);

  sortedSameCategory.sort((a, b) => {
    const distanceA = Math.abs(timeToMinutes(a.heure) - currentMinutes);
    const distanceB = Math.abs(timeToMinutes(b.heure) - currentMinutes);

    if (distanceA !== distanceB) {
      return distanceA - distanceB;
    }

    return timeToMinutes(a.heure) - timeToMinutes(b.heure);
  });

  return [
    ...sortedSameCategory,
    ...sortedOtherCategories
  ].slice(0, limit);
}


function timeToMinutes(value) {
  const normalized = normalizeTime(value);

  if (!normalized) {
    return Number.MAX_SAFE_INTEGER;
  }

  const [hours, minutes] = normalized
    .split(":")
    .map(Number);

  return (hours * 60) + minutes;
}


function sortEntriesByTime(entries) {
  return [...entries].sort(
    (a, b) => timeToMinutes(a.heure) - timeToMinutes(b.heure)
  );
}


function renderRelatedHours(entries) {
  if (!entries.length) {
    return `
      <p>
        Consultez le
        <a href="/toutes-les-heures">répertoire des heures</a>
        pour découvrir d'autres motifs.
      </p>
    `.trim();
  }

  return entries
    .map((entry) => {
      const time = displayTime(entry.heure);
      const url = publicPath(entry.heure);
      const summary = getSummary(entry);

      return `
        <a class="hour-directory-card" href="${escapeAttribute(url)}">
          <strong>${escapeHTML(time)}</strong>
          <span>${escapeHTML(summary)}</span>
        </a>
      `.trim();
    })
    .join("\n");
}


/* =========================================================
   TEMPLATE VALUES
========================================================= */

function buildTemplateValues(entry, allEntries) {
  const normalized = normalizeTime(entry.heure);
  const display = displayTime(normalized);
  const slug = slugTime(normalized);
  const url = absoluteURL(normalized);

  const interpretations = getInterpretations(entry);
  const category = categoryInfo(entry);
  const summary = getSummary(entry);

  const related = buildRelatedEntries(
    entry,
    allEntries,
    4
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    "url": url,
    "name": buildTitle(entry),
    "description": buildMetaDescription(entry),
    "isPartOf": {
      "@id": `${CONFIG.domain}/#website`
    },
    "breadcrumb": {
      "@id": `${url}#breadcrumb`
    },
    "inLanguage": CONFIG.language
  };

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Accueil",
        "item": `${CONFIG.domain}/`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": category.pageLabel,
        "item": `${CONFIG.domain}${category.page}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": display,
        "item": url
      }
    ]
  };

  return {
    "{{TITLE}}": escapeHTML(buildTitle(entry)),
    "{{META_DESCRIPTION}}": escapeAttribute(buildMetaDescription(entry)),

    "{{CANONICAL_URL}}": escapeAttribute(url),
    "{{PUBLIC_PATH}}": escapeAttribute(publicPath(normalized)),

    "{{TIME}}": escapeHTML(display),
    "{{TIME_RAW}}": escapeHTML(normalized),
    "{{TIME_SLUG}}": escapeHTML(slug),

    "{{TYPE}}": escapeHTML(getType(entry)),
    "{{CATEGORY_LABEL}}": escapeHTML(category.label),
    "{{CATEGORY_URL}}": escapeAttribute(category.page),
    "{{CATEGORY_PAGE_LABEL}}": escapeHTML(category.pageLabel),

    "{{SUMMARY}}": escapeHTML(summary),

    "{{ESSENTIEL}}": escapeHTML(interpretations.essentiel),
    "{{AMOUR}}": escapeHTML(interpretations.amour),
    "{{TRAVAIL}}": escapeHTML(interpretations.travail),
    "{{NUMEROLOGIE}}": escapeHTML(interpretations.numerologie),
    "{{SYMBOLIQUE}}": escapeHTML(interpretations.symbolique),
    "{{PSYCHOLOGIE}}": escapeHTML(interpretations.psychologie),

    "{{RELATED_HOURS}}": renderRelatedHours(related),

    "{{WEBPAGE_JSONLD}}": escapeJSONForHTML(structuredData),
    "{{BREADCRUMB_JSONLD}}": escapeJSONForHTML(breadcrumbData)
  };
}


/* =========================================================
   TEMPLATE ENGINE
========================================================= */

function validateTemplate(template) {
  const requiredTokens = [
    "{{TITLE}}",
    "{{META_DESCRIPTION}}",
    "{{CANONICAL_URL}}",
    "{{TIME}}",
    "{{TYPE}}",
    "{{SUMMARY}}",
    "{{ESSENTIEL}}",
    "{{AMOUR}}",
    "{{TRAVAIL}}",
    "{{NUMEROLOGIE}}",
    "{{SYMBOLIQUE}}",
    "{{PSYCHOLOGIE}}",
    "{{RELATED_HOURS}}",
    "{{WEBPAGE_JSONLD}}",
    "{{BREADCRUMB_JSONLD}}"
  ];

  const missing = requiredTokens.filter(
    (token) => !template.includes(token)
  );

  if (missing.length) {
    fail(
      `heure-template.html ne contient pas les marqueurs requis : ${missing.join(", ")}`
    );
  }
}


function renderTemplate(template, values) {
  let output = template;

  for (const [token, value] of Object.entries(values)) {
    output = output.split(token).join(value);
  }

  const unresolved = output.match(/\{\{[A-Z0-9_]+\}\}/g);

  if (unresolved) {
    fail(
      `Marqueur(s) non remplacé(s) dans le template : ${[
        ...new Set(unresolved)
      ].join(", ")}`
    );
  }

  return output;
}


/* =========================================================
   GENERATED FILE MANAGEMENT
========================================================= */

function listGeneratedFiles() {
  let files;

  try {
    files = fs.readdirSync(ROOT);
  } catch (error) {
    fail(`Impossible de lire le dossier du projet : ${error.message}`);
  }

  return files.filter((filename) => {
    return (
      filename.startsWith(CONFIG.generatedPrefix) &&
      filename.endsWith(CONFIG.generatedSuffix)
    );
  });
}


function removeStaleGeneratedFiles(expectedFiles) {
  const expected = new Set(expectedFiles);

  for (const filename of listGeneratedFiles()) {
    if (!expected.has(filename)) {
      const fullPath = path.join(ROOT, filename);

      try {
        fs.unlinkSync(fullPath);
        console.log(`[generate] Supprimé : ${filename}`);
      } catch (error) {
        fail(`Impossible de supprimer ${filename} : ${error.message}`);
      }
    }
  }
}


/* =========================================================
   SITEMAP
========================================================= */

const STATIC_URLS = Object.freeze([
  {
    loc: "/",
    changefreq: "weekly",
    priority: "1.0"
  },
  {
    loc: "/toutes-les-heures",
    changefreq: "weekly",
    priority: "0.9"
  },
  {
    loc: "/heures-doubles",
    changefreq: "weekly",
    priority: "0.9"
  },
  {
    loc: "/heures-inversees",
    changefreq: "weekly",
    priority: "0.8"
  },
  {
    loc: "/heures-triples",
    changefreq: "weekly",
    priority: "0.8"
  },
  {
    loc: "/heures-sequentielles",
    changefreq: "weekly",
    priority: "0.7"
  },
  {
    loc: "/guide-heures-miroirs",
    changefreq: "monthly",
    priority: "0.9"
  },
  {
    loc: "/pourquoi-heures-miroirs",
    changefreq: "monthly",
    priority: "0.8"
  },
  {
    loc: "/numerologie-heures-miroirs",
    changefreq: "monthly",
    priority: "0.8"
  },
  {
    loc: "/psychologie-heures-miroirs",
    changefreq: "monthly",
    priority: "0.8"
  },
  {
    loc: "/methodologie",
    changefreq: "monthly",
    priority: "0.5"
  },
  {
    loc: "/a-propos",
    changefreq: "monthly",
    priority: "0.4"
  },
  {
    loc: "/contact",
    changefreq: "yearly",
    priority: "0.3"
  },
  {
    loc: "/confidentialite",
    changefreq: "yearly",
    priority: "0.2"
  },
  {
    loc: "/mentions-legales",
    changefreq: "yearly",
    priority: "0.2"
  }
]);


function escapeXML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}


function sitemapURLBlock({
  loc,
  changefreq,
  priority
}) {
  return [
    "  <url>",
    `    <loc>${escapeXML(CONFIG.domain + loc)}</loc>`,
    `    <changefreq>${escapeXML(changefreq)}</changefreq>`,
    `    <priority>${escapeXML(priority)}</priority>`,
    "  </url>"
  ].join("\n");
}


function generateSitemap(entries) {
  const staticBlocks = STATIC_URLS.map(
    sitemapURLBlock
  );

  const hourBlocks = sortEntriesByTime(entries).map(
    (entry) =>
      sitemapURLBlock({
        loc: publicPath(entry.heure),
        changefreq: "monthly",
        priority: "0.8"
      })
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticBlocks,
    ...hourBlocks,
    "</urlset>",
    ""
  ].join("\n");
}


/* =========================================================
   GENERATION
========================================================= */

function generatePages(entries, template) {
  const expectedFiles = [];

  for (const entry of sortEntriesByTime(entries)) {
    const filename = outputFilename(entry.heure);

    if (!filename) {
      fail(`Impossible de créer un nom de fichier pour "${entry.heure}".`);
    }

    const values = buildTemplateValues(
      entry,
      entries
    );

    const html = renderTemplate(
      template,
      values
    );

    writeUTF8(
      path.join(ROOT, filename),
      html
    );

    expectedFiles.push(filename);

    console.log(
      `[generate] Créé : ${filename}`
    );
  }

  removeStaleGeneratedFiles(expectedFiles);

  return expectedFiles;
}


/* =========================================================
   MAIN
========================================================= */

function main() {
  console.log("");
  console.log("Heure Miroir Plus — génération statique");
  console.log("---------------------------------------");

  if (!fs.existsSync(CONFIG.databaseFile)) {
    fail("heures.json est introuvable.");
  }

  if (!fs.existsSync(CONFIG.templateFile)) {
    fail(
      "heure-template.html est introuvable. Créez d'abord le fichier #22."
    );
  }

  const { entries } = loadDatabase();

  validateEntries(entries);

  const template = readUTF8(
    CONFIG.templateFile
  );

  validateTemplate(template);

  const generatedFiles = generatePages(
    entries,
    template
  );

  const sitemap = generateSitemap(entries);

  writeUTF8(
    CONFIG.sitemapFile,
    sitemap
  );

  console.log(
    `[generate] Sitemap mis à jour : sitemap.xml`
  );

  console.log("---------------------------------------");
  console.log(
    `[generate] Terminé : ${generatedFiles.length} page(s) générée(s).`
  );
  console.log("");
}


main();
