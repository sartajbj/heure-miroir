/* =========================================================
   HEURE MIROIR PLUS
   File #05 — search.js
   Live hour search + autocomplete + clean URL navigation
   ========================================================= */

"use strict";

(() => {

  const CONFIG = {
    dataUrl: "/heures.json",
    maxSuggestions: 8
  };

  const searchInput =
    document.getElementById("directory-search");

  const searchForm =
    document.getElementById("directory-search-form");

  const suggestionsBox =
    document.getElementById("directory-suggestions");

  if (!searchInput || !suggestionsBox) {
    return;
  }


  /* =======================================================
     STATE
  ======================================================= */

  let hours = [];
  let filtered = [];
  let activeIndex = -1;
  let databaseLoaded = false;


  /* =======================================================
     HELPERS
  ======================================================= */

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function normalizeSearch(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[h:.]/g, "");
  }


  function normalizeTime(value) {
    const cleaned =
      normalizeSearch(value);

    if (!/^\d{1,4}$/.test(cleaned)) {
      return null;
    }

    let digits = cleaned;

    /*
      Examples:
      1111 -> 11:11
      0101 -> 01:01
    */
    if (digits.length === 4) {
      const hh = Number(digits.slice(0, 2));
      const mm = Number(digits.slice(2));

      if (
        hh >= 0 &&
        hh <= 23 &&
        mm >= 0 &&
        mm <= 59
      ) {
        return (
          String(hh).padStart(2, "0") +
          ":" +
          String(mm).padStart(2, "0")
        );
      }
    }

    /*
      Useful mobile shorthand:
      111 -> 01:11
      707 -> 07:07
    */
    if (digits.length === 3) {
      const hh = Number(digits.slice(0, 1));
      const mm = Number(digits.slice(1));

      if (
        hh >= 0 &&
        hh <= 9 &&
        mm >= 0 &&
        mm <= 59
      ) {
        return (
          "0" +
          hh +
          ":" +
          String(mm).padStart(2, "0")
        );
      }
    }

    return null;
  }


  function displayTime(value) {
    return String(value || "")
      .replace(":", "h");
  }


  function getEntryTime(entry) {
    if (!entry || typeof entry !== "object") {
      return "";
    }

    return (
      entry.heure ||
      entry.time ||
      entry.id ||
      ""
    );
  }


  function getEntryURL(entry) {
    if (
      entry &&
      typeof entry.url === "string" &&
      entry.url.trim()
    ) {
      return entry.url.trim();
    }

    const time =
      getEntryTime(entry);

    if (!time) {
      return "/toutes-les-heures";
    }

    return (
      "/heure-miroir-" +
      displayTime(time)
    );
  }


  function getEntryType(entry) {
    return (
      entry?.type ||
      entry?.categorie ||
      "Heure répertoriée"
    );
  }


  function getEntrySummary(entry) {
    return (
      entry?.resume ||
      entry?.summary ||
      ""
    );
  }


  /* =======================================================
     DATABASE
  ======================================================= */

  async function loadHours() {
    if (databaseLoaded) {
      return;
    }

    try {
      const response =
        await fetch(CONFIG.dataUrl, {
          headers: {
            Accept: "application/json"
          }
        });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const entries =
        Array.isArray(data)
          ? data
          : Array.isArray(data.heures)
            ? data.heures
            : [];

      hours =
        entries
          .filter((entry) => {
            return Boolean(
              getEntryTime(entry)
            );
          })
          .sort((a, b) => {
            return getEntryTime(a)
              .localeCompare(
                getEntryTime(b),
                "fr"
              );
          });

      databaseLoaded = true;

    } catch (error) {
      console.error(
        "Heure Miroir Plus — recherche indisponible :",
        error
      );

      hours = [];
      databaseLoaded = true;
    }
  }


  /* =======================================================
     SEARCH
  ======================================================= */

  function findMatches(query) {
    const normalized =
      normalizeSearch(query);

    if (!normalized) {
      return [];
    }

    return hours
      .filter((entry) => {

        const time =
          normalizeSearch(
            getEntryTime(entry)
          );

        const display =
          normalizeSearch(
            displayTime(
              getEntryTime(entry)
            )
          );

        const type =
          normalizeSearch(
            getEntryType(entry)
          );

        return (
          time.startsWith(normalized) ||
          display.startsWith(normalized) ||
          type.includes(normalized)
        );

      })
      .slice(
        0,
        CONFIG.maxSuggestions
      );
  }


  /* =======================================================
     SUGGESTIONS UI
  ======================================================= */

  function clearSuggestions() {
    filtered = [];
    activeIndex = -1;

    suggestionsBox.innerHTML = "";

    searchInput.removeAttribute(
      "aria-activedescendant"
    );
  }


  function renderSuggestions(matches) {
    filtered = matches;
    activeIndex = -1;

    if (!matches.length) {
      suggestionsBox.innerHTML = `
        <div class="search-empty">
          Aucune heure répertoriée trouvée.
        </div>
      `;

      return;
    }

    suggestionsBox.innerHTML =
      matches
        .map((entry, index) => {

          const time =
            displayTime(
              getEntryTime(entry)
            );

          const type =
            getEntryType(entry);

          const summary =
            getEntrySummary(entry);

          return `
            <button
              type="button"
              class="search-suggestion"
              id="hour-suggestion-${index}"
              data-index="${index}"
              role="option"
              aria-selected="false"
            >
              <span class="search-suggestion-main">
                <strong>
                  ${escapeHTML(time)}
                </strong>

                <span>
                  ${escapeHTML(type)}
                </span>
              </span>

              ${
                summary
                  ? `
                    <small>
                      ${escapeHTML(summary)}
                    </small>
                  `
                  : ""
              }
            </button>
          `;

        })
        .join("");
  }


  function setActiveSuggestion(index) {
    const buttons =
      suggestionsBox.querySelectorAll(
        ".search-suggestion"
      );

    if (!buttons.length) {
      return;
    }

    if (index < 0) {
      index =
        buttons.length - 1;
    }

    if (index >= buttons.length) {
      index = 0;
    }

    activeIndex = index;

    buttons.forEach(
      (button, buttonIndex) => {

        const active =
          buttonIndex === activeIndex;

        button.setAttribute(
          "aria-selected",
          String(active)
        );

        button.classList.toggle(
          "is-active",
          active
        );

      }
    );

    const activeButton =
      buttons[activeIndex];

    if (activeButton) {
      searchInput.setAttribute(
        "aria-activedescendant",
        activeButton.id
      );

      activeButton.scrollIntoView({
        block: "nearest"
      });
    }
  }


  /* =======================================================
     NAVIGATION
  ======================================================= */

  function navigateToEntry(entry) {
    if (!entry) {
      return;
    }

    const url =
      getEntryURL(entry);

    window.location.href = url;
  }


  function navigateExactInput() {
    const normalizedTime =
      normalizeTime(
        searchInput.value
      );

    if (!normalizedTime) {
      return false;
    }

    const exact =
      hours.find((entry) => {
        return (
          getEntryTime(entry) ===
          normalizedTime
        );
      });

    if (!exact) {
      return false;
    }

    navigateToEntry(exact);

    return true;
  }


  /* =======================================================
     INPUT
  ======================================================= */

  async function handleInput() {
    await loadHours();

    const value =
      searchInput.value.trim();

    if (!value) {
      clearSuggestions();
      return;
    }

    const matches =
      findMatches(value);

    renderSuggestions(matches);
  }


  /* =======================================================
     KEYBOARD
  ======================================================= */

  function handleKeydown(event) {
    const buttons =
      suggestionsBox.querySelectorAll(
        ".search-suggestion"
      );

    if (
      event.key === "ArrowDown"
    ) {
      if (!buttons.length) {
        return;
      }

      event.preventDefault();

      setActiveSuggestion(
        activeIndex + 1
      );

      return;
    }

    if (
      event.key === "ArrowUp"
    ) {
      if (!buttons.length) {
        return;
      }

      event.preventDefault();

      setActiveSuggestion(
        activeIndex - 1
      );

      return;
    }

    if (
      event.key === "Escape"
    ) {
      clearSuggestions();
      return;
    }

    if (
      event.key === "Enter" &&
      activeIndex >= 0
    ) {
      event.preventDefault();

      navigateToEntry(
        filtered[activeIndex]
      );
    }
  }


  /* =======================================================
     SUGGESTION CLICK
  ======================================================= */

  function handleSuggestionClick(event) {
    const button =
      event.target.closest(
        ".search-suggestion"
      );

    if (!button) {
      return;
    }

    const index =
      Number(
        button.dataset.index
      );

    if (
      !Number.isInteger(index) ||
      !filtered[index]
    ) {
      return;
    }

    navigateToEntry(
      filtered[index]
    );
  }


  /* =======================================================
     FORM SUBMIT
  ======================================================= */

  async function handleSubmit(event) {
    /*
      app.js also listens to this form.

      Stop propagation here so search.js owns
      directory-search submission once loaded.
    */
    event.preventDefault();
    event.stopImmediatePropagation();

    await loadHours();

    if (activeIndex >= 0) {
      navigateToEntry(
        filtered[activeIndex]
      );

      return;
    }

    if (navigateExactInput()) {
      return;
    }

    /*
      No published page exists for the exact input.

      Send it to the homepage analyzer instead of
      inventing a nonexistent clean URL.
    */
    const raw =
      searchInput.value.trim();

    if (!raw) {
      searchInput.focus();
      return;
    }

    const normalized =
      normalizeTime(raw);

    if (normalized) {
      const currentPath =
        window.location.pathname;

      if (
        currentPath === "/" ||
        currentPath === "/index.html"
      ) {
        const analyzer =
          document.getElementById(
            "heure-input"
          );

        const analyzerForm =
          document.getElementById(
            "heure-form"
          );

        if (
          analyzer &&
          analyzerForm
        ) {
          analyzer.value =
            normalized;

          analyzerForm.requestSubmit();

          clearSuggestions();

          return;
        }
      }

      window.location.href =
        "/?heure=" +
        encodeURIComponent(
          normalized
        );

      return;
    }

    searchInput.setCustomValidity(
      "Saisissez une heure comme 11h11, 11:11 ou 1111."
    );

    searchInput.reportValidity();

    window.setTimeout(() => {
      searchInput.setCustomValidity("");
    }, 100);
  }


  /* =======================================================
     OUTSIDE CLICK
  ======================================================= */

  function handleOutsideClick(event) {
    if (
      searchInput.contains(
        event.target
      ) ||
      suggestionsBox.contains(
        event.target
      )
    ) {
      return;
    }

    clearSuggestions();
  }


  /* =======================================================
     ACCESSIBILITY
  ======================================================= */

  function setupAccessibility() {
    searchInput.setAttribute(
      "autocomplete",
      "off"
    );

    searchInput.setAttribute(
      "role",
      "combobox"
    );

    searchInput.setAttribute(
      "aria-autocomplete",
      "list"
    );

    searchInput.setAttribute(
      "aria-controls",
      "directory-suggestions"
    );

    suggestionsBox.setAttribute(
      "role",
      "listbox"
    );

    suggestionsBox.setAttribute(
      "aria-label",
      "Suggestions d'heures"
    );
  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function bindEvents() {
    searchInput.addEventListener(
      "input",
      handleInput
    );

    searchInput.addEventListener(
      "keydown",
      handleKeydown
    );

    suggestionsBox.addEventListener(
      "click",
      handleSuggestionClick
    );

    searchForm?.addEventListener(
      "submit",
      handleSubmit
    );

    document.addEventListener(
      "click",
      handleOutsideClick
    );
  }


  /* =======================================================
     INIT
  ======================================================= */

  function init() {
    setupAccessibility();
    bindEvents();

    /*
      Start fetching quietly so suggestions
      feel instant on first interaction.
    */
    loadHours();
  }


  init();

})();
