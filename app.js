/* =========================================================
   HEURE MIROIR PLUS
   File #03 — app.js
   Analyzer, classification, result UI, navigation UX
   ========================================================= */

"use strict";

(() => {

  /* =======================================================
     1. CONFIG
  ======================================================= */

  const CONFIG = {
    dataUrl: "/heures.json",
    detailPrefix: "/heure-miroir-",
    resultScrollOffset: 90
  };


  /* =======================================================
     2. DOM
  ======================================================= */

  const dom = {
    menuToggle: document.querySelector(".menu-toggle"),
    mainNav: document.querySelector(".main-nav"),

    form: document.getElementById("heure-form"),
    timeInput: document.getElementById("heure-input"),

    resultSection: document.getElementById("resultat"),
    resultType: document.getElementById("result-type"),
    resultTime: document.getElementById("result-time"),
    resultSummary: document.getElementById("result-summary"),
    resultTabs: document.getElementById("result-tabs"),
    resultContent: document.getElementById("result-content"),
    resultDetailLink: document.getElementById("result-detail-link"),

    directoryForm: document.getElementById("directory-search-form"),
    directoryInput: document.getElementById("directory-search"),

    currentYear: document.getElementById("current-year")
  };


  /* =======================================================
     3. STATE
  ======================================================= */

  const state = {
    database: null,
    hourMap: new Map(),
    activeHour: null,
    activeTab: "essentiel"
  };


  /* =======================================================
     4. HELPERS
  ======================================================= */

  function normalizeTime(value) {
    if (typeof value !== "string") return null;

    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[h.]/g, ":");

    const match = cleaned.match(/^(\d{1,2}):(\d{1,2})$/);

    if (!match) return null;

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

    return (
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0")
    );
  }


  function toDisplayTime(time) {
    return time.replace(":", "h");
  }


  function toSlugTime(time) {
    return time.replace(":", "h");
  }


  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function safeText(value, fallback = "") {
    if (typeof value !== "string") return fallback;

    const trimmed = value.trim();

    return trimmed || fallback;
  }


  function scrollToResult() {
    if (!dom.resultSection) return;

    const top =
      dom.resultSection.getBoundingClientRect().top +
      window.scrollY -
      CONFIG.resultScrollOffset;

    window.scrollTo({
      top,
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
  }


  function prefersReducedMotion() {
    return window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }


  /* =======================================================
     5. DATABASE
  ======================================================= */

  async function loadDatabase() {
    if (state.database) {
      return state.database;
    }

    try {
      const response = await fetch(CONFIG.dataUrl, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          `Impossible de charger heures.json (${response.status})`
        );
      }

      const data = await response.json();

      const entries = Array.isArray(data)
        ? data
        : Array.isArray(data.heures)
          ? data.heures
          : [];

      state.database = data;
      state.hourMap.clear();

      entries.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;

        const rawTime =
          entry.heure ||
          entry.time ||
          entry.id ||
          "";

        const normalized = normalizeTime(rawTime);

        if (normalized) {
          state.hourMap.set(normalized, entry);
        }
      });

      return data;

    } catch (error) {
      console.error(
        "Heure Miroir Plus — erreur de chargement :",
        error
      );

      state.database = {
        heures: []
      };

      state.hourMap.clear();

      return state.database;
    }
  }


  function findDatabaseEntry(time) {
    return state.hourMap.get(time) || null;
  }


  /* =======================================================
     6. PATTERN CLASSIFICATION
     IMPORTANT:
     This is structural detection only.
     #04 heures.json remains the authoritative editorial
     source for named/recognized patterns.
  ======================================================= */

  function classifyStructuralPattern(time) {
    const normalized = normalizeTime(time);

    if (!normalized) {
      return {
        key: "invalid",
        label: "Heure invalide"
      };
    }

    const [hh, mm] = normalized.split(":");

    const a = Number(hh[0]);
    const b = Number(hh[1]);
    const c = Number(mm[0]);
    const d = Number(mm[1]);

    const digits = [a, b, c, d];

    /* Double: HH === MM
       Examples: 10:10, 11:11, 22:22
    */
    if (hh === mm) {
      return {
        key: "double",
        label: "Heure double"
      };
    }

    /* Reverse / palindrome:
       AB:BA
       Examples: 12:21, 15:51, 21:12
    */
    if (a === d && b === c) {
      return {
        key: "inversee",
        label: "Heure inversée"
      };
    }

    /* Triple:
       exactly one digit appears three times.
       Editorial inclusion is confirmed by heures.json.
    */
    const frequencies = {};

    digits.forEach((digit) => {
      frequencies[digit] =
        (frequencies[digit] || 0) + 1;
    });

    const counts = Object.values(frequencies);

    if (counts.includes(3)) {
      return {
        key: "triple",
        label: "Heure triple"
      };
    }

    /* Sequential:
       strict digit-by-digit +1 or -1.
       Example candidate: 12:34.
       heures.json decides whether the specific time
       belongs to our published taxonomy.
    */
    const increasing =
      digits.every((digit, index) => {
        if (index === 0) return true;

        return digit === digits[index - 1] + 1;
      });

    const decreasing =
      digits.every((digit, index) => {
        if (index === 0) return true;

        return digit === digits[index - 1] - 1;
      });

    if (increasing || decreasing) {
      return {
        key: "sequentielle",
        label: "Heure séquentielle",
        direction: increasing
          ? "croissante"
          : "decroissante"
      };
    }

    return {
      key: "ordinaire",
      label: "Heure sans motif répertorié"
    };
  }


  /* =======================================================
     7. ENTRY DATA HELPERS
  ======================================================= */

  function getEntryType(entry, fallbackPattern) {
    const rawType =
      safeText(entry?.type) ||
      safeText(entry?.categorie) ||
      safeText(entry?.category);

    if (rawType) {
      return rawType;
    }

    return fallbackPattern.label;
  }


  function getEntrySummary(entry) {
    return (
      safeText(entry?.resume) ||
      safeText(entry?.summary) ||
      safeText(entry?.essentiel) ||
      ""
    );
  }


  function getInterpretation(entry, tab) {
    if (!entry) return "";

    if (
      entry.interpretations &&
      typeof entry.interpretations === "object"
    ) {
      const nested =
        entry.interpretations[tab];

      if (typeof nested === "string") {
        return nested;
      }

      if (
        nested &&
        typeof nested === "object"
      ) {
        return (
          safeText(nested.resume) ||
          safeText(nested.texte) ||
          safeText(nested.text)
        );
      }
    }

    const directMap = {
      essentiel: [
        "essentiel",
        "resume",
        "summary",
        "signification"
      ],

      amour: [
        "amour",
        "love"
      ],

      travail: [
        "travail",
        "professionnel",
        "work"
      ],

      numerologie: [
        "numerologie",
        "numérologie"
      ],

      symbolique: [
        "symbolique",
        "spirituel",
        "spiritualite"
      ],

      psychologie: [
        "psychologie",
        "psychology"
      ]
    };

    const candidates =
      directMap[tab] || [tab];

    for (const key of candidates) {
      const value = entry[key];

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return "";
  }


  /* =======================================================
     8. RESULT RENDERING
  ======================================================= */

  function renderKnownHour(time, entry) {
    const structuralPattern =
      classifyStructuralPattern(time);

    state.activeHour = {
      time,
      entry,
      structuralPattern
    };

    state.activeTab = "essentiel";

    const displayTime = toDisplayTime(time);

    const type =
      getEntryType(
        entry,
        structuralPattern
      );

    const summary =
      getEntrySummary(entry) ||
      "Découvrez les différentes interprétations associées à cette heure.";

    dom.resultType.textContent = type;
    dom.resultTime.textContent = displayTime;
    dom.resultSummary.textContent = summary;

    dom.resultDetailLink.href =
      safeText(entry.url) ||
      `${CONFIG.detailPrefix}${toSlugTime(time)}`;

    dom.resultDetailLink.hidden = false;

    activateTab("essentiel");

    dom.resultSection.hidden = false;

    scrollToResult();
  }


  function renderUnlistedPattern(time, pattern) {
    state.activeHour = {
      time,
      entry: null,
      structuralPattern: pattern
    };

    state.activeTab = "essentiel";

    dom.resultType.textContent = pattern.label;
    dom.resultTime.textContent = toDisplayTime(time);

    let message;

    if (pattern.key === "ordinaire") {
      message =
        "Cette heure ne correspond pas à un motif actuellement répertorié dans notre guide.";
    } else {
      message =
        "Un motif numérique est détecté, mais cette heure ne possède pas encore de fiche d’interprétation publiée dans notre base.";
    }

    dom.resultSummary.textContent = message;

    dom.resultContent.innerHTML = `
      <p>
        ${escapeHTML(message)}
      </p>
      <p>
        Heure Miroir Plus n’attribue pas automatiquement
        une signification spirituelle à chaque combinaison
        numérique.
      </p>
    `;

    dom.resultDetailLink.href =
      "/toutes-les-heures";

    dom.resultDetailLink.textContent =
      "Explorer les heures répertoriées";

    dom.resultDetailLink.hidden = false;

    updateSelectedTab("essentiel");

    disableUnavailableTabs();

    dom.resultSection.hidden = false;

    scrollToResult();
  }


  function renderLoadFailure(time, pattern) {
    state.activeHour = {
      time,
      entry: null,
      structuralPattern: pattern
    };

    dom.resultType.textContent =
      "Analyse temporairement indisponible";

    dom.resultTime.textContent =
      toDisplayTime(time);

    dom.resultSummary.textContent =
      "La base des significations n’a pas pu être chargée.";

    dom.resultContent.innerHTML = `
      <p>
        Veuillez réessayer dans quelques instants.
      </p>
    `;

    dom.resultDetailLink.href =
      "/toutes-les-heures";

    dom.resultDetailLink.textContent =
      "Consulter le répertoire";

    dom.resultDetailLink.hidden = false;

    updateSelectedTab("essentiel");

    dom.resultSection.hidden = false;

    scrollToResult();
  }


  /* =======================================================
     9. RESULT TABS
  ======================================================= */

  function getTabButtons() {
    if (!dom.resultTabs) return [];

    return [
      ...dom.resultTabs.querySelectorAll(
        '[role="tab"][data-tab]'
      )
    ];
  }


  function updateSelectedTab(tabName) {
    getTabButtons().forEach((button) => {
      const selected =
        button.dataset.tab === tabName;

      button.setAttribute(
        "aria-selected",
        String(selected)
      );

      button.tabIndex =
        selected ? 0 : -1;
    });
  }


  function disableUnavailableTabs() {
    const entry =
      state.activeHour?.entry || null;

    getTabButtons().forEach((button) => {
      const tabName =
        button.dataset.tab;

      if (tabName === "essentiel") {
        button.disabled = false;
        button.removeAttribute("aria-disabled");
        return;
      }

      const content =
        getInterpretation(
          entry,
          tabName
        );

      const unavailable =
        !content;

      button.disabled = unavailable;

      if (unavailable) {
        button.setAttribute(
          "aria-disabled",
          "true"
        );
      } else {
        button.removeAttribute(
          "aria-disabled"
        );
      }
    });
  }


  function activateTab(tabName) {
    if (!state.activeHour) return;

    const entry =
      state.activeHour.entry;

    let content =
      getInterpretation(
        entry,
        tabName
      );

    if (
      !content &&
      tabName === "essentiel"
    ) {
      content =
        getEntrySummary(entry);
    }

    if (!content) {
      content =
        "Aucune interprétation spécifique n’est actuellement publiée pour cette rubrique.";
    }

    state.activeTab = tabName;

    updateSelectedTab(tabName);
    disableUnavailableTabs();

    dom.resultContent.innerHTML = `
      <p>${escapeHTML(content)}</p>
    `;
  }


  function handleTabClick(event) {
    const button =
      event.target.closest(
        '[role="tab"][data-tab]'
      );

    if (
      !button ||
      button.disabled
    ) {
      return;
    }

    activateTab(
      button.dataset.tab
    );
  }


  function handleTabKeyboard(event) {
    const buttons =
      getTabButtons().filter(
        (button) => !button.disabled
      );

    if (!buttons.length) return;

    const currentIndex =
      buttons.indexOf(
        document.activeElement
      );

    if (currentIndex < 0) return;

    let nextIndex = null;

    if (event.key === "ArrowRight") {
      nextIndex =
        (currentIndex + 1) %
        buttons.length;
    }

    if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + buttons.length) %
        buttons.length;
    }

    if (event.key === "Home") {
      nextIndex = 0;
    }

    if (event.key === "End") {
      nextIndex =
        buttons.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();

    buttons[nextIndex].focus();

    activateTab(
      buttons[nextIndex].dataset.tab
    );
  }


  /* =======================================================
     10. ANALYZER
  ======================================================= */

  async function analyzeTime(rawValue) {
    const time =
      normalizeTime(rawValue);

    if (!time) {
      if (dom.timeInput) {
        dom.timeInput.setCustomValidity(
          "Veuillez saisir une heure valide."
        );

        dom.timeInput.reportValidity();

        window.setTimeout(() => {
          dom.timeInput.setCustomValidity("");
        }, 100);
      }

      return;
    }

    const pattern =
      classifyStructuralPattern(time);

    await loadDatabase();

    /*
      Distinguish an actually empty/unavailable database
      from a valid database where this specific hour
      simply isn't listed.
    */
    const hasDatabase =
      state.hourMap.size > 0;

    if (!hasDatabase) {
      renderLoadFailure(
        time,
        pattern
      );

      return;
    }

    const entry =
      findDatabaseEntry(time);

    if (entry) {
      renderKnownHour(
        time,
        entry
      );

      return;
    }

    renderUnlistedPattern(
      time,
      pattern
    );
  }


  function handleAnalyzerSubmit(event) {
    event.preventDefault();

    if (!dom.timeInput) return;

    analyzeTime(
      dom.timeInput.value
    );
  }


  /* =======================================================
     11. MOBILE NAVIGATION
  ======================================================= */

  function openMenu() {
    if (
      !dom.menuToggle ||
      !dom.mainNav
    ) {
      return;
    }

    dom.mainNav.classList.add(
      "is-open"
    );

    dom.menuToggle.setAttribute(
      "aria-expanded",
      "true"
    );

    dom.menuToggle.setAttribute(
      "aria-label",
      "Fermer le menu"
    );
  }


  function closeMenu() {
    if (
      !dom.menuToggle ||
      !dom.mainNav
    ) {
      return;
    }

    dom.mainNav.classList.remove(
      "is-open"
    );

    dom.menuToggle.setAttribute(
      "aria-expanded",
      "false"
    );

    dom.menuToggle.setAttribute(
      "aria-label",
      "Ouvrir le menu"
    );
  }


  function toggleMenu() {
    if (!dom.mainNav) return;

    if (
      dom.mainNav.classList.contains(
        "is-open"
      )
    ) {
      closeMenu();
    } else {
      openMenu();
    }
  }


  function handleOutsideMenuClick(event) {
    if (
      !dom.mainNav ||
      !dom.menuToggle ||
      !dom.mainNav.classList.contains(
        "is-open"
      )
    ) {
      return;
    }

    if (
      dom.mainNav.contains(
        event.target
      ) ||
      dom.menuToggle.contains(
        event.target
      )
    ) {
      return;
    }

    closeMenu();
  }


  /* =======================================================
     12. HOMEPAGE DIRECTORY SEARCH
  ======================================================= */

  function parseSearchTime(value) {
    if (typeof value !== "string") {
      return null;
    }

    let cleaned =
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

    if (/^\d{4}$/.test(cleaned)) {
      cleaned =
        cleaned.slice(0, 2) +
        ":" +
        cleaned.slice(2);
    }

    return normalizeTime(cleaned);
  }


  function handleDirectorySubmit(event) {
    event.preventDefault();

    if (!dom.directoryInput) return;

    const time =
      parseSearchTime(
        dom.directoryInput.value
      );

    if (!time) {
      dom.directoryInput.setCustomValidity(
        "Saisissez une heure comme 11h11."
      );

      dom.directoryInput.reportValidity();

      window.setTimeout(() => {
        dom.directoryInput.setCustomValidity("");
      }, 100);

      return;
    }

    /*
      Use the analyzer first instead of blindly
      navigating to a potentially nonexistent page.
    */

    if (dom.timeInput) {
      dom.timeInput.value = time;
    }

    analyzeTime(time);
  }


  /* =======================================================
     13. URL QUERY SUPPORT
     Example:
     /?heure=11:11
     /?heure=11h11
  ======================================================= */

  function analyzeFromURL() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const requested =
      params.get("heure");

    if (!requested) return;

    const normalized =
      normalizeTime(requested);

    if (!normalized) return;

    if (dom.timeInput) {
      dom.timeInput.value =
        normalized;
    }

    analyzeTime(normalized);
  }


  /* =======================================================
     14. YEAR
  ======================================================= */

  function updateYear() {
    if (!dom.currentYear) return;

    dom.currentYear.textContent =
      String(
        new Date().getFullYear()
      );
  }


  /* =======================================================
     15. EVENT BINDING
  ======================================================= */

  function bindEvents() {
    dom.menuToggle?.addEventListener(
      "click",
      toggleMenu
    );

    dom.mainNav?.addEventListener(
      "click",
      (event) => {
        if (
          event.target.closest("a")
        ) {
          closeMenu();
        }
      }
    );

    document.addEventListener(
      "click",
      handleOutsideMenuClick
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape"
        ) {
          closeMenu();
        }
      }
    );

    dom.form?.addEventListener(
      "submit",
      handleAnalyzerSubmit
    );

    dom.resultTabs?.addEventListener(
      "click",
      handleTabClick
    );

    dom.resultTabs?.addEventListener(
      "keydown",
      handleTabKeyboard
    );

    dom.directoryForm?.addEventListener(
      "submit",
      handleDirectorySubmit
    );

    window.addEventListener(
      "resize",
      () => {
        if (
          window.innerWidth >= 900
        ) {
          closeMenu();
        }
      },
      {
        passive: true
      }
    );
  }


  /* =======================================================
     16. INITIALIZATION
  ======================================================= */

  async function init() {
    updateYear();
    bindEvents();

    /*
      Preload database after page becomes interactive.
      Failure is handled gracefully.
    */
    loadDatabase();

    analyzeFromURL();
  }


  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})();
/* Live countdown to the next double mirror hour */
(() => {
  const timeEl = document.getElementById("next-mirror-time");
  const countdownEl = document.getElementById("next-mirror-countdown");
  const linkEl = document.getElementById("next-mirror-link");

  if (!timeEl || !countdownEl || !linkEl) return;

  function updateNextMirror() {
    const now = new Date();
    let target = null;
    let hour = null;

    for (let h = 0; h < 24; h++) {
      const candidate = new Date(now);
      candidate.setHours(h, h, 0, 0);

      if (candidate > now) {
        target = candidate;
        hour = h;
        break;
      }
    }

    if (!target) {
      target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(0, 0, 0, 0);
      hour = 0;
    }

    const diff = Math.max(0, target.getTime() - now.getTime());

    const totalSeconds = Math.floor(diff / 1000);
    const hoursLeft = Math.floor(totalSeconds / 3600);
    const minutesLeft = Math.floor((totalSeconds % 3600) / 60);
    const secondsLeft = totalSeconds % 60;

    const hh = String(hour).padStart(2, "0");
    const mirror = `${hh}h${hh}`;

    timeEl.textContent = mirror;

    const parts = [];
    if (hoursLeft > 0) parts.push(`${hoursLeft} h`);
    if (minutesLeft > 0 || hoursLeft > 0) parts.push(`${minutesLeft} min`);
    parts.push(`${secondsLeft} s`);

    countdownEl.textContent = `Dans ${parts.join(" ")}`;
    linkEl.href = `/heure-miroir-${mirror}`;
  }

  updateNextMirror();
  setInterval(updateNextMirror, 1000);
})();
