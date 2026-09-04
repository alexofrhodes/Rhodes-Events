(() => {
  "use strict";

  const SETTINGS_KEY = "events-site-settings-v1";
  const ALL_VIEWS = ["cards", "rails", "table", "posters", "calendar", "map", "starred"];
  const ALL_FILTERS = ["search", "categories", "venues", "toggles"];
  const VIEW_LABELS = {
    cards: "Cards",
    rails: "Rails",
    table: "Table",
    posters: "Posters",
    calendar: "Calendar",
    map: "Map",
    starred: "Starred",
  };
  const FILTER_LABELS = {
    search: "Search",
    categories: "Categories",
    venues: "Venues",
    toggles: "Event toggles",
  };
  const CAL_MODES = ["month", "week", "day", "agenda"];
  const RAILS_LAYOUTS = ["days", "cards"];
  const THEMES = ["light", "dark", "system"];
  const THEME_LABELS = { light: "Light", dark: "Dark", system: "System" };
  const THEME_ICON_PATHS = {
    light:
      "M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10-9h2V1h-2v3zm9.04-.55l-1.41-1.41-1.79 1.8 1.41 1.41 1.79-1.8zM17.24 18.16l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 11v2h3v-2h-3zm-8 9h2v3h-2v-3zM4.96 19.55l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8zM12 6a6 6 0 1 0 0 12A6 6 0 0 0 12 6z",
    dark: "M12 2a10 10 0 1 0 10 10A8 8 0 0 1 12 2z",
    system:
      "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9H4V6zm0 11h16v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1zm6 2h4v1h-4v-1z",
  };
  const LANG_FLAGS = { en: "icons/flag-gb.svg", el: "icons/flag-gr.svg" };

  const state = {
    data: null,
    events: [],
    filtered: [],
    view: "cards",
    density: "cards",
    calMode: "month",
    railsLayout: "days",
    railsHorizon: "",
    railsLoading: false,
    focusMonth: null,
    agendaDay: "",
    categories: new Set(),
    venues: new Set(),
    catMode: "or",
    search: "",
    dateFrom: "",
    dateTo: "",
    hideAllDay: false,
    hideMultiDay: false,
    starred: new Set(),
    cardsPerRow: 3,
    groupToolbar: true,
    lang: "en",
    theme: "system",
    rawEvents: [],
    enabledViews: new Set(ALL_VIEWS),
    hiddenViews: new Set(),
    hiddenFilters: new Set(),
    printEnabled: true,
    prevView: "cards",
    map: null,
    clusters: null,
    miniMap: null,
    calendar: null,
    selected: null,
    heroSrc: "",
    deferredInstall: null,
    _ignoreDatesSet: false,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function parseEnabledViews() {
    const list = window.SITE_VIEWS;
    if (Array.isArray(list) && list.length) {
      const set = new Set();
      list.forEach((row) => {
        if (!Array.isArray(row) || row.length < 2) return;
        const name = String(row[0] || "").toLowerCase();
        if (ALL_VIEWS.includes(name) && row[1]) set.add(name);
      });
      return set.size ? set : new Set(ALL_VIEWS);
    }
    const raw = (document.body.dataset.views || "").trim();
    if (!raw) return new Set(ALL_VIEWS);
    const set = new Set(
      raw
        .split(/[\s,]+/)
        .map((v) => v.trim().toLowerCase())
        .filter((v) => ALL_VIEWS.includes(v))
    );
    return set.size ? set : new Set(ALL_VIEWS);
  }

  function parsePrintEnabled() {
    if (typeof window.SITE_PRINT === "boolean") return window.SITE_PRINT;
    const raw = (document.body.dataset.print || "true").trim().toLowerCase();
    return !["0", "false", "off", "no"].includes(raw);
  }

  function applyViewConfig() {
    $$(".top .views > .view-btn").forEach((btn) => {
      btn.classList.toggle("hidden", !viewIsAvailable(btn.dataset.view));
    });
    $$(".top-view-btn").forEach((btn) => {
      btn.classList.toggle("hidden", !viewIsAvailable(btn.dataset.view));
    });
    syncViewsDropdown();
    updatePrintButton();
    applyFilterVisibility();
    requestAnimationFrame(refreshHScrollFades);
  }

  function viewIsAvailable(name) {
    return state.enabledViews.has(name) && !state.hiddenViews.has(name);
  }

  function applyFilterVisibility() {
    ALL_FILTERS.forEach((key) => {
      $$(`[data-filter="${key}"]`).forEach((el) => {
        el.classList.toggle("ui-hidden", state.hiddenFilters.has(key));
      });
    });
    const catsBtn = $("#btn-cats");
    if (catsBtn) catsBtn.classList.toggle("ui-hidden", state.hiddenFilters.has("categories"));
    const venuesBtn = $("#btn-venues");
    if (venuesBtn) venuesBtn.classList.toggle("ui-hidden", state.hiddenFilters.has("venues"));
    const togglesBtn = $("#btn-event-toggles");
    if (togglesBtn) togglesBtn.classList.toggle("ui-hidden", state.hiddenFilters.has("toggles"));
    requestAnimationFrame(refreshHScrollFades);
  }

  function viewLabel(name) {
    const btn = $(`.top .views > .view-btn[data-view="${name}"]`);
    return (btn && btn.textContent.trim()) || name;
  }

  function syncViewsDropdown() {
    $$(".top .views > .view-btn").forEach((btn) => {
      const on = btn.dataset.view === state.view;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function closeViewsDropdown() {}

  function closeLangDropdown() {
    $("#lang-dd-menu")?.classList.add("hidden");
    $("#lang-dd-btn")?.setAttribute("aria-expanded", "false");
  }

  function closeThemeDropdown() {
    $("#theme-dd-menu")?.classList.add("hidden");
    $("#theme-dd-btn")?.setAttribute("aria-expanded", "false");
  }

  function closeActionDropdowns() {
    closeLangDropdown();
    closeThemeDropdown();
    closeShareDropdown();
  }

  function toggleLangDropdown(e) {
    if (e) e.stopPropagation();
    const menu = $("#lang-dd-menu");
    const btn = $("#lang-dd-btn");
    if (!menu || !btn) return;
    const open = menu.classList.contains("hidden");
    closeThemeDropdown();
    if (open) {
      menu.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
    } else {
      closeLangDropdown();
    }
  }

  function toggleThemeDropdown(e) {
    if (e) e.stopPropagation();
    const menu = $("#theme-dd-menu");
    const btn = $("#theme-dd-btn");
    if (!menu || !btn) return;
    const open = menu.classList.contains("hidden");
    closeLangDropdown();
    if (open) {
      menu.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
    } else {
      closeThemeDropdown();
    }
  }

  function bindLongPress(el, { onShort, onLong, ms = 550 } = {}) {
    if (!el) return;
    let timer = null;
    let firedLong = false;
    const clear = () => {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    };
    el.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      firedLong = false;
      clear();
      timer = setTimeout(() => {
        firedLong = true;
        if (onLong) onLong(e);
      }, ms);
    });
    el.addEventListener("pointerup", (e) => {
      clear();
      if (!firedLong && onShort) onShort(e);
    });
    el.addEventListener("pointerleave", clear);
    el.addEventListener("pointercancel", clear);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function bindSwipeCycle(el, { onCycle, onTap, threshold = 28 } = {}) {
    if (!el) return;
    let x0 = null;
    let y0 = null;
    let pid = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      x0 = e.clientX;
      y0 = e.clientY;
      pid = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    const finish = (e) => {
      if (x0 == null || (pid != null && e.pointerId !== pid)) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      x0 = null;
      y0 = null;
      pid = null;
      if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.2) {
        e.preventDefault();
        e.stopPropagation();
        if (onCycle) onCycle(dx < 0 ? 1 : -1);
        return;
      }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && onTap) onTap(e);
    };
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", () => {
      x0 = null;
      y0 = null;
      pid = null;
    });
  }

  function cycleLang(dir) {
    const langs = ["en", "el"];
    const i = Math.max(0, langs.indexOf(state.lang));
    setLang(langs[(i + dir + langs.length) % langs.length]);
  }

  function cycleTheme(dir) {
    const i = Math.max(0, THEMES.indexOf(state.theme));
    setTheme(THEMES[(i + dir + THEMES.length) % THEMES.length]);
  }

  function applyToolbarLayout() {
    document.body.classList.remove("toolbar-rail");
    requestAnimationFrame(refreshHScrollFades);
  }

  function updateTogglesButton() {
    const btn = $("#btn-event-toggles");
    if (!btn) return;
    btn.classList.toggle("active", state.hideAllDay || state.hideMultiDay);
  }

  function updatePrintButton() {
    const printItem = $("#share-dd-print");
    if (printItem) printItem.classList.toggle("hidden", !state.printEnabled || state.view === "rails");
  }

  function siteShareUrl() {
    return `${location.origin}${location.pathname}${location.search}`;
  }

  function closeShareDropdown() {
    $("#share-dd-menu")?.classList.add("hidden");
    $("#btn-share-site")?.setAttribute("aria-expanded", "false");
  }

  function openShareDropdown() {
    const menu = $("#share-dd-menu");
    const btn = $("#btn-share-site");
    if (!menu || !btn) return;
    const url = siteShareUrl();
    const title = document.title || "Events";
    const wa = menu.querySelector('[data-site-share="whatsapp"]');
    const fb = menu.querySelector('[data-site-share="facebook"]');
    const x = menu.querySelector('[data-site-share="x"]');
    const mail = menu.querySelector('[data-site-share="mail"]');
    if (wa) wa.href = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
    if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    if (x) x.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    if (mail) mail.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
    const nativeBtn = menu.querySelector('[data-site-share="native"]');
    if (nativeBtn) nativeBtn.classList.toggle("hidden", !navigator.share);
    menu.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
  }

  function toggleShareDropdown(e) {
    if (e) e.stopPropagation();
    closeLangDropdown();
    closeThemeDropdown();
    const menu = $("#share-dd-menu");
    if (!menu) return;
    if (menu.classList.contains("hidden")) openShareDropdown();
    else closeShareDropdown();
  }

  async function shareSiteNative() {
    const url = siteShareUrl();
    const title = document.title || "Events";
    if (!navigator.share) return false;
    try {
      await navigator.share({ title, url, text: title });
      return true;
    } catch (_) {
      return false;
    }
  }

  async function onShareSiteClick(e) {
    if (e) e.stopPropagation();
    /* Mobile/desktop with Web Share: one-tap system sheet; else compact menu */
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      const ok = await shareSiteNative();
      if (ok) {
        closeShareDropdown();
        return;
      }
    }
    toggleShareDropdown(e);
  }

  function firstEnabledView() {
    return ALL_VIEWS.find((v) => viewIsAvailable(v)) || "cards";
  }

  function firstEnabledBrowseView() {
    return (
      ["cards", "rails", "table", "posters", "calendar"].find((v) => viewIsAvailable(v)) ||
      firstEnabledView()
    );
  }

  function toggleTopView(name) {
    if (!name) return;
    if (name === "list") name = "cards";
    if (state.view === name) {
      setView(state.prevView || firstEnabledBrowseView());
      return;
    }
    if (state.view !== "map" && state.view !== "starred") {
      state.prevView = state.view;
    }
    setView(name);
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;
      if (data.view === "list") data.view = "cards";
      if (ALL_VIEWS.includes(data.view)) state.view = data.view;
      state.density = state.view === "table" ? "table" : "cards";
      const month = data.focusMonth || data.listMonth;
      if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) state.focusMonth = month;
      if (Array.isArray(data.categories)) state.categories = new Set(data.categories.filter(Boolean));
      if (Array.isArray(data.venues)) state.venues = new Set(data.venues.filter(Boolean));
      else if (typeof data.location === "string" && data.location) state.venues = new Set([data.location]);
      if (typeof data.search === "string") state.search = data.search;
      if (typeof data.dateFrom === "string") state.dateFrom = data.dateFrom;
      if (typeof data.dateTo === "string") state.dateTo = data.dateTo;
      state.hideAllDay = Boolean(data.hideAllDay);
      state.hideMultiDay = Boolean(data.hideMultiDay);
      if (Array.isArray(data.starred)) {
        state.starred = new Set(data.starred.filter(Boolean).map(String));
      }
      if ([1, 2, 3].includes(Number(data.cardsPerRow))) {
        state.cardsPerRow = Number(data.cardsPerRow);
      } else if (Number(data.cardsPerRow) === 4) {
        state.cardsPerRow = 3;
      }
      if (typeof data.groupToolbar === "boolean") state.groupToolbar = data.groupToolbar;
      if (data.lang === "en" || data.lang === "el") state.lang = data.lang;
      if (THEMES.includes(data.theme)) state.theme = data.theme;
      if (CAL_MODES.includes(data.calMode)) state.calMode = data.calMode;
      if (RAILS_LAYOUTS.includes(data.railsLayout)) state.railsLayout = data.railsLayout;
      if (typeof data.railsHorizon === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.railsHorizon)) {
        state.railsHorizon = data.railsHorizon;
      }
      if (data.catMode === "and" || data.catMode === "or") state.catMode = data.catMode;
      if (Array.isArray(data.hiddenViews)) {
        state.hiddenViews = new Set(data.hiddenViews.filter((v) => ALL_VIEWS.includes(v)));
      }
      if (Array.isArray(data.hiddenFilters)) {
        state.hiddenFilters = new Set(data.hiddenFilters.filter((v) => ALL_FILTERS.includes(v)));
      }
    } catch (_) {
      /* ignore */
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          view: state.view,
          focusMonth: state.focusMonth,
          categories: [...state.categories],
          venues: [...state.venues],
          catMode: state.catMode,
          search: state.search,
          dateFrom: state.dateFrom,
          dateTo: state.dateTo,
          hideAllDay: state.hideAllDay,
          hideMultiDay: state.hideMultiDay,
          starred: [...state.starred],
          cardsPerRow: state.cardsPerRow,
          groupToolbar: state.groupToolbar,
          lang: state.lang,
          theme: state.theme,
          calMode: state.calMode,
          railsLayout: state.railsLayout,
          railsHorizon: state.railsHorizon,
          hiddenViews: [...state.hiddenViews],
          hiddenFilters: [...state.hiddenFilters],
        })
      );
    } catch (_) {
      /* ignore */
    }
  }

  function pickLocalized(ev, base) {
    const active = (ev[base] || "").trim();
    const original = (ev[`${base}Original`] || "").trim();
    const translated = (ev[`${base}Translated`] || "").trim();
    if (state.lang === "el") return original || active || translated;
    return translated || active || original;
  }

  function projectEvent(ev) {
    return {
      ...ev,
      title: pickLocalized(ev, "title"),
      notes: pickLocalized(ev, "notes"),
      location:
        state.lang === "el"
          ? (ev.locationOriginal || ev.location || ev.locationTranslated || "").trim()
          : (ev.locationTranslated || ev.location || ev.locationOriginal || "").trim(),
    };
  }

  function rebuildEventsFromLang() {
    const source = state.rawEvents.length
      ? state.rawEvents
      : Array.isArray(state.data && state.data.events)
        ? state.data.events
        : [];
    state.events = source.map(projectEvent).sort(sortSoonest);
  }

  function syncLangButtons() {
    const flag = $("#lang-dd-flag");
    if (flag) flag.src = LANG_FLAGS[state.lang] || LANG_FLAGS.en;
    const btn = $("#lang-dd-btn");
    if (btn) {
      btn.title = state.lang === "el" ? "Ελληνικά" : "English";
      btn.setAttribute("aria-label", btn.title);
    }
    $$("#lang-dd-menu [data-lang]").forEach((item) => {
      item.classList.toggle("active", item.dataset.lang === state.lang);
    });
    document.documentElement.lang = state.lang === "el" ? "el" : "en";
  }

  function syncThemeUi() {
    document.documentElement.setAttribute("data-theme", state.theme);
    const icon = $("#theme-dd-icon");
    if (icon) {
      const path = THEME_ICON_PATHS[state.theme] || THEME_ICON_PATHS.system;
      icon.innerHTML = `<path fill="currentColor" d="${path}"/>`;
    }
    const btn = $("#theme-dd-btn");
    if (btn) {
      btn.title = THEME_LABELS[state.theme] || "Theme";
      btn.setAttribute("aria-label", btn.title);
    }
    $$("#theme-dd-menu [data-theme-choice]").forEach((item) => {
      item.classList.toggle("active", item.dataset.themeChoice === state.theme);
    });
  }

  function setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    state.theme = theme;
    syncThemeUi();
    saveSettings();
    closeThemeDropdown();
  }

  function setLang(lang) {
    if (lang !== "en" && lang !== "el") return;
    const changed = state.lang !== lang;
    state.lang = lang;
    if (changed) state.venues.clear();
    rebuildEventsFromLang();
    syncLangButtons();
    saveSettings();
    renderCategoryPicker();
    renderLocationFilter();
    applyFilters();
    tickClock();
    renderUpdateInfo();
    if (state.selected) {
      const id = state.selected.id;
      if (!$("#detail").classList.contains("hidden")) openDetail(id);
    }
    closeLangDropdown();
  }

  function applySettingsToForm() {
    $("#search").value = state.search || "";
    $("#date-from").value = state.dateFrom || "";
    $("#date-to").value = state.dateTo || "";
    $("#hide-allday").checked = state.hideAllDay;
    $("#hide-multiday").checked = state.hideMultiDay;
    updateTogglesButton();
    applyCardsPerRow();
  }

  function applyCardsPerRow() {
    const n = [1, 2, 3].includes(state.cardsPerRow) ? state.cardsPerRow : 3;
    state.cardsPerRow = n;
    document.documentElement.style.setProperty("--cards-per-row", String(n));
  }

  function updateRangeBtn() {
    /* date control lives in month picker */
  }

  function todayISO() {
    return isoDate(new Date());
  }

  function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseISO(value) {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function addDays(date, n) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }

  function eventStart(ev) {
    return ev.date || "";
  }

  function eventEnd(ev) {
    return ev.endDate || ev.date || "";
  }

  function isMultiDay(ev) {
    return Boolean(ev.endDate && ev.endDate !== ev.date);
  }

  function isAllDay(ev) {
    return !ev.time;
  }

  function overlapsCustomRange(ev) {
    const start = eventStart(ev);
    const end = eventEnd(ev);
    if (!start) return false;
    if (state.dateFrom && end < state.dateFrom) return false;
    if (state.dateTo && start > state.dateTo) return false;
    return true;
  }

  function fmtWhen(ev) {
    const start = parseISO(ev.date);
    if (!start) return ev.time || "";
    const opts = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
    let text = start.toLocaleDateString(undefined, opts);
    if (ev.endDate && ev.endDate !== ev.date) {
      const end = parseISO(ev.endDate);
      if (end) text += ` – ${end.toLocaleDateString(undefined, opts)}`;
    }
    if (ev.time) text += ` · ${ev.time}`;
    return text;
  }

  function imageUrl(ev, thumb) {
    const path = thumb ? ev.thumb || ev.image : ev.image || ev.thumb;
    return path || "";
  }

  function navigateUrl(ev) {
    if (ev.lat == null || ev.lng == null) return "";
    return `https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}`;
  }

  function sortSoonest(a, b) {
    return (
      (a.date || "").localeCompare(b.date || "") ||
      (a.time || "").localeCompare(b.time || "") ||
      (a.title || "").localeCompare(b.title || "")
    );
  }

  function monthKey(ev) {
    return (ev.date || "").slice(0, 7);
  }

  function monthLabelFromKey(key) {
    const [y, m] = (key || "").split("-").map(Number);
    if (!y || !m) return key || "";
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function monthKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function isStarred(id) {
    return state.starred.has(String(id || ""));
  }

  function toggleStar(id, ev) {
    if (ev) ev.stopPropagation();
    const key = String(id || "");
    if (!key) return;
    if (state.starred.has(key)) state.starred.delete(key);
    else state.starred.add(key);
    saveSettings();
    syncStarButtons(key);
    if (state.view === "starred") applyFilters();
  }

  function starButton(id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "star-btn";
    btn.dataset.star = String(id || "");
    btn.setAttribute("aria-label", isStarred(id) ? "Unstar event" : "Star event");
    btn.setAttribute("aria-pressed", isStarred(id) ? "true" : "false");
    btn.textContent = isStarred(id) ? "★" : "☆";
    btn.addEventListener("click", (e) => toggleStar(id, e));
    return btn;
  }

  function clearAllStars() {
    if (!state.starred.size) return;
    state.starred.clear();
    saveSettings();
    $$(".star-btn").forEach((btn) => {
      btn.textContent = "☆";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Star event");
    });
    if (state.view === "starred") applyFilters();
  }

  function syncStarButtons(id) {
    const on = isStarred(id);
    const key = String(id);
    $$(".star-btn").forEach((btn) => {
      if (String(btn.dataset.star || "") !== key) return;
      btn.textContent = on ? "★" : "☆";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "Unstar event" : "Star event");
    });
  }

  function matchesFilters(ev) {
    if (state.hideAllDay && isAllDay(ev)) return false;
    if (state.hideMultiDay && isMultiDay(ev)) return false;
    if (state.categories.size) {
      const cats = ev.category || [];
      const selected = [...state.categories];
      const ok =
        state.catMode === "and"
          ? selected.every((c) => cats.includes(c))
          : selected.some((c) => cats.includes(c));
      if (!ok) return false;
    }
    if (state.venues.size && !state.venues.has(ev.location || "")) return false;
    if (state.view !== "starred" && (state.dateFrom || state.dateTo)) {
      if (!overlapsCustomRange(ev)) return false;
    }
    if (state.search) {
      const hay = [ev.title, ev.location, ev.artist, ev.notes, ...(ev.category || [])]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    return true;
  }

  function applyFilters() {
    let list = state.events.filter(matchesFilters);
    if (state.view === "starred") {
      const today = todayISO();
      list = list.filter((ev) => isStarred(ev.id) && eventEnd(ev) >= today);
    }
    state.filtered = list.sort(sortSoonest);
    ensureFocusMonth();
    saveSettings();
    renderAll();
  }

  function availableMonthKeys() {
    return [...new Set(state.filtered.map(monthKey).filter(Boolean))].sort();
  }

  function ensureFocusMonth() {
    if (state.focusMonth && /^\d{4}-\d{2}$/.test(state.focusMonth)) return;
    const keys = availableMonthKeys();
    const now = monthKeyFromDate(new Date());
    state.focusMonth = keys.includes(now) ? now : keys[0] || now;
  }

  function setFocusMonth(key, fromCalendar = false) {
    if (!key || !/^\d{4}-\d{2}$/.test(key)) return;
    const changed = key !== state.focusMonth;
    state.focusMonth = key;
    if (!fromCalendar) {
      syncRangeToFocusMonth();
      updateRangeBtn();
    }
    if (changed) saveSettings();
    if (!fromCalendar && state.view === "calendar") {
      const today = todayISO();
      if (!state.agendaDay || state.agendaDay.slice(0, 7) !== key) {
        state.agendaDay = today.slice(0, 7) === key ? today : `${key}-01`;
      }
    }
    syncOpenPickersToFocusMonth();
    if (fromCalendar) {
      updateMonthNav();
      return;
    }
    applyFilters();
  }

  function syncRangeToFocusMonth() {
    const key = state.focusMonth;
    if (!key || !/^\d{4}-\d{2}$/.test(key)) return;
    const [y, m] = key.split("-").map(Number);
    const first = `${key}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const last = `${key}-${String(lastDay).padStart(2, "0")}`;
    const today = todayISO();
    let from = first;
    if (from < today && last >= today) from = today;
    state.dateFrom = from;
    state.dateTo = last;
    const fromEl = $("#date-from");
    const toEl = $("#date-to");
    if (fromEl) fromEl.value = state.dateFrom;
    if (toEl) toEl.value = state.dateTo;
  }

  function syncOpenPickersToFocusMonth() {
    const key = state.focusMonth;
    if (!key || !/^\d{4}-\d{2}$/.test(key)) return;
    const [y, m] = key.split("-").map(Number);
    const rangePopup = $("#range-popup");
    if (rangePopup && !rangePopup.classList.contains("hidden")) {
      rangeState.monthL = new Date(y, m - 1, 1);
      renderDatesPopup();
    }
  }

  function setView(name) {
    if (!name) return;
    if (name === "list") name = "cards";
    if (!viewIsAvailable(name)) name = firstEnabledView();
    state.view = name;
    const isBrowse = name === "cards" || name === "table";
    const isList = isBrowse || name === "starred";
    const usesMonthNav = isList || name === "posters";
    state.density = name === "table" ? "table" : "cards";
    document.body.classList.toggle("view-map", name === "map");
    document.body.classList.toggle("view-list", isBrowse);
    document.body.classList.toggle("view-rails", name === "rails");
    document.body.classList.toggle("view-starred", name === "starred");
    document.body.classList.toggle("view-calendar", name === "calendar");
    document.body.classList.toggle("view-posters", name === "posters");
    $("#month-nav").classList.toggle("hidden", name === "rails" || !usesMonthNav);
    $("#month-prev").classList.toggle("hidden", name === "starred");
    $("#month-next").classList.toggle("hidden", name === "starred");
    const clearStars = $("#stars-clear");
    if (clearStars) clearStars.classList.toggle("hidden", name !== "starred");
    const dateFrom = $("#date-from");
    const dateTo = $("#date-to");
    if (dateFrom) dateFrom.disabled = name === "starred";
    if (dateTo) dateTo.disabled = name === "starred";
    $$(".top .views > .view-btn").forEach((btn) => {
      const on = btn.dataset.view === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".top-view-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    syncViewsDropdown();
    closeViewsDropdown();
    ["list", "rails", "calendar", "map", "posters"].forEach((id) => {
      const el = $(`#view-${id}`);
      if (!el) return;
      const on = id === "list" ? isList : id === name;
      el.classList.toggle("active", on);
      el.hidden = !on;
    });
    saveSettings();
    updatePrintButton();
    applyFilters();
    if (name === "map") {
      requestAnimationFrame(() => {
        ensureMap();
        if (state.map) state.map.invalidateSize();
        const focus = state._mapFocus;
        state._mapFocus = null;
        if (focus && focus.lat != null && focus.lng != null && state.map) {
          state.map.setView([Number(focus.lat), Number(focus.lng)], 15);
          const focused = findEvent(focus.id);
          if (focused) showMapSheet(focused);
        } else {
          fitMap();
        }
      });
    }
    if (name === "rails") {
      ensureRailsHorizon();
      requestAnimationFrame(() => renderRails());
    }
    if (name === "calendar") {
      requestAnimationFrame(() => {
        ensureCalendar();
        setFocusMonth(state.focusMonth || monthKeyFromDate(new Date()), true);
        if (!state.agendaDay) state.agendaDay = todayISO();
        applyCalMode(state.calMode, true);
      });
    }
  }

  function allCategories() {
    const cats = new Set();
    state.events.forEach((ev) => (ev.category || []).forEach((c) => cats.add(c)));
    return [...cats].sort((a, b) => a.localeCompare(b));
  }

  function syncFilterAllBtn(sel, size) {
    const btn = $(sel);
    if (!btn) return;
    btn.disabled = !size;
  }

  function updateCatButton() {
    const topBtn = $("#btn-cats");
    const n = state.categories.size;
    if (topBtn) topBtn.classList.toggle("active", n > 0);
    syncCatModeButtons();
  }

  function updateLocButton() {
    const topBtn = $("#btn-venues");
    const n = state.venues.size;
    if (topBtn) topBtn.classList.toggle("active", n > 0);
  }

  function syncCatModeButtons() {
    $$("[data-cat-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.catMode === state.catMode);
    });
  }

  function countEventsWithCategory(cat) {
    return state.events.filter((ev) => (ev.category || []).includes(cat)).length;
  }

  function countEventsAtVenue(loc) {
    return state.events.filter((ev) => (ev.location || "") === loc).length;
  }

  function filterCheckLabels(hostSel, query) {
    const q = (query || "").trim().toLowerCase();
    $$(`${hostSel} label`).forEach((label) => {
      const text = (label.textContent || "").toLowerCase();
      label.classList.toggle("hidden", Boolean(q) && !text.includes(q));
    });
  }

  function renderCategoryPicker() {
    const list = allCategories();
    const host = $("#cat-checks");
    if (!host) return;
    host.innerHTML = "";
    if (!list.length) {
      $("#btn-cats")?.classList.add("hidden");
      state.categories.clear();
      updateCatButton();
      return;
    }
    if (!$("#btn-cats")?.classList.contains("ui-hidden")) {
      $("#btn-cats")?.classList.remove("hidden");
    }
    [...state.categories].forEach((c) => {
      if (!list.includes(c)) state.categories.delete(c);
    });
    list.forEach((cat) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = cat;
      input.checked = state.categories.has(cat);
      input.addEventListener("change", () => {
        if (input.checked) state.categories.add(cat);
        else state.categories.delete(cat);
        updateCatButton();
        applyFilters();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(`${cat} (${countEventsWithCategory(cat)})`));
      host.appendChild(label);
    });
    filterCheckLabels("#cat-checks", ($("#cat-search") || {}).value);
    updateCatButton();
  }

  function allVenues() {
    return [...new Set(state.events.map((e) => e.location).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function renderLocationFilter() {
    const list = allVenues();
    const host = $("#loc-checks");
    if (!host) return;
    host.innerHTML = "";
    if (list.length < 2) {
      $("#btn-venues")?.classList.add("hidden");
      state.venues.clear();
      updateLocButton();
      return;
    }
    if (!$("#btn-venues")?.classList.contains("ui-hidden")) {
      $("#btn-venues")?.classList.remove("hidden");
    }
    [...state.venues].forEach((v) => {
      if (!list.includes(v)) state.venues.delete(v);
    });
    list.forEach((loc) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = loc;
      input.checked = state.venues.has(loc);
      input.addEventListener("change", () => {
        if (input.checked) state.venues.add(loc);
        else state.venues.delete(loc);
        updateLocButton();
        applyFilters();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(`${loc} (${countEventsAtVenue(loc)})`));
      host.appendChild(label);
    });
    filterCheckLabels("#loc-checks", ($("#loc-search") || {}).value);
    updateLocButton();
  }

  function toggleCategoryFilter(name, { closeDetailAfter = false } = {}) {
    const cat = String(name || "").trim();
    if (!cat) return;
    if (state.categories.has(cat)) state.categories.delete(cat);
    else state.categories.add(cat);
    $$("#cat-checks input").forEach((input) => {
      if (input.value === cat) input.checked = state.categories.has(cat);
    });
    updateCatButton();
    saveSettings();
    if (closeDetailAfter) closeDetail();
    applyFilters();
  }

  function clearCategoryFilter() {
    state.categories.clear();
    $$("#cat-checks input").forEach((input) => {
      input.checked = false;
    });
    updateCatButton();
    applyFilters();
  }

  function clearLocationFilter() {
    state.venues.clear();
    $$("#loc-checks input").forEach((input) => {
      input.checked = false;
    });
    updateLocButton();
    applyFilters();
  }

  function closeFilterPopups() {
    $("#cat-popup")?.classList.add("hidden");
    $("#loc-popup")?.classList.add("hidden");
    $("#toggles-popup")?.classList.add("hidden");
    $("#btn-cats")?.setAttribute("aria-expanded", "false");
    $("#btn-venues")?.setAttribute("aria-expanded", "false");
    $("#btn-event-toggles")?.setAttribute("aria-expanded", "false");
    removeBackdrop();
  }

  function toggleFilterPopup(popupSel, btnSel, e) {
    if (e) e.stopPropagation();
    closeActionDropdowns();
    const popup = $(popupSel);
    const btn = $(btnSel);
    if (!popup) return;
    const wasOpen = !popup.classList.contains("hidden");
    $("#cat-popup")?.classList.add("hidden");
    $("#loc-popup")?.classList.add("hidden");
    $("#toggles-popup")?.classList.add("hidden");
    $("#btn-cats")?.setAttribute("aria-expanded", "false");
    $("#btn-venues")?.setAttribute("aria-expanded", "false");
    $("#btn-event-toggles")?.setAttribute("aria-expanded", "false");
    if (!wasOpen) {
      if (popupSel === "#cat-popup") renderCategoryPicker();
      if (popupSel === "#loc-popup") renderLocationFilter();
      popup.classList.remove("hidden");
      if (btn) btn.setAttribute("aria-expanded", "true");
      addBackdrop(popup, closeFilterPopups);
    } else {
      closeFilterPopups();
    }
  }

  function updateHScrollFade(wrap) {
    if (!wrap) return;
    const scroller = wrap.querySelector(".hscroll");
    const start = wrap.querySelector('[data-hscroll-fade="start"]');
    const end = wrap.querySelector('[data-hscroll-fade="end"]');
    if (!scroller) return;
    const canScroll = scroller.scrollWidth > scroller.clientWidth + 4;
    const atStart = scroller.scrollLeft <= 4;
    const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
    if (start) start.classList.toggle("hidden", !canScroll || atStart);
    if (end) end.classList.toggle("hidden", !canScroll || atEnd);
  }

  function bindHScroll(wrap) {
    if (!wrap) return;
    const scroller = wrap.querySelector(".hscroll");
    if (!scroller) return;
    const update = () => updateHScrollFade(wrap);
    scroller.addEventListener("scroll", update, { passive: true });
    update();
  }

  function refreshHScrollFades() {
    $$(".hscroll-wrap").forEach(updateHScrollFade);
  }

  function chipPreviewHtml(categories, limit = 3) {
    const all = (categories || []).filter(Boolean);
    if (!all.length) return "";
    const selected = all.filter((c) => state.categories.has(c));
    const rest = all.filter((c) => !state.categories.has(c));
    const ordered = [...selected, ...rest];
    const shown = ordered.slice(0, limit);
    const extra = ordered.length - shown.length;
    let html = shown
      .map((c) => {
        const on = state.categories.has(c) ? " active" : "";
        return `<button type="button" class="chip${on}" data-cat="${escapeAttr(c)}">${escapeHtml(c)}</button>`;
      })
      .join("");
    if (extra > 0) {
      html += `<span class="chip chip-more" title="${escapeAttr(ordered.slice(limit).join(", "))}">+${extra}</span>`;
    }
    return html;
  }

  function cardButton(ev) {
    const article = document.createElement("article");
    article.className = "event-card";
    article.tabIndex = 0;
    const thumb = imageUrl(ev, true) || imageUrl(ev, false);
    const full = imageUrl(ev, false) || thumb;
    const cats = chipPreviewHtml(ev.category || [], 3);
    const imgHtml = thumb
      ? `<img class="thumb-img" src="${escapeAttr(thumb)}" alt="" loading="lazy" data-full="${escapeAttr(full)}" />`
      : "";
    article.innerHTML = `
      <div class="thumb">${imgHtml}</div>
      <div class="body">
        <h3>${escapeHtml(ev.title || "Untitled")}</h3>
        <p class="meta">${escapeHtml(fmtWhen(ev))}</p>
        <p class="meta">${escapeHtml(ev.location || "")}</p>
        <div class="card-chips">${cats}</div>
      </div>`;
    article.prepend(starButton(ev.id));
    article.querySelectorAll(".card-chips [data-cat]").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCategoryFilter(chip.dataset.cat);
      });
    });
    article.addEventListener("click", () => openDetail(ev.id));
    article.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(ev.id);
      }
    });
    return article;
  }

  function tableRow(ev) {
    const tr = document.createElement("tr");
    const thumb = imageUrl(ev, true) || imageUrl(ev, false);
    const imgHtml = thumb
      ? `<img src="${escapeAttr(thumb)}" alt="" loading="lazy" />`
      : "";
    const starTd = document.createElement("td");
    starTd.className = "col-star";
    starTd.appendChild(starButton(ev.id));
    tr.appendChild(starTd);
    tr.insertAdjacentHTML(
      "beforeend",
      `
      <td class="col-img">${imgHtml}</td>
      <td class="col-date">${escapeHtml(ev.date || "")}</td>
      <td class="col-date">${escapeHtml(ev.endDate || "")}</td>
      <td class="col-time">${escapeHtml(ev.time || "")}</td>
      <td>${escapeHtml(ev.title || "")}</td>
      <td>${escapeHtml(ev.location || "")}</td>`
    );
    tr.addEventListener("click", () => openDetail(ev.id));
    return tr;
  }

  function overlapsMonth(ev, key) {
    const [y, m] = key.split("-").map(Number);
    if (!y || !m) return false;
    const monthStart = `${key}-01`;
    const monthEnd = isoDate(new Date(y, m, 0));
    const start = eventStart(ev);
    const end = eventEnd(ev);
    return Boolean(start && end >= monthStart && start <= monthEnd);
  }

  function updateMonthNav() {
    const btn = $("#month-title");
    if (state.view === "starred") {
      btn.textContent = "Starred";
      $("#month-prev").disabled = true;
      $("#month-next").disabled = true;
      return;
    }
    const keys = availableMonthKeys();
    const cur = state.focusMonth || "";
    btn.textContent = monthLabelFromKey(cur) || "Upcoming";
    $("#month-prev").disabled = !keys.some((k) => k < cur);
    $("#month-next").disabled = !keys.some((k) => k > cur);
  }

  function setBrandTitle(count) {
    const base = (state.data && state.data.title) || "Events";
    const titleEl = $("#site-title");
    if (!titleEl) return;
    if (count == null || count === "") {
      titleEl.textContent = base;
      return;
    }
    titleEl.textContent = `${base} (${count})`;
  }

  function localeTag() {
    return state.lang === "el" ? "el-GR" : "en-GB";
  }

  function fmtClock(d) {
    const loc = localeTag();
    const day = d.toLocaleDateString(loc, { weekday: "short" });
    const date = d.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `${day} ${date} · ${time}`;
  }

  function fmtStamp(value) {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(localeTag(), {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function tickClock() {
    const el = $("#clock-now");
    if (!el) return;
    const now = new Date();
    el.dateTime = now.toISOString();
    el.textContent = fmtClock(now);
  }

  function startClock() {
    tickClock();
    if (state._clockTimer) clearInterval(state._clockTimer);
    state._clockTimer = setInterval(tickClock, 1000);
  }

  function renderUpdateInfo() {
    const appEl = $("#info-app-updated");
    const dataEl = $("#info-data-updated");
    if (!appEl || !dataEl) return;
    const appLabel = state.lang === "el" ? "Εφαρμογή" : "App";
    const dataLabel = state.lang === "el" ? "Δεδομένα" : "Data";
    const appStamp = fmtStamp(state.appUpdatedAt) || "—";
    const dataStamp = fmtStamp(state.data && state.data.generated) || "—";
    appEl.textContent = `${appLabel}: ${appStamp}`;
    dataEl.textContent = `${dataLabel}: ${dataStamp}`;
  }

  async function detectAppUpdated() {
    let best = null;
    const tryHeader = async (url) => {
      try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        const raw = res.headers.get("last-modified");
        if (!raw) return;
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime()) && (!best || d > best)) best = d;
      } catch (_) {}
    };
    await Promise.all([tryHeader("index.html"), tryHeader("js/site.js"), tryHeader("css/site.css")]);
    if (!best) {
      const d = new Date(document.lastModified);
      if (!Number.isNaN(d.getTime())) best = d;
    }
    state.appUpdatedAt = best;
    renderUpdateInfo();
  }

  function clearResultCount() {
    const el = $("#result-count");
    if (el) el.textContent = "";
  }

  function renderList() {
    ensureFocusMonth();
    updateMonthNav();
    const monthEvents =
      state.view === "starred"
        ? state.filtered.slice().sort(sortSoonest)
        : state.filtered.filter((ev) => overlapsMonth(ev, state.focusMonth)).sort(sortSoonest);

    const cards = $("#list-cards");
    const tbody = $("#list-table-body");
    const tableWrap = $("#list-table-wrap");
    cards.innerHTML = "";
    tbody.innerHTML = "";
    const useTable = state.density === "table";
    cards.classList.toggle("hidden", useTable);
    tableWrap.classList.toggle("hidden", !useTable);
    if (useTable) {
      monthEvents.forEach((ev) => tbody.appendChild(tableRow(ev)));
    } else {
      monthEvents.forEach((ev) => cards.appendChild(cardButton(ev)));
    }

    setBrandTitle(monthEvents.length);
    clearResultCount();
    $("#list-empty").classList.toggle("hidden", monthEvents.length > 0);
    if (state.view === "starred") {
      $("#list-empty").textContent = "No starred upcoming events.";
    } else {
      $("#list-empty").textContent = state.events.length
        ? "Nothing matches these filters."
        : "No upcoming events.";
    }
  }

  function endOfWeekDate(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay();
    x.setDate(x.getDate() + (day === 0 ? 0 : 7 - day));
    return x;
  }

  function endOfNextWeekDate(from = new Date()) {
    const end = endOfWeekDate(from);
    end.setDate(end.getDate() + 7);
    return end;
  }

  function ensureRailsHorizon() {
    const today = todayISO();
    const min = isoDate(endOfNextWeekDate(new Date()));
    if (!state.railsHorizon || state.railsHorizon < today) state.railsHorizon = min;
    else if (state.railsHorizon < min) state.railsHorizon = min;
  }

  function railsDayKeys() {
    ensureRailsHorizon();
    const keys = [];
    let d = parseISO(todayISO());
    const end = parseISO(state.railsHorizon);
    if (!d || !end) return keys;
    while (d <= end) {
      keys.push(isoDate(d));
      d = addDays(d, 1);
    }
    return keys;
  }

  function railsEvents() {
    const today = todayISO();
    const end = state.railsHorizon || today;
    return state.filtered.filter((ev) => eventEnd(ev) >= today && eventStart(ev) <= end);
  }

  function updateRailsFade() {
    const scroller = $("#rails-scroll");
    const fadeEnd = $("#rails-fade");
    const fadeStart = $("#rails-fade-start");
    if (!scroller || !fadeEnd) return;
    const canScroll = scroller.scrollWidth > scroller.clientWidth + 4;
    const atStart = scroller.scrollLeft <= 8;
    const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 8;
    if (fadeStart) fadeStart.classList.toggle("hidden", !canScroll || atStart);
    fadeEnd.classList.toggle("hidden", !canScroll || atEnd);
  }

  function syncRailsLayoutUi() {
    $$(".rails-mode-btn").forEach((btn) => {
      const on = btn.dataset.railsLayout === state.railsLayout;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const wrap = $(".rails-wrap");
    if (wrap) {
      wrap.classList.toggle("rails-layout-days", state.railsLayout === "days");
      wrap.classList.toggle("rails-layout-cards", state.railsLayout === "cards");
    }
  }

  function applyRailsLayout(layout, skipSave = false) {
    if (!RAILS_LAYOUTS.includes(layout)) layout = "days";
    state.railsLayout = layout;
    syncRailsLayoutUi();
    if (!skipSave) saveSettings();
    if (state.view === "rails") {
      renderRails();
      const sc = $("#rails-scroll");
      if (sc) sc.scrollLeft = 0;
    }
  }

  function renderRailsDays(track, events) {
    const byDay = new Map();
    railsDayKeys().forEach((day) => byDay.set(day, []));
    events.forEach((ev) => {
      railsDayKeys().forEach((day) => {
        if (eventStart(ev) <= day && eventEnd(ev) >= day) byDay.get(day).push(ev);
      });
    });
    let total = 0;
    railsDayKeys().forEach((day) => {
      const items = byDay.get(day).slice().sort(sortSoonest);
      total += items.length;
      const col = document.createElement("div");
      col.className = "rails-day";
      const d = parseISO(day);
      const head = document.createElement("header");
      head.className = "rails-day-head";
      head.innerHTML = `<span class="rails-dow">${d.toLocaleDateString(undefined, {
        weekday: "short",
      })}</span><span class="rails-date-sep" aria-hidden="true">·</span><span class="rails-date">${d.toLocaleDateString(
        undefined,
        { month: "short", day: "numeric" }
      )}</span>`;
      col.appendChild(head);
      const list = document.createElement("div");
      list.className = "rails-day-events";
      if (!items.length) {
        const none = document.createElement("p");
        none.className = "rails-none muted";
        none.textContent = "—";
        list.appendChild(none);
      } else {
        items.forEach((ev) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "rails-card";
          const thumb = imageUrl(ev, true) || imageUrl(ev, false);
          btn.innerHTML = `${
            thumb ? `<span class="rails-thumb" style="background-image:url('${escapeAttr(thumb)}')"></span>` : ""
          }<span class="rails-card-body"><strong>${escapeHtml(ev.title || "Untitled")}</strong><span class="rails-meta">${escapeHtml(
            ev.time || "All day"
          )}${ev.location ? ` · ${escapeHtml(ev.location)}` : ""}</span></span>`;
          btn.addEventListener("click", () => openDetail(ev.id));
          list.appendChild(btn);
        });
      }
      col.appendChild(list);
      track.appendChild(col);
    });
    return total;
  }

  function renderRailsCards(track, events) {
    const seen = new Set();
    const unique = [];
    events
      .slice()
      .sort(sortSoonest)
      .forEach((ev) => {
        const id = String(ev.id || "");
        if (!id || seen.has(id)) return;
        seen.add(id);
        unique.push(ev);
      });
    unique.forEach((ev) => {
      const slide = document.createElement("div");
      slide.className = "rails-slide";
      const card = cardButton(ev);
      card.classList.add("rails-slide-card");
      slide.appendChild(card);
      track.appendChild(slide);
    });
    return unique.length;
  }

  function renderRails() {
    const track = $("#rails-track");
    const empty = $("#rails-empty");
    if (!track) return;
    ensureRailsHorizon();
    syncRailsLayoutUi();
    const events = railsEvents();
    track.innerHTML = "";
    const total =
      state.railsLayout === "cards" ? renderRailsCards(track, events) : renderRailsDays(track, events);
    if (empty) {
      empty.classList.toggle("hidden", total > 0);
      empty.textContent = state.events.length ? "No events in this period." : "No upcoming events.";
    }
    if (state.view === "rails") {
      setBrandTitle(total);
      clearResultCount();
    }
    const sc = $("#rails-scroll");
    if (sc && state.railsLayout === "days") sc.scrollLeft = 0;
    requestAnimationFrame(updateRailsFade);
  }

  function extendRailsHorizon() {
    if (state.railsLoading) return;
    const end = parseISO(state.railsHorizon);
    if (!end) return;
    state.railsLoading = true;
    const loader = $("#rails-loader");
    if (loader) loader.classList.remove("hidden");
    // ponytail: client-side data only; short delay signals loading next week chunk
    setTimeout(() => {
      const next = endOfWeekDate(addDays(end, 1));
      state.railsHorizon = isoDate(next);
      state.railsLoading = false;
      if (loader) loader.classList.add("hidden");
      saveSettings();
      renderRails();
    }, 400);
  }

  function onRailsScroll() {
    updateRailsFade();
    const scroller = $("#rails-scroll");
    if (!scroller || state.railsLoading || state.view !== "rails") return;
    if (scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 48) {
      extendRailsHorizon();
    }
  }

  function applyCalMode(mode, skipSave = false) {
    if (!CAL_MODES.includes(mode)) mode = "month";
    state.calMode = mode;
    CAL_MODES.forEach((m) => document.body.classList.toggle(`cal-mode-${m}`, m === mode));
    $$(".cal-mode-btn").forEach((btn) => {
      const on = btn.dataset.calMode === mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const layout = $(".cal-layout");
    const agendaFull = $("#cal-agenda-full");
    const dayAgenda = $("#day-agenda");
    if (layout) layout.classList.toggle("hidden", mode === "agenda");
    if (agendaFull) agendaFull.classList.toggle("hidden", mode !== "agenda");
    if (dayAgenda) dayAgenda.classList.toggle("hidden", mode !== "month");
    if (mode === "agenda") {
      renderCalAgendaFull();
    } else {
      renderCustomCalendar();
    }
    if (!skipSave) saveSettings();
  }

  function calFocusDate() {
    if (state.agendaDay) {
      const d = parseISO(state.agendaDay);
      if (d) return d;
    }
    if (state.focusMonth) {
      const [y, m] = state.focusMonth.split("-").map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  }

  function shiftCal(unit, delta) {
    const d = calFocusDate();
    if (unit === "month") {
      const next = new Date(d.getFullYear(), d.getMonth() + delta, 1);
      const key = monthKeyFromDate(next);
      const today = todayISO();
      state.agendaDay = today.slice(0, 7) === key ? today : `${key}-01`;
      setFocusMonth(key, true);
      renderCustomCalendar();
      return;
    }
    if (unit === "week") {
      const next = addDays(d, delta * 7);
      state.agendaDay = isoDate(next);
      setFocusMonth(monthKeyFromDate(next), true);
      renderCustomCalendar();
      return;
    }
    const next = addDays(d, delta);
    state.agendaDay = isoDate(next);
    setFocusMonth(monthKeyFromDate(next), true);
    renderCustomCalendar();
  }

  function goCalToday() {
    const today = todayISO();
    state.agendaDay = today;
    setFocusMonth(today.slice(0, 7), true);
    renderCustomCalendar();
  }

  function renderCalNav(titleText, openMonthPicker) {
    const nav = $("#cal-nav-bar");
    if (!nav) return;
    nav.innerHTML = "";
    const left = document.createElement("div");
    left.className = "cal-nav-left";
    const mkBtn = (label, cls, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.textContent = label;
      b.addEventListener("click", onClick);
      return b;
    };
    left.appendChild(mkBtn("‹", "cal-nav-btn", () => {
      if (state.calMode === "month") shiftCal("month", -1);
      else if (state.calMode === "week") shiftCal("week", -1);
      else shiftCal("day", -1);
    }));
    left.appendChild(mkBtn("›", "cal-nav-btn", () => {
      if (state.calMode === "month") shiftCal("month", 1);
      else if (state.calMode === "week") shiftCal("week", 1);
      else shiftCal("day", 1);
    }));
    left.appendChild(mkBtn("Today", "cal-nav-today", goCalToday));
    const title = document.createElement("button");
    title.type = "button";
    title.className = "cal-nav-title";
    title.textContent = titleText;
    if (openMonthPicker) title.addEventListener("click", openMonthPopup);
    nav.appendChild(left);
    nav.appendChild(title);
  }

  function appendAgendaRows(host, items, { thumbs = true } = {}) {
    host.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "agenda-empty";
      empty.textContent = "No events this day.";
      host.appendChild(empty);
      return;
    }
    items.forEach((ev) => {
      const row = document.createElement("article");
      row.className = "agenda-row" + (isAllDay(ev) ? " all-day" : "");
      if (thumbs) {
        const thumb = imageUrl(ev, true) || imageUrl(ev, false);
        const img = document.createElement("img");
        img.className = "agenda-thumb" + (thumb ? "" : " no-img");
        if (thumb) {
          img.src = thumb;
          img.alt = "";
          img.loading = "lazy";
        }
        row.appendChild(img);
      }
      const info = document.createElement("div");
      info.className = "agenda-info";
      const name = document.createElement("h3");
      name.className = "agenda-title";
      name.textContent = ev.title || "Untitled";
      const meta = document.createElement("p");
      meta.className = "agenda-meta";
      const timePart = ev.time || "All day";
      const locPart = (ev.location || "").trim();
      meta.textContent = locPart ? `${timePart} · ${locPart}` : timePart;
      info.appendChild(name);
      info.appendChild(meta);
      row.appendChild(info);
      row.appendChild(starButton(ev.id));
      row.addEventListener("click", (e) => {
        if (e.target.closest(".star-btn")) return;
        openDetail(ev.id);
      });
      host.appendChild(row);
    });
  }

  function renderCalAgendaFull() {
    const host = $("#cal-agenda-full");
    if (!host) return;
    host.innerHTML = "";
    const grouped = new Map();
    state.filtered.forEach((ev) => {
      const start = eventStart(ev);
      if (!start) return;
      if (!grouped.has(start)) grouped.set(start, []);
      grouped.get(start).push(ev);
    });
    const days = [...grouped.keys()].sort();
    if (!days.length) {
      const empty = document.createElement("p");
      empty.className = "agenda-empty";
      empty.textContent = "No upcoming events.";
      host.appendChild(empty);
      return;
    }
    days.forEach((day) => {
      const d = parseISO(day);
      const head = document.createElement("h2");
      head.className = "cal-agenda-day-title";
      head.textContent = d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      host.appendChild(head);
      const list = document.createElement("div");
      list.className = "cal-agenda-day-list";
      appendAgendaRows(list, grouped.get(day).slice().sort(sortSoonest), { thumbs: true });
      host.appendChild(list);
    });
  }

  function eventsOnDay(iso) {
    return state.filtered
      .filter((ev) => eventStart(ev) && eventStart(ev) <= iso && eventEnd(ev) >= iso)
      .sort(sortSoonest);
  }

  function selectAgendaDay(iso) {
    if (!iso) return;
    state.agendaDay = iso;
    paintAgendaDay();
    renderAgenda();
  }

  function paintAgendaDay() {
    $$("#calendar .cal-day").forEach((el) => {
      el.classList.toggle("agenda-selected", el.getAttribute("data-date") === state.agendaDay);
    });
  }

  function renderAgenda() {
    const title = $("#agenda-title");
    const list = $("#agenda-list");
    if (!title || !list) return;
    const day = parseISO(state.agendaDay);
    title.textContent = day
      ? day.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "Select a day";
    appendAgendaRows(list, state.agendaDay ? eventsOnDay(state.agendaDay) : []);
  }

  function renderMonthGrid(host) {
    ensureFocusMonth();
    const [y, m] = state.focusMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const prevDays = new Date(y, m - 1, 0).getDate();
    const today = todayISO();
    const cells = [];
    for (let i = 0; i < startPad; i++) {
      const day = prevDays - startPad + i + 1;
      const d = new Date(y, m - 2, day);
      cells.push({ iso: isoDate(d), num: day, muted: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m - 1, day);
      cells.push({ iso: isoDate(d), num: day, muted: false });
    }
    while (cells.length % 7 !== 0) {
      const i = cells.length - startPad - daysInMonth + 1;
      const d = new Date(y, m, i);
      cells.push({ iso: isoDate(d), num: d.getDate(), muted: true });
    }
    const grid = document.createElement("div");
    grid.className = "cal-month";
    const dows = document.createElement("div");
    dows.className = "cal-dows";
    const narrow = window.matchMedia("(max-width: 599px)").matches;
    for (let i = 0; i < 7; i++) {
      const d = new Date(2024, 0, 1 + i);
      const cell = document.createElement("div");
      cell.className = "cal-dow";
      cell.textContent = d.toLocaleDateString(undefined, { weekday: narrow ? "narrow" : "short" });
      dows.appendChild(cell);
    }
    grid.appendChild(dows);
    const body = document.createElement("div");
    body.className = "cal-days";
    cells.forEach(({ iso, num, muted }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day" + (muted ? " muted" : "") + (iso === today ? " today" : "");
      btn.dataset.date = iso;
      btn.innerHTML = `<span class="cal-day-num">${num}</span>`;
      const count = eventsOnDay(iso).length;
      if (count) {
        const badge = document.createElement("span");
        badge.className = "cal-day-count";
        badge.textContent = String(count);
        btn.appendChild(badge);
      }
      btn.addEventListener("click", () => selectAgendaDay(iso));
      body.appendChild(btn);
    });
    grid.appendChild(body);
    host.appendChild(grid);
    paintAgendaDay();
    renderAgenda();
  }

  function renderWeekBoard(host) {
    const focus = calFocusDate();
    const start = printWeekStart(focus);
    const wrap = document.createElement("div");
    wrap.className = "cal-week-scroll rails-like";
    const track = document.createElement("div");
    track.className = "cal-week-track";
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const iso = isoDate(d);
      const col = document.createElement("div");
      col.className = "rails-day cal-week-day" + (iso === state.agendaDay ? " selected" : "");
      const head = document.createElement("button");
      head.type = "button";
      head.className = "rails-day-head";
      const dow = d.toLocaleDateString(undefined, { weekday: "short" });
      const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      head.innerHTML = `<span class="rails-dow">${escapeHtml(dow)}</span><span class="rails-date-sep" aria-hidden="true">·</span><span class="rails-date">${escapeHtml(
        date
      )}</span>`;
      head.addEventListener("click", () => {
        state.agendaDay = iso;
        applyCalMode("day");
      });
      col.appendChild(head);
      const list = document.createElement("div");
      list.className = "rails-day-events";
      const items = eventsOnDay(iso);
      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "rails-none muted";
        empty.textContent = "—";
        list.appendChild(empty);
      } else {
        items.forEach((ev) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "rails-card";
          const thumb = imageUrl(ev, true) || imageUrl(ev, false);
          btn.innerHTML = `${
            thumb ? `<span class="rails-thumb" style="background-image:url('${escapeAttr(thumb)}')"></span>` : ""
          }<span class="rails-card-body"><strong>${escapeHtml(
            ev.title || "Untitled"
          )}</strong><span class="rails-meta">${escapeHtml(ev.time || "All day")}${
            ev.location ? ` · ${escapeHtml(ev.location)}` : ""
          }</span></span>`;
          btn.addEventListener("click", () => openDetail(ev.id));
          list.appendChild(btn);
        });
      }
      col.appendChild(list);
      track.appendChild(col);
    }
    wrap.appendChild(track);
    host.appendChild(wrap);
    wrap.scrollLeft = 0;
  }

  function renderDayBoard(host) {
    const iso = state.agendaDay || todayISO();
    const wrap = document.createElement("div");
    wrap.className = "cal-day-board";
    appendAgendaRows(wrap, eventsOnDay(iso));
    host.appendChild(wrap);
  }

  function renderCustomCalendar() {
    const el = $("#calendar");
    if (!el || state.calMode === "agenda") return;
    ensureFocusMonth();
    if (!state.agendaDay) {
      const today = todayISO();
      const key = state.focusMonth;
      state.agendaDay = today.slice(0, 7) === key ? today : `${key}-01`;
    }
    el.innerHTML = "";
    const focus = calFocusDate();
    if (state.calMode === "month") {
      renderCalNav(
        focus.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        true
      );
      renderMonthGrid(el);
    } else if (state.calMode === "week") {
      const start = printWeekStart(focus);
      const end = addDays(start, 6);
      const title = `${start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
      renderCalNav(title, false);
      renderWeekBoard(el);
    } else {
      renderCalNav(
        focus.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        false
      );
      renderDayBoard(el);
    }
  }

  function ensureCalendar() {
    if (!state.agendaDay) {
      const today = todayISO();
      const key = state.focusMonth || monthKeyFromDate(new Date());
      state.agendaDay = today.slice(0, 7) === key ? today : `${key}-01`;
    }
    state.calendar = true;
  }

  function syncCalendar() {
    if (state.view !== "calendar" || !state.calendar) return;
    if (state.calMode === "agenda") renderCalAgendaFull();
    else renderCustomCalendar();
  }

  function renderPosters() {
    ensureFocusMonth();
    updateMonthNav();
    const host = $("#poster-mosaic");
    const empty = $("#posters-empty");
    if (!host) return;
    host.innerHTML = "";
    const monthEvents = state.filtered
      .filter((ev) => overlapsMonth(ev, state.focusMonth))
      .filter((ev) => imageUrl(ev, false) || imageUrl(ev, true))
      .sort(sortSoonest);
    monthEvents.forEach((ev) => {
      const img = imageUrl(ev, false) || imageUrl(ev, true);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "poster-tile";
      btn.style.backgroundImage = `url('${escapeAttr(img)}')`;
      btn.setAttribute("aria-label", ev.title || "Event");
      btn.addEventListener("click", () => openDetail(ev.id));
      host.appendChild(btn);
    });
    setBrandTitle(monthEvents.length);
    clearResultCount();
    if (empty) {
      empty.classList.toggle("hidden", monthEvents.length > 0);
      empty.textContent = state.events.length
        ? "No posters this month."
        : "No upcoming events.";
    }
  }

  function ensureMap() {
    if (state.map) return;
    if (typeof L === "undefined") return;
    const center = state.data?.center || { lat: 36.451456, lng: 28.2234119, zoom: 12 };
    state.map = L.map("map", { scrollWheelZoom: true }).setView(
      [center.lat, center.lng],
      center.zoom || 12
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(state.map);
    state.clusters = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
    });
    state.map.addLayer(state.clusters);
    renderMarkers();
  }

  function markerIcon(ev) {
    const img = imageUrl(ev, true) || imageUrl(ev, false);
    return L.divIcon({
      className: "",
      html: `<div class="leaflet-marker-photo" style="${
        img ? `background-image:url('${escapeAttr(img)}')` : "background:#0a5c56"
      }"></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }

  function renderMarkers() {
    if (!state.map || !state.clusters) return;
    state.clusters.clearLayers();
    state.filtered
      .filter((ev) => ev.lat != null && ev.lng != null)
      .forEach((ev) => {
        const marker = L.marker([Number(ev.lat), Number(ev.lng)], { icon: markerIcon(ev) });
        marker.on("click", () => showMapSheet(ev));
        state.clusters.addLayer(marker);
      });
  }

  function fitMap() {
    if (!state.map || !state.clusters || !state.clusters.getLayers().length) return;
    state.map.fitBounds(state.clusters.getBounds().pad(0.2));
  }

  function showMapSheet(ev) {
    const sheet = $("#map-sheet");
    const thumb = imageUrl(ev, true) || imageUrl(ev, false);
    const maps = navigateUrl(ev);
    sheet.classList.remove("hidden");
    sheet.innerHTML = `
      <button type="button" class="map-sheet-close" data-close-sheet aria-label="Close">\u00d7</button>
      <div class="thumb" style="${thumb ? `background-image:url('${escapeAttr(thumb)}')` : ""}"></div>
      <div>
        <h3>${escapeHtml(ev.title || "")}</h3>
        <p class="meta">${escapeHtml(fmtWhen(ev))}</p>
        <p class="meta">${escapeHtml(ev.location || "")}</p>
      </div>
      <div class="sheet-actions">
        <button type="button" class="btn primary" data-open>Details</button>
        <div class="cal-menu-wrap">
          <button type="button" class="btn primary" data-cal-btn aria-haspopup="true" aria-expanded="false">Calendar</button>
          <div class="cal-menu hidden" data-cal-menu role="menu">
            <a class="cal-menu-item" data-gcal href="${escapeAttr(googleCalUrl(ev))}" target="_blank" rel="noopener" role="menuitem">Google Calendar</a>
            <button type="button" class="cal-menu-item" data-ics role="menuitem">Download .ics</button>
          </div>
        </div>
        ${
          maps
            ? `<a class="btn secondary" href="${escapeAttr(maps)}" target="_blank" rel="noopener">Navigate</a>`
            : ""
        }
        <button type="button" class="btn ghost" data-share-btn>Share</button>
      </div>
      <div class="share-row map-share-row hidden" data-share-row>
        <button type="button" data-share="copy" class="btn ghost">Copy link</button>
        <a data-share="whatsapp" class="btn ghost" target="_blank" rel="noopener">WhatsApp</a>
        <a data-share="facebook" class="btn ghost" target="_blank" rel="noopener">Facebook</a>
        <a data-share="x" class="btn ghost" target="_blank" rel="noopener">X</a>
        <a data-share="mail" class="btn ghost">Mail</a>
      </div>`;
    sheet.querySelector("[data-close-sheet]").addEventListener("click", closeMapSheet);
    sheet.querySelector("[data-open]").addEventListener("click", () => openDetail(ev.id));
    bindCalMenu(sheet.querySelector("[data-cal-btn]"), sheet.querySelector("[data-cal-menu]"), () =>
      downloadIcs(ev)
    );
    const shareRow = sheet.querySelector("[data-share-row]");
    sheet.querySelector("[data-share-btn]").addEventListener("click", () => shareEvent(ev, shareRow));
    shareRow.querySelector('[data-share="copy"]').addEventListener("click", async () => {
      const url = eventShareUrl(ev);
      const copyBtn = shareRow.querySelector('[data-share="copy"]');
      try {
        await navigator.clipboard.writeText(url);
        copyBtn.textContent = "Copied";
        setTimeout(() => {
          copyBtn.textContent = "Copy link";
        }, 1200);
      } catch (_) {
        prompt("Copy this link", url);
      }
    });
  }

  function closeMapSheet() {
    const sheet = $("#map-sheet");
    if (!sheet) return;
    sheet.classList.add("hidden");
    sheet.innerHTML = "";
  }

  function renderAll() {
    renderList();
    if (state.view === "rails") renderRails();
    if (state.view === "posters") renderPosters();
    if (state.view === "calendar") syncCalendar();
    if (state.map) {
      renderMarkers();
      if (state.view === "map") fitMap();
    }
    if (state.view === "calendar" || state.view === "map") {
      setBrandTitle(state.filtered.length);
      clearResultCount();
    }
  }

  function findEvent(id) {
    return state.events.find((ev) => ev.id === id);
  }

  function openLightbox(src, alt) {
    if (!src) return;
    const box = $("#lightbox");
    const img = $("#lightbox-img");
    img.src = src;
    img.alt = alt || "";
    box.classList.remove("hidden");
  }

  function closeLightbox() {
    $("#lightbox").classList.add("hidden");
    $("#lightbox-img").removeAttribute("src");
  }

  let detailScrollY = 0;
  let detailClickBlockUntil = 0;
  let detailScrollBlockUntil = 0;

  function blockDetailGhostClick(ms = 450) {
    detailClickBlockUntil = Date.now() + ms;
  }

  function blockDetailGhostScroll(ms = 400) {
    detailScrollBlockUntil = Date.now() + ms;
  }

  function installDetailInteractionGuards() {
    if (installDetailInteractionGuards.done) return;
    installDetailInteractionGuards.done = true;
    const swallowGhost = (e) => {
      if (Date.now() >= detailClickBlockUntil) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const swallowGhostScroll = (e) => {
      if (Date.now() >= detailScrollBlockUntil) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", swallowGhost, true);
    document.addEventListener("pointerup", swallowGhost, true);
    document.addEventListener("touchmove", swallowGhostScroll, { capture: true, passive: false });
    document.addEventListener("wheel", swallowGhostScroll, { capture: true, passive: false });
  }

  function lockDetailPageScroll() {
    if (document.body.classList.contains("detail-open")) return;
    detailScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add("detail-open");
    document.body.style.position = "fixed";
    document.body.style.top = `-${detailScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function restoreDetailPageScroll(y) {
    window.scrollTo({ top: y, left: 0, behavior: "instant" });
  }

  function unlockDetailPageScroll() {
    if (!document.body.classList.contains("detail-open")) return;
    const y = detailScrollY;
    document.body.classList.remove("detail-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    restoreDetailPageScroll(y);
    requestAnimationFrame(() => restoreDetailPageScroll(y));
  }

  function openDetail(id) {
    const ev = findEvent(id);
    if (!ev) return;
    state.selected = ev;
    location.hash = `e=${encodeURIComponent(id)}`;
    $("#detail").classList.remove("hidden");
    const hero = $("#detail-hero");
    const img = imageUrl(ev, false) || imageUrl(ev, true);
    state.heroSrc = img;
    hero.style.backgroundImage = img ? `url('${escapeAttr(img)}')` : "";
    hero.disabled = !img;
    $("#detail-title").textContent = ev.title || "Untitled";
    const star = $("#detail-star");
    star.dataset.star = String(ev.id || "");
    star.textContent = isStarred(ev.id) ? "★" : "☆";
    star.setAttribute("aria-pressed", isStarred(ev.id) ? "true" : "false");
    star.setAttribute("aria-label", isStarred(ev.id) ? "Unstar event" : "Star event");
    $("#detail-when").textContent = fmtWhen(ev);
    const where = $("#detail-where");
    where.textContent = ev.location || "";
    const canMap = Boolean(ev.location && state.enabledViews.has("map"));
    where.classList.toggle("location-link", canMap);
    if (canMap) {
      where.setAttribute("role", "link");
      where.tabIndex = 0;
      where.setAttribute("title", "Show on map");
    } else {
      where.removeAttribute("role");
      where.removeAttribute("tabindex");
      where.removeAttribute("title");
    }
    const artist = $("#detail-artist");
    if (ev.artist) {
      artist.textContent = ev.artist;
      artist.classList.remove("hidden");
    } else {
      artist.classList.add("hidden");
    }
    const cats = $("#detail-cats");
    cats.innerHTML = "";
    (ev.category || []).forEach((c) => {
      const span = document.createElement("button");
      span.type = "button";
      span.className = "chip" + (state.categories.has(c) ? " active" : "");
      span.textContent = c;
      span.dataset.cat = c;
      span.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCategoryFilter(c, { closeDetailAfter: true });
      });
      cats.appendChild(span);
    });
    const notesEl = $("#detail-notes");
    const notesHtml = formatNotesHtml(ev.notes);
    if (notesHtml) {
      notesEl.innerHTML = notesHtml;
      notesEl.classList.remove("hidden");
    } else {
      notesEl.textContent = "";
      notesEl.classList.add("hidden");
    }
    $("#share-row").classList.add("hidden");
    $("#btn-gcal").href = googleCalUrl(ev);
    const hasCoords = ev.lat != null && ev.lng != null;
    $("#detail-map-hint").classList.toggle("hidden", hasCoords || !ev.location);
    const nav = $("#btn-navigate");
    const maps = navigateUrl(ev);
    if (maps) {
      nav.href = maps;
      nav.classList.remove("hidden");
    } else {
      nav.removeAttribute("href");
      nav.classList.add("hidden");
    }
    renderMiniMap(ev);
    const sheet = $(".detail-sheet");
    if (sheet) {
      sheet.classList.remove("is-dragging");
      sheet.style.transform = "";
    }
    lockDetailPageScroll();
  }

  function bindDetailDrawer() {
    installDetailInteractionGuards();
    const detail = $("#detail");
    const sheet = $(".detail-sheet");
    const chrome = sheet?.querySelector("[data-detail-drag]");
    if (!sheet || !chrome) return;

    let startY = 0;
    let currentY = 0;
    let dragging = false;
    let dragMoved = false;

    const resetSheet = () => {
      sheet.classList.remove("is-dragging");
      sheet.style.transform = "";
      dragging = false;
      currentY = 0;
      dragMoved = false;
    };

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest(".detail-close")) return;
      dragging = true;
      dragMoved = false;
      startY = e.clientY;
      currentY = 0;
      sheet.classList.add("is-dragging");
      chrome.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const nextY = Math.max(0, e.clientY - startY);
      if (nextY > 8) dragMoved = true;
      if (!dragMoved) return;
      currentY = nextY;
      sheet.style.transform = `translateY(${currentY}px)`;
      e.preventDefault();
    };

    const finishDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      chrome.releasePointerCapture?.(e.pointerId);
      if (currentY > 80) {
        e.preventDefault();
        e.stopPropagation();
        blockDetailGhostClick();
        blockDetailGhostScroll();
        resetSheet();
        closeDetail();
        return;
      }
      if (dragMoved) blockDetailGhostClick(300);
      resetSheet();
    };

    chrome.addEventListener("pointerdown", onPointerDown);
    chrome.addEventListener("pointermove", onPointerMove);
    chrome.addEventListener("pointerup", finishDrag);
    chrome.addEventListener("pointercancel", resetSheet);

    detail.addEventListener(
      "wheel",
      (e) => {
        if (!$("#detail").classList.contains("hidden") && !e.target.closest(".detail-panel")) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
    detail.addEventListener(
      "touchmove",
      (e) => {
        if ($("#detail").classList.contains("hidden")) return;
        if (e.target.closest(".detail-panel")) return;
        e.preventDefault();
      },
      { passive: false }
    );
  }

  function openLocationOnMap(ev) {
    if (!ev || !ev.location || !state.enabledViews.has("map")) return;
    closeDetail();
    state.venues = new Set([ev.location]);
    renderLocationFilter();
    state._mapFocus = {
      id: ev.id,
      lat: ev.lat,
      lng: ev.lng,
    };
    setView("map");
  }

  function closeDetail() {
    const sheet = $(".detail-sheet");
    if (sheet) {
      sheet.classList.remove("is-dragging");
      sheet.style.transform = "";
    }
    $("#detail").classList.add("hidden");
    if (state.miniMap) {
      state.miniMap.remove();
      state.miniMap = null;
    }
    if (location.hash.startsWith("#e=")) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    state.selected = null;
    state.heroSrc = "";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => unlockDetailPageScroll());
    });
  }

  function renderMiniMap(ev) {
    const host = $("#detail-mini-map");
    if (state.miniMap) {
      state.miniMap.remove();
      state.miniMap = null;
    }
    if (ev.lat == null || ev.lng == null || typeof L === "undefined") {
      host.classList.add("hidden");
      return;
    }
    host.classList.remove("hidden");
    host.innerHTML = "";
    requestAnimationFrame(() => {
      state.miniMap = L.map(host, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
      }).setView([ev.lat, ev.lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(
        state.miniMap
      );
      L.marker([ev.lat, ev.lng], { icon: markerIcon(ev) }).addTo(state.miniMap);
      const fix = () => {
        if (!state.miniMap) return;
        state.miniMap.invalidateSize();
        state.miniMap.setView([ev.lat, ev.lng], 15);
      };
      requestAnimationFrame(fix);
      setTimeout(fix, 120);
    });
  }

  function icsDate(ev, end) {
    const date = end ? ev.endDate || ev.date : ev.date;
    const compact = (date || "").replace(/-/g, "");
    if (!ev.time || end) {
      if (end) {
        const d = parseISO(ev.endDate || ev.date);
        if (!d) return compact;
        return isoDate(addDays(d, 1)).replace(/-/g, "");
      }
      return compact;
    }
    const [hh, mm] = ev.time.split(":");
    return `${compact}T${hh}${mm}00`;
  }

  function icsBody(ev) {
    const timed = Boolean(ev.time);
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    const uid = `${ev.id || "event"}@event-manager`;
    const summary = escapeIcs(ev.title || "Event");
    const desc = escapeIcs((ev.notes || "").replace(/\r?\n/g, "\\n"));
    const loc = escapeIcs(ev.location || "");
    const url = ev.url ? `URL:${ev.url}\r\n` : "";
    if (timed) {
      return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Event Manager//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(ev, false)}`,
        `DTEND:${icsDate({ ...ev, time: bumpHour(ev.time) }, false)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${desc}`,
        `LOCATION:${loc}`,
        url.trim(),
        "END:VEVENT",
        "END:VCALENDAR",
      ]
        .filter(Boolean)
        .join("\r\n");
    }
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Event Manager//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(ev, false)}`,
      `DTEND;VALUE=DATE:${icsDate(ev, true)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${loc}`,
      url.trim(),
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
  }

  function bumpHour(time) {
    const [hh, mm] = (time || "00:00").split(":").map(Number);
    const d = new Date(2000, 0, 1, hh || 0, mm || 0);
    d.setHours(d.getHours() + 2);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function downloadIcs(ev) {
    const blob = new Blob([icsBody(ev)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(ev.title || "event").replace(/[^\w\-]+/g, "_").slice(0, 40)}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function googleCalUrl(ev) {
    const text = encodeURIComponent(ev.title || "Event");
    const details = encodeURIComponent(ev.notes || "");
    const location = encodeURIComponent(ev.location || "");
    let dates;
    if (ev.time) {
      dates = `${icsDate(ev, false)}/${icsDate({ ...ev, time: bumpHour(ev.time) }, false)}`;
    } else {
      dates = `${icsDate(ev, false)}/${icsDate(ev, true)}`;
    }
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  }

  function eventShareUrl(ev) {
    const base = `${location.origin}${location.pathname}${location.search}`;
    return `${base}#e=${encodeURIComponent(ev.id)}`;
  }

  async function shareEvent(ev, shareHost) {
    const url = eventShareUrl(ev);
    const title = ev.title || "Event";
    const text = `${title}\n${fmtWhen(ev)}${ev.location ? `\n${ev.location}` : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (_) {
        /* unavailable or cancelled — show fallback */
      }
    }
    const row = shareHost || $("#share-row");
    if (!row) return;
    row.classList.remove("hidden");
    row.querySelector('[data-share="whatsapp"]').href =
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    row.querySelector('[data-share="facebook"]').href =
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    row.querySelector('[data-share="x"]').href =
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    const mail = row.querySelector('[data-share="mail"]');
    if (mail) {
      mail.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n${url}`)}`;
    }
  }

  function closeCalMenus(except) {
    $$(".cal-menu").forEach((menu) => {
      if (menu === except) return;
      menu.classList.add("hidden");
      const wrap = menu.closest(".cal-menu-wrap");
      const btn = wrap && wrap.querySelector("[aria-haspopup]");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  function bindCalMenu(btn, menu, onIcs) {
    if (!btn || !menu) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.classList.contains("hidden");
      closeCalMenus(open ? menu : null);
      menu.classList.toggle("hidden", !open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    const ics = menu.querySelector("[data-ics], #btn-ics");
    if (ics && onIcs) {
      ics.addEventListener("click", () => {
        onIcs();
        closeCalMenus();
      });
    }
    menu.querySelectorAll("a.cal-menu-item").forEach((a) =>
      a.addEventListener("click", () => closeCalMenus())
    );
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeNoteHref(raw) {
    const url = String(raw || "").trim();
    if (/^https?:\/\//i.test(url)) return url;
    if (/^www\./i.test(url)) return `https://${url}`;
    return "";
  }

  /** Escape HTML, then linkify [label](url) and plain http(s)/www URLs. */
  function formatNotesHtml(text) {
    let html = escapeHtml((text || "").trim());
    if (!html) return "";
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
      const href = safeNoteHref(url);
      if (!href) return `[${label}](${url})`;
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    html = html.replace(
      /(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+[^\s.,;:!?)\]'\"<])/gi,
      (match, prefix, url) => {
        const href = safeNoteHref(url);
        if (!href) return match;
        return `${prefix}<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      }
    );
    return html;
  }

  function escapeAttr(value) {
    return String(value || "").replace(/'/g, "%27").replace(/"/g, "&quot;");
  }

  function escapeIcs(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }

  function shiftMonth(delta) {
    const keys = availableMonthKeys();
    const cur = state.focusMonth || "";
    const next =
      delta < 0 ? [...keys].reverse().find((k) => k < cur) : keys.find((k) => k > cur);
    if (!next) return;
    setFocusMonth(next);
  }

  function printEventsForMonth(key) {
    return state.filtered.filter((ev) => overlapsMonth(ev, key)).sort(sortSoonest);
  }

  function printFocusDate() {
    if (state.agendaDay) {
      const d = parseISO(state.agendaDay);
      if (d) return d;
    }
    return calFocusDate();
  }

  function printWeekStart(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay();
    const offset = day === 0 ? 6 : day - 1;
    x.setDate(x.getDate() - offset);
    return x;
  }

  function printChipHtml(ev) {
    const time = ev.time || "All day";
    return `<div class="print-chip"><span class="print-chip-time">${escapeHtml(time)}</span> ${escapeHtml(
      ev.title || "Untitled"
    )}</div>`;
  }

  function buildPrintMonthHtml() {
    const focus = printFocusDate();
    const y = focus.getFullYear();
    const m = focus.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const events = printEventsForMonth(key);
    const first = new Date(y, m, 1);
    const startPad = (first.getDay() - 1 + 7) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const dow = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2000, 0, 3 + i);
      dow.push(d.toLocaleDateString(undefined, { weekday: "short" }));
    }
    let cells = "";
    for (let i = 0; i < startPad; i++) cells += '<div class="print-cal-cell empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${key}-${String(day).padStart(2, "0")}`;
      const dayEvents = events.filter((ev) => eventStart(ev) <= iso && eventEnd(ev) >= iso);
      cells += `<div class="print-cal-cell"><div class="print-cal-daynum">${day}</div>${dayEvents
        .map(printChipHtml)
        .join("")}</div>`;
    }
    const title = focus.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return `<h1>Month — ${escapeHtml(title)}</h1>
      <div class="print-cal-dows">${dow.map((d) => `<div>${escapeHtml(d)}</div>`).join("")}</div>
      <div class="print-cal-grid">${cells}</div>`;
  }

  function buildPrintWeekHtml() {
    const start = printWeekStart(printFocusDate());
    const end = addDays(start, 6);
    const title = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(
      undefined,
      { month: "short", day: "numeric", year: "numeric" }
    )}`;
    let cols = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const iso = isoDate(d);
      const items = eventsOnDay(iso);
      cols += `<div class="print-week-col"><div class="print-week-head">${escapeHtml(
        d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
      )}</div>${items.map(printChipHtml).join("") || '<p class="print-empty">—</p>'}</div>`;
    }
    return `<h1>Week — ${escapeHtml(title)}</h1><div class="print-week-grid">${cols}</div>`;
  }

  function buildPrintDayHtml() {
    const d = printFocusDate();
    const iso = isoDate(d);
    const items = eventsOnDay(iso);
    const title = d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const cards = items
      .map((ev) => {
        const thumb = imageUrl(ev, true) || imageUrl(ev, false);
        const notes = (ev.notes || "").trim().slice(0, 280);
        return `<article class="print-day-card">${
          thumb ? `<img src="${escapeAttr(thumb)}" alt="" />` : ""
        }<div><h3>${escapeHtml(ev.title || "Untitled")}</h3><p class="meta">${escapeHtml(fmtWhen(ev))}${
          ev.location ? ` · ${escapeHtml(ev.location)}` : ""
        }</p>${notes ? `<p class="notes">${escapeHtml(notes)}</p>` : ""}</div></article>`;
      })
      .join("");
    return `<h1>Day — ${escapeHtml(title)}</h1>${cards || '<p class="print-empty">No events this day.</p>'}`;
  }

  function buildPrintAgendaHtml() {
    const grouped = new Map();
    state.filtered.forEach((ev) => {
      const start = eventStart(ev);
      if (!start) return;
      if (!grouped.has(start)) grouped.set(start, []);
      grouped.get(start).push(ev);
    });
    const days = [...grouped.keys()].sort();
    if (!days.length) return `<h1>Agenda</h1><p class="print-empty">No upcoming events.</p>`;
    let html = "<h1>Agenda</h1>";
    days.forEach((day) => {
      const d = parseISO(day);
      html += `<h2 class="print-agenda-day">${escapeHtml(
        d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      )}</h2>`;
      grouped
        .get(day)
        .slice()
        .sort(sortSoonest)
        .forEach((ev) => {
          const thumb = imageUrl(ev, true) || imageUrl(ev, false);
          html += `<div class="print-agenda-row">${
            thumb ? `<img src="${escapeAttr(thumb)}" alt="" />` : ""
          }<div><strong>${escapeHtml(ev.title || "Untitled")}</strong><span class="meta">${escapeHtml(
            ev.time || "All day"
          )}${ev.location ? ` · ${escapeHtml(ev.location)}` : ""}</span></div></div>`;
        });
    });
    return html;
  }

  function buildPrintTableHtml() {
    ensureFocusMonth();
    const events =
      state.view === "starred"
        ? state.filtered.slice().sort(sortSoonest)
        : printEventsForMonth(state.focusMonth || monthKeyFromDate(new Date()));
    const title = (state.data && state.data.title) || "Events";
    let rows = events
      .map((ev) => {
        const thumb = imageUrl(ev, true) || imageUrl(ev, false);
        return `<tr>
          <td class="print-thumb">${thumb ? `<img src="${escapeAttr(thumb)}" alt="" />` : ""}</td>
          <td>${escapeHtml(ev.date || "")}</td>
          <td>${escapeHtml(ev.endDate || "")}</td>
          <td>${escapeHtml(ev.time || "")}</td>
          <td>${escapeHtml(ev.title || "")}</td>
          <td>${escapeHtml(ev.location || "")}</td>
        </tr>`;
      })
      .join("");
    if (!rows) rows = `<tr><td colspan="6">No events.</td></tr>`;
    return `<h1>${escapeHtml(title)} (${events.length})</h1>
      <table class="print-table">
        <thead><tr><th></th><th>Start</th><th>End</th><th>Time</th><th>Title</th><th>Location</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function prepareCalendarPrint() {
    const host = $("#print-cal");
    if (!host) return;
    const mode = state.calMode || "month";
    let html = "";
    if (mode === "week") html = buildPrintWeekHtml();
    else if (mode === "day") html = buildPrintDayHtml();
    else if (mode === "agenda") html = buildPrintAgendaHtml();
    else html = buildPrintMonthHtml();
    host.innerHTML = html;
  }

  function printPage() {
    if (state.view === "rails" || !state.printEnabled) return;
    const host = $("#print-cal");
    if (state.view === "calendar") {
      prepareCalendarPrint();
      document.body.classList.add("printing-cal");
    } else if (state.view === "table") {
      if (host) host.innerHTML = buildPrintTableHtml();
      document.body.classList.add("printing-cal");
    } else if (host) {
      host.innerHTML = "";
    }
    window.print();
  }

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing-cal");
    const host = $("#print-cal");
    if (host) host.innerHTML = "";
  });

  /* ===== Dates popup (Month | Range tabs) ===== */
  let rangeState = { picking: null, from: "", to: "", monthL: null };
  let datesTab = "range";

  function openMonthPopup() {
    openDatesPopup("month");
  }

  function openRangePopup() {
    openDatesPopup("range");
  }

  function openDatesPopup(tab) {
    datesTab = tab === "month" ? "month" : "range";
    const popup = $("#range-popup");
    popup.classList.remove("hidden");
    rangeState.from = state.dateFrom;
    rangeState.to = state.dateTo;
    rangeState.picking = "from";
    const seed =
      (state.focusMonth && /^\d{4}-\d{2}$/.test(state.focusMonth) && state.focusMonth) ||
      (rangeState.from && rangeState.from.slice(0, 7)) ||
      monthKeyFromDate(new Date());
    const [y, m] = seed.split("-").map(Number);
    rangeState.monthL = new Date(y, m - 1, 1);
    renderDatesPopup();
    addBackdrop(popup, closeRangePopup);
  }

  function closeRangePopup() {
    $("#range-popup").classList.add("hidden");
    $("#month-popup")?.classList.add("hidden");
    removeBackdrop();
  }

  function closeMonthPopup() {
    closeRangePopup();
  }

  function applyRange(from, to) {
    state.dateFrom = from || "";
    state.dateTo = to || "";
    $("#date-from").value = state.dateFrom;
    $("#date-to").value = state.dateTo;
    updateRangeBtn();
    if (from && /^\d{4}-\d{2}/.test(from)) {
      state.focusMonth = from.slice(0, 7);
    }
    applyFilters();
    closeRangePopup();
  }

  function renderDatesPopup() {
    const popup = $("#range-popup");
    if (!popup) return;
    let html = '<div class="dates-tabs">';
    html += '<div class="settings-choices settings-split dates-tab-btns">';
    html += `<button type="button" data-dates-tab="month" class="${datesTab === "month" ? "active" : ""}">Month</button>`;
    html += `<button type="button" data-dates-tab="range" class="${datesTab === "range" ? "active" : ""}">Range</button>`;
    html += "</div>";
    html += '<button type="button" class="month-popup-close dates-close" aria-label="Close">\u00d7</button>';
    html += "</div>";
    if (datesTab === "month") html += renderMonthTabHtml();
    else html += renderRangeTabHtml();
    popup.innerHTML = html;

    popup.querySelector(".dates-close")?.addEventListener("click", closeRangePopup);
    popup.querySelectorAll("[data-dates-tab]").forEach((btn) =>
      btn.addEventListener("click", () => {
        datesTab = btn.dataset.datesTab === "month" ? "month" : "range";
        renderDatesPopup();
      })
    );
    if (datesTab === "month") bindMonthTab(popup);
    else bindRangeTab(popup);
  }

  function renderMonthTabHtml() {
    const cur = state.focusMonth || monthKeyFromDate(new Date());
    const [selY, selM] = cur.split("-").map(Number);
    const allKeys = new Set(state.events.map(monthKey).filter(Boolean));
    const yearSet = new Set([...allKeys].map((k) => Number(k.split("-")[0])));
    yearSet.add(new Date().getFullYear());
    const years = [...yearSet].sort();
    let html = '<div class="month-popup-grid"><div class="month-popup-years">';
    years.forEach((y) => {
      const hasEvents = [...allKeys].some((k) => k.startsWith(`${y}-`));
      const cls = (y === selY ? "active" : "") + (hasEvents ? "" : " muted");
      html += `<button type="button" data-y="${y}" class="${cls.trim()}">${y}</button>`;
    });
    html += '</div><div class="month-popup-months">';
    const mNames = Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleDateString(undefined, { month: "short" })
    );
    mNames.forEach((name, i) => {
      const m = i + 1;
      const key = `${selY}-${String(m).padStart(2, "0")}`;
      const hasEvents = allKeys.has(key);
      const active = m === selM ? " active" : "";
      const muted = hasEvents ? "" : " muted";
      const dis = hasEvents ? "" : " disabled";
      html += `<button type="button" data-m="${m}" class="${(active + muted).trim()}"${dis}>${name}</button>`;
    });
    html += "</div></div>";
    return html;
  }

  function bindMonthTab(popup) {
    const cur = state.focusMonth || monthKeyFromDate(new Date());
    const [selY, selM] = cur.split("-").map(Number);
    const allKeys = new Set(state.events.map(monthKey).filter(Boolean));
    let pickY = selY;
    const updateMonths = () => {
      popup.querySelectorAll(".month-popup-months button").forEach((btn) => {
        const m = Number(btn.dataset.m);
        const k = `${pickY}-${String(m).padStart(2, "0")}`;
        const has = allKeys.has(k);
        btn.classList.toggle("muted", !has);
        btn.disabled = !has;
        btn.classList.toggle("active", m === selM && pickY === selY);
      });
    };
    popup.querySelectorAll(".month-popup-years button").forEach((btn) =>
      btn.addEventListener("click", () => {
        pickY = Number(btn.dataset.y);
        popup.querySelectorAll(".month-popup-years button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        updateMonths();
      })
    );
    popup.querySelectorAll(".month-popup-months button").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const m = Number(btn.dataset.m);
        setFocusMonth(`${pickY}-${String(m).padStart(2, "0")}`);
        closeRangePopup();
      })
    );
  }

  function renderRangeTabHtml() {
    const today = todayISO();
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const weekStart = addDays(now, 1 - dayOfWeek);
    const weekEnd = addDays(weekStart, 6);
    const y = now.getFullYear();
    const m = now.getMonth();
    let html = '<div class="range-presets">';
    html += `<button type="button" data-preset="today">From today</button>`;
    html += `<button type="button" data-preset="week">This week</button>`;
    html += `<button type="button" data-preset="month">This month</button>`;
    html += `<button type="button" data-preset="next">Next month</button>`;
    html += "</div>";
    html += '<div class="range-cals">';
    html += renderRangeMonth(rangeState.monthL);
    const monthR = new Date(rangeState.monthL.getFullYear(), rangeState.monthL.getMonth() + 1, 1);
    html += renderRangeMonth(monthR);
    html += "</div>";
    html += '<div class="range-popup-actions">';
    html += '<button type="button" class="btn ghost" data-cancel>Cancel</button>';
    html += '<button type="button" class="btn primary" data-ok>OK</button>';
    html += "</div>";
    return html;
  }

  function bindRangeTab(popup) {
    const today = todayISO();
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const weekStart = addDays(now, 1 - dayOfWeek);
    const weekEnd = addDays(weekStart, 6);
    const y = now.getFullYear();
    const m = now.getMonth();
    popup.querySelector("[data-cancel]")?.addEventListener("click", closeRangePopup);
    popup.querySelector("[data-ok]")?.addEventListener("click", () => {
      applyRange(rangeState.from || "", rangeState.to || "");
    });
    popup.querySelectorAll("[data-preset]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const p = btn.dataset.preset;
        if (p === "today") applyRange(today, "");
        else if (p === "week") applyRange(isoDate(weekStart), isoDate(weekEnd));
        else if (p === "month") {
          applyRange(isoDate(new Date(y, m, 1)), isoDate(new Date(y, m + 1, 0)));
        } else if (p === "next") {
          applyRange(isoDate(new Date(y, m + 1, 1)), isoDate(new Date(y, m + 2, 0)));
        }
      })
    );
    popup.querySelectorAll(".range-cal-head button").forEach((btn) =>
      btn.addEventListener("click", () => {
        const d = Number(btn.dataset.dir);
        rangeState.monthL = new Date(
          rangeState.monthL.getFullYear(),
          rangeState.monthL.getMonth() + d,
          1
        );
        renderDatesPopup();
      })
    );
    popup.querySelectorAll(".range-cal-grid .day:not(.other)").forEach((el) =>
      el.addEventListener("click", () => {
        const iso = el.dataset.date;
        if (rangeState.picking === "from") {
          rangeState.from = iso;
          rangeState.to = "";
          rangeState.picking = "to";
          renderDatesPopup();
        } else {
          if (iso < rangeState.from) {
            rangeState.to = rangeState.from;
            rangeState.from = iso;
          } else {
            rangeState.to = iso;
          }
          rangeState.picking = "from";
          renderDatesPopup();
        }
      })
    );
  }

  function renderRangePopup() {
    renderDatesPopup();
  }

  function renderRangeMonth(d) {
    const y = d.getFullYear();
    const m = d.getMonth();
    const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    let html = '<div class="range-cal">';
    html += '<div class="range-cal-head">';
    html += `<button data-dir="-1" aria-label="Previous">‹</button>`;
    html += `<span>${escapeHtml(label)}</span>`;
    html += `<button data-dir="1" aria-label="Next">›</button>`;
    html += "</div>";
    html += '<div class="range-cal-grid">';
    const dow = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    dow.forEach((n) => { html += `<span class="dow">${n}</span>`; });
    const first = new Date(y, m, 1);
    let startDay = first.getDay() || 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let i = 1; i < startDay; i++) html += '<span class="day other"></span>';
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      let cls = "day";
      if (rangeState.from && iso === rangeState.from) cls += " range-start";
      if (rangeState.to && iso === rangeState.to) cls += " range-end";
      if (rangeState.from && rangeState.to && iso > rangeState.from && iso < rangeState.to) cls += " in-range";
      html += `<span class="${cls}" data-date="${iso}">${day}</span>`;
    }
    html += "</div></div>";
    return html;
  }

  /* ===== Backdrop helper ===== */
  let _backdrop = null;
  function addBackdrop(popup, closeFn) {
    removeBackdrop();
    _backdrop = document.createElement("div");
    _backdrop.className = "popup-backdrop";
    _backdrop.addEventListener("click", closeFn);
    document.body.appendChild(_backdrop);
  }
  function removeBackdrop() {
    if (_backdrop) {
      _backdrop.remove();
      _backdrop = null;
    }
  }

  /* ===== Settings popup ===== */
  function openSettingsPopup() {
    closeActionDropdowns();
    closeFilterPopups();
    const popup = $("#settings-popup");
    popup.classList.remove("hidden");
    renderSettingsPopup();
    addBackdrop(popup, closeSettingsPopup);
  }

  function closeSettingsPopup() {
    $("#settings-popup").classList.add("hidden");
    removeBackdrop();
  }

  function renderSettingsPopup() {
    const popup = $("#settings-popup");
    let html = '<div class="settings-popup-head"><span>Settings</span>';
    html += '<button type="button" class="month-popup-close" aria-label="Close">\u00d7</button></div>';
    html += '<div class="settings-row"><label>Columns</label><div class="settings-choices">';
    [1, 2, 3].forEach((n) => {
      const active = state.cardsPerRow === n ? " active" : "";
      html += `<button type="button" data-cols="${n}" class="${active.trim()}">${n}</button>`;
    });
    html += "</div></div>";
    html += '<div class="settings-duo">';
    html += '<div class="settings-row settings-block"><label>Views</label><div class="settings-toggles">';
    ALL_VIEWS.forEach((view) => {
      if (!state.enabledViews.has(view)) return;
      const checked = !state.hiddenViews.has(view) ? " checked" : "";
      html += `<label><input type="checkbox" data-show-view="${view}"${checked} /> ${VIEW_LABELS[view] || view}</label>`;
    });
    html += "</div></div>";
    html += '<div class="settings-row settings-block"><label>Filters</label><div class="settings-toggles">';
    ALL_FILTERS.forEach((key) => {
      const checked = !state.hiddenFilters.has(key) ? " checked" : "";
      html += `<label><input type="checkbox" data-show-filter="${key}"${checked} /> ${FILTER_LABELS[key] || key}</label>`;
    });
    html += "</div></div></div>";
    if (state.deferredInstall) {
      html += '<div class="settings-row"><button type="button" class="btn primary" data-install>Install app</button></div>';
    } else if (isIos() && !isStandalone()) {
      html +=
        '<p class="settings-hint muted">Install: Share → Add to Home Screen</p>';
    }
    popup.innerHTML = html;
    popup.querySelector(".month-popup-close").addEventListener("click", closeSettingsPopup);
    popup.querySelectorAll("[data-cols]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.cardsPerRow = Number(btn.dataset.cols);
        applyCardsPerRow();
        saveSettings();
        popup.querySelectorAll("[data-cols]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      })
    );
    popup.querySelectorAll("[data-show-view]").forEach((input) =>
      input.addEventListener("change", () => {
        const view = input.dataset.showView;
        if (input.checked) state.hiddenViews.delete(view);
        else state.hiddenViews.add(view);
        if (!viewIsAvailable(state.view)) state.view = firstEnabledView();
        applyViewConfig();
        setView(state.view);
        saveSettings();
      })
    );
    popup.querySelectorAll("[data-show-filter]").forEach((input) =>
      input.addEventListener("change", () => {
        const key = input.dataset.showFilter;
        if (input.checked) state.hiddenFilters.delete(key);
        else state.hiddenFilters.add(key);
        applyFilterVisibility();
        saveSettings();
      })
    );
    const installBtn = popup.querySelector("[data-install]");
    if (installBtn) {
      installBtn.addEventListener("click", async () => {
        await promptInstall();
        renderSettingsPopup();
      });
    }
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true
    );
  }

  async function promptInstall() {
    const ev = state.deferredInstall;
    if (!ev) return;
    state.deferredInstall = null;
    ev.prompt();
    try {
      await ev.userChoice;
    } catch (_) {}
    updateInstallUi();
  }

  function updateInstallUi() {
    const canInstall = Boolean(state.deferredInstall);
    const topBtn = $("#btn-install");
    if (topBtn) {
      topBtn.classList.toggle("hidden", !canInstall);
    }
    const aboutBtn = $("#about-install");
    if (aboutBtn) {
      aboutBtn.disabled = !canInstall;
      aboutBtn.title = canInstall
        ? "Install this app"
        : "Install not available in this browser (or already installed)";
    }
    if (!$("#settings-popup").classList.contains("hidden")) renderSettingsPopup();
  }

  function registerPwa() {
    if (!("serviceWorker" in navigator)) return;
    const secure =
      location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";
    if (!secure) return;
    navigator.serviceWorker.register("service-worker.js", { scope: "./" }).catch(() => {});
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      state.deferredInstall = e;
      updateInstallUi();
    });
    window.addEventListener("appinstalled", () => {
      state.deferredInstall = null;
      updateInstallUi();
    });
  }

  function bindUi() {
    $$(".top .views > .view-btn").forEach((btn) =>
      btn.addEventListener("click", () => setView(btn.dataset.view))
    );
    $$(".top-view-btn").forEach((btn) =>
      btn.addEventListener("click", () => toggleTopView(btn.dataset.view))
    );
    bindLongPress($("#btn-cats"), {
      onShort: (e) => toggleFilterPopup("#cat-popup", "#btn-cats", e),
      onLong: () => {
        clearCategoryFilter();
        saveSettings();
      },
    });
    bindLongPress($("#btn-venues"), {
      onShort: (e) => toggleFilterPopup("#loc-popup", "#btn-venues", e),
      onLong: () => {
        clearLocationFilter();
        saveSettings();
      },
    });
    $("#btn-event-toggles")?.addEventListener("click", (e) =>
      toggleFilterPopup("#toggles-popup", "#btn-event-toggles", e)
    );
    bindSwipeCycle($("#lang-dd-btn"), {
      onCycle: cycleLang,
      onTap: toggleLangDropdown,
    });
    bindSwipeCycle($("#theme-dd-btn"), {
      onCycle: cycleTheme,
      onTap: toggleThemeDropdown,
    });
    $$("#lang-dd-menu [data-lang]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setLang(btn.dataset.lang);
      })
    );
    $$("#theme-dd-menu [data-theme-choice]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setTheme(btn.dataset.themeChoice);
      })
    );
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#lang-dd")) closeLangDropdown();
      if (!e.target.closest("#theme-dd")) closeThemeDropdown();
      if (!e.target.closest("#share-dd")) closeShareDropdown();
    });
    $("#btn-share-site")?.addEventListener("click", onShareSiteClick);
    $("#share-dd-menu")?.addEventListener("click", async (e) => {
      const item = e.target.closest("[data-site-share]");
      if (!item) return;
      e.stopPropagation();
      const kind = item.dataset.siteShare;
      if (kind === "native") {
        await shareSiteNative();
        closeShareDropdown();
      } else if (kind === "copy") {
        try {
          await navigator.clipboard.writeText(siteShareUrl());
          item.textContent = "Copied";
          setTimeout(() => {
            item.textContent = "Copy link";
          }, 1200);
        } catch (_) {
          prompt("Copy this link", siteShareUrl());
        }
      } else if (kind === "print") {
        closeShareDropdown();
        printPage();
      } else {
        closeShareDropdown();
      }
    });
    $("#btn-settings").addEventListener("click", (e) => {
      e.stopPropagation();
      openSettingsPopup();
    });
    $("#btn-about").addEventListener("click", () => {
      updateInstallUi();
      $("#about").classList.remove("hidden");
    });
    $("#about-install")?.addEventListener("click", () => promptInstall());
    $("#detail-star").addEventListener("click", (e) => {
      if (state.selected) toggleStar(state.selected.id, e);
    });
    $("#detail-where").addEventListener("click", () => {
      if (state.selected) openLocationOnMap(state.selected);
    });
    $("#detail-where").addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && state.selected) {
        e.preventDefault();
        openLocationOnMap(state.selected);
      }
    });
    $$("[data-about-close]").forEach((el) =>
      el.addEventListener("click", () => $("#about").classList.add("hidden"))
    );
    $("#month-prev").addEventListener("click", () => shiftMonth(-1));
    $("#month-next").addEventListener("click", () => shiftMonth(1));
    $("#month-title").addEventListener("click", openMonthPopup);
    $$(".cal-mode-btn").forEach((btn) =>
      btn.addEventListener("click", () => applyCalMode(btn.dataset.calMode))
    );
    $$(".rails-mode-btn").forEach((btn) =>
      btn.addEventListener("click", () => applyRailsLayout(btn.dataset.railsLayout))
    );
    const railsScroll = $("#rails-scroll");
    if (railsScroll) {
      railsScroll.addEventListener("scroll", onRailsScroll, { passive: true });
    }
    $("#stars-clear").addEventListener("click", clearAllStars);
    $("#search").addEventListener("input", (e) => {
      state.search = (e.target.value || "").trim().toLowerCase();
      applyFilters();
    });
    $("#search-clear")?.addEventListener("click", () => {
      const input = $("#search");
      if (input) input.value = "";
      state.search = "";
      applyFilters();
    });
    $("#date-from")?.addEventListener("change", (e) => {
      state.dateFrom = e.target.value || "";
      applyFilters();
    });
    $("#date-to")?.addEventListener("change", (e) => {
      state.dateTo = e.target.value || "";
      applyFilters();
    });
    $("#loc-all")?.addEventListener("click", clearLocationFilter);
    $("#cat-all")?.addEventListener("click", clearCategoryFilter);
    $("#hide-allday").addEventListener("change", (e) => {
      state.hideAllDay = e.target.checked;
      updateTogglesButton();
      saveSettings();
      applyFilters();
    });
    $("#hide-multiday").addEventListener("change", (e) => {
      state.hideMultiDay = e.target.checked;
      updateTogglesButton();
      saveSettings();
      applyFilters();
    });
    $("#cat-done").addEventListener("click", closeFilterPopups);
    $("#loc-done").addEventListener("click", closeFilterPopups);
    $("#toggles-done")?.addEventListener("click", closeFilterPopups);
    $("#cat-clear").addEventListener("click", clearCategoryFilter);
    $("#loc-clear").addEventListener("click", clearLocationFilter);
    $("#cat-search")?.addEventListener("input", (e) => {
      filterCheckLabels("#cat-checks", e.target.value);
    });
    $("#loc-search")?.addEventListener("input", (e) => {
      filterCheckLabels("#loc-checks", e.target.value);
    });
    $("#cat-search-clear")?.addEventListener("click", () => {
      const input = $("#cat-search");
      if (input) input.value = "";
      filterCheckLabels("#cat-checks", "");
    });
    $("#loc-search-clear")?.addEventListener("click", () => {
      const input = $("#loc-search");
      if (input) input.value = "";
      filterCheckLabels("#loc-checks", "");
    });
    $$("[data-cat-mode]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.catMode = btn.dataset.catMode === "and" ? "and" : "or";
        syncCatModeButtons();
        saveSettings();
        applyFilters();
      })
    );
    $$(".filter-popup").forEach((popup) =>
      popup.addEventListener("click", (e) => e.stopPropagation())
    );
    bindHScroll($(".views-wrap"));
    /* filters rail uses thin scrollbar; grouped mode uses sheet */
    $("#detail-hero").addEventListener("click", () => {
      if (state.heroSrc) openLightbox(state.heroSrc, state.selected?.title || "");
    });
    $$("[data-lightbox-close]").forEach((el) => el.addEventListener("click", closeLightbox));
    $("#lightbox").addEventListener("click", (e) => {
      if (e.target.id === "lightbox") closeLightbox();
    });
    $$("[data-close]").forEach((el) => el.addEventListener("click", closeDetail));
    bindDetailDrawer();
    bindCalMenu($("#btn-cal"), $("#cal-menu"), () => state.selected && downloadIcs(state.selected));
    $("#btn-share").addEventListener("click", () => state.selected && shareEvent(state.selected));
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".cal-menu-wrap")) closeCalMenus();
    });
    const installTop = $("#btn-install");
    if (installTop) installTop.addEventListener("click", () => promptInstall());
    $('[data-share="copy"]').addEventListener("click", async () => {
      if (!state.selected) return;
      const url = eventShareUrl(state.selected);
      try {
        await navigator.clipboard.writeText(url);
        $('[data-share="copy"]').textContent = "Copied";
        setTimeout(() => {
          $('[data-share="copy"]').textContent = "Copy link";
        }, 1200);
      } catch (_) {
        prompt("Copy this link", url);
      }
    });
    const scrollTopBtn = $("#scroll-top");
    let scrollIdle;
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      scrollTopBtn.classList.toggle("visible", y > 240);
      scrollTopBtn.classList.add("moving");
      clearTimeout(scrollIdle);
      scrollIdle = setTimeout(() => scrollTopBtn.classList.remove("moving"), 700);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.addEventListener("hashchange", readHash);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if ([...$$(".cal-menu")].some((m) => !m.classList.contains("hidden"))) closeCalMenus();
        else if ($("#lang-dd-menu") && !$("#lang-dd-menu").classList.contains("hidden")) closeLangDropdown();
        else if ($("#theme-dd-menu") && !$("#theme-dd-menu").classList.contains("hidden")) closeThemeDropdown();
        else if ($("#share-dd-menu") && !$("#share-dd-menu").classList.contains("hidden")) closeShareDropdown();
        else if (![...$$(".filter-popup")].every((p) => p.classList.contains("hidden"))) closeFilterPopups();
        else if (!$("#settings-popup").classList.contains("hidden")) closeSettingsPopup();
        else if (!$("#range-popup").classList.contains("hidden")) closeRangePopup();
        else if (!$("#lightbox").classList.contains("hidden")) closeLightbox();
        else if (!$("#about").classList.contains("hidden")) $("#about").classList.add("hidden");
        else if (!$("#detail").classList.contains("hidden")) closeDetail();
        else if (!$("#map-sheet").classList.contains("hidden")) closeMapSheet();
      }
    });
    window.addEventListener("resize", () => {
      applyToolbarLayout();
      refreshHScrollFades();
      if (state.view === "calendar" && state.calMode !== "agenda") {
        renderCustomCalendar();
      }
    });
  }

  function readHash() {
    const m = location.hash.match(/^#e=(.+)$/);
    if (m) openDetail(decodeURIComponent(m[1]));
  }

  async function boot() {
    state.enabledViews = parseEnabledViews();
    state.printEnabled = parsePrintEnabled();
    loadSettings();
    syncThemeUi();
    syncLangButtons();
    ensureRailsHorizon();
    const today = todayISO();
    /* Always open on "from today" — don't restore a stale saved range/month as the landing window */
    state.dateFrom = today;
    state.dateTo = "";
    state.focusMonth = monthKeyFromDate(new Date());
    if (!state.enabledViews.has(state.view)) state.view = firstEnabledView();
    applyViewConfig();
    applyToolbarLayout();
    bindUi();
    registerPwa();
    applySettingsToForm();
    try {
      const res = await fetch("data/public.json", { cache: "no-store" });
      state.data = await res.json();
    } catch (_) {
      state.data = {
        title: "Events",
        events: [],
        center: { lat: 36.451456, lng: 28.2234119, zoom: 12 },
      };
    }
    document.title = state.data.title || "Events";
    setBrandTitle();
    state.rawEvents = (Array.isArray(state.data.events) ? state.data.events : []).slice();
    rebuildEventsFromLang();
    syncLangButtons();
    startClock();
    renderUpdateInfo();
    detectAppUpdated();
    renderCategoryPicker();
    renderLocationFilter();
    setView(state.view || firstEnabledView());
    readHash();
  }

  boot();
})();
