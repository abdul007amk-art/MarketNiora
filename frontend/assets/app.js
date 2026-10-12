(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const SOURCE_REQUIRED = "SOURCE_REQUIRED";

  function setText(id, value) {
    const node = byId(id);
    if (node) node.textContent = value == null ? "—" : String(value);
  }

  function readableTime(epoch) {
    if (!Number.isFinite(epoch)) return "—";
    const date = new Date(epoch);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  function announce(message) {
    const toast = byId("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => toast.classList.remove("visible"), 3600);
  }

  function setProviderUnknown(message) {
    setText("provider-status-title", "Market-data status unknown");
    setText("provider-status-detail", message || "The API could not verify a provider.");
    setText("provider-name", "UNKNOWN");
    setText("provider-checked-at", "—");
    setText("sidebar-source-title", "Data status unknown");
    setText("sidebar-source-subtitle", "API runtime not verified");
    const pulse = byId("provider-pulse");
    const indicator = byId("sidebar-source-indicator");
    if (pulse) pulse.className = "status-pulse warn";
    if (indicator) indicator.className = "source-indicator warn";
  }

  function setProviderState(body) {
    const configured = body && body.configured === true;
    const healthy = body && body.status === "HEALTHY";
    const currentTime = readableTime(body && body.lastCheckedAt);
    setText("provider-name", body && body.provider ? body.provider : "UNKNOWN");
    setText("provider-checked-at", currentTime);
    const pulse = byId("provider-pulse");
    const indicator = byId("sidebar-source-indicator");

    if (!configured || (body && body.truthState === "NOT_CONFIGURED")) {
      setText("provider-status-title", "Market-data provider not configured");
      setText("provider-status-detail", "No live quote or sector snapshot is claimed. Configure an approved source before publishing market readings.");
      setText("sidebar-source-title", "Source required");
      setText("sidebar-source-subtitle", "No provider connected");
      if (pulse) pulse.className = "status-pulse warn";
      if (indicator) indicator.className = "source-indicator warn";
      return;
    }
    if (healthy) {
      setText("provider-status-title", "Market-data provider responds");
      setText("provider-status-detail", "Provider health is verified; this alone does not certify every quote or calculation.");
      setText("sidebar-source-title", "Provider responding");
      setText("sidebar-source-subtitle", "Quote freshness checked per request");
      if (pulse) pulse.className = "status-pulse healthy";
      if (indicator) indicator.className = "source-indicator healthy";
      return;
    }
    setText("provider-status-title", "Configured provider unavailable");
    setText("provider-status-detail", "Quotes remain unavailable until the source recovers and passes freshness checks.");
    setText("sidebar-source-title", "Provider unavailable");
    setText("sidebar-source-subtitle", "No current reading is claimed");
    if (pulse) pulse.className = "status-pulse warn";
    if (indicator) indicator.className = "source-indicator warn";
  }

  async function loadProviderStatus() {
    const button = byId("provider-refresh");
    if (button) button.disabled = true;
    try {
      const response = await fetch("/market-data/provider-health", {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      const body = await response.json();
      if (!response.ok) {
        setProviderUnknown(body && body.detail ? body.detail : "Provider health could not be verified.");
      } else {
        setProviderState(body);
      }
    } catch (_error) {
      setProviderUnknown("API unreachable. Runtime status cannot be verified.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function setQuoteUnavailable(symbol, state, detail) {
    const result = byId("quote-result");
    const details = byId("quote-details");
    if (details) details.hidden = true;
    if (!result) return;
    result.hidden = false;
    result.className = "quote-result unavailable";
    const icon = result.querySelector(".quote-empty-icon");
    const title = result.querySelector("strong");
    const paragraph = result.querySelector("p");
    if (icon) icon.textContent = state === "NOT_CONFIGURED" ? "!" : "⌕";
    if (title) title.textContent = symbol ? symbol + " · Quote unavailable" : "Look up a stock symbol";
    if (paragraph) paragraph.textContent = detail || (state === "NOT_CONFIGURED"
      ? "No provider is configured. The system has not substituted a demo or estimated price."
      : "The source did not return a verified current price. Value remains XX.");
    setText("rotation-empty-title", "Rotation not calculated");
  }

  function renderQuote(body) {
    const result = byId("quote-result");
    const details = byId("quote-details");
    const hasPrice = body && typeof body.price === "number" && Number.isFinite(body.price);
    const state = body && body.truthState ? body.truthState : "UNKNOWN";
    if (!hasPrice) {
      setQuoteUnavailable(
        body && body.symbol ? body.symbol : "",
        state,
        state === "NOT_CONFIGURED"
          ? "No provider is configured. The system has not substituted a demo or estimated price."
          : "The source did not return a verified price. Value remains XX."
      );
      return;
    }

    if (result) result.hidden = true;
    if (details) details.hidden = false;
    setText("quote-symbol-label", body.symbol || "SYMBOL");
    setText("quote-price", new Intl.NumberFormat("en-IN", {
      style: "currency", currency: body.currency || "INR", maximumFractionDigits: 2
    }).format(body.price));
    setText("quote-currency", body.currency || "INR");
    setText("quote-data-status", body.dataStatus || "UNKNOWN");
    setText("quote-source", body.source || "UNKNOWN");
    setText("quote-asof", readableTime(body.asOf));
  }

  async function lookupQuote(rawSymbol) {
    const symbol = String(rawSymbol || "").trim().toUpperCase();
    if (!/^[A-Z0-9&.-]{1,25}$/.test(symbol)) {
      announce("Enter a valid listed-stock symbol.");
      return;
    }
    setQuoteUnavailable(symbol, "UNKNOWN", "Checking the configured source…");
    try {
      const response = await fetch("/market-data/quote/" + encodeURIComponent(symbol), {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      const body = await response.json();
      if (!response.ok) {
        renderQuote(body || { symbol, price: null, truthState: "UNKNOWN" });
        if (response.status === 503) announce("Market-data provider could not return a quote.");
        else if (response.status === 400) announce("The symbol was not accepted by the API.");
        return;
      }
      renderQuote(body);
    } catch (_error) {
      setQuoteUnavailable(symbol, "UNKNOWN", "API unreachable. No market price has been inferred.");
      announce("Quote lookup unavailable; no value was substituted.");
    }
  }

  function showView(name) {
    const views = document.querySelectorAll(".page-view");
    views.forEach((section) => {
      const active = section.getAttribute("data-page") === name;
      section.classList.toggle("active-view", active);
      section.hidden = !active;
    });
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.getAttribute("data-view") === name);
    });
    const labels = {
      overview: "OVERVIEW",
      rotation: "SECTOR ROTATION",
      stocks: "STOCK EXPLORER",
      themes: "THEME EXPLORER",
      "value-chain": "BUSINESS VALUE CHAIN",
      fundamentals: "FUNDAMENTALS",
      research: "RESEARCH & EVIDENCE",
      portfolio: "PORTFOLIO"
    };
    setText("current-section", labels[name] || "OVERVIEW");
    document.title = "MarketNiora — " + (labels[name] || "Market Intelligence");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindNavigation() {
    document.querySelectorAll("[data-view]").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        const name = item.getAttribute("data-view");
        if (name) {
          showView(name);
          history.replaceState(null, "", "#" + name);
        }
      });
    });
    document.querySelectorAll("[data-view-link]").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        const name = item.getAttribute("data-view-link");
        if (name) {
          showView(name);
          history.replaceState(null, "", "#" + name);
        }
      });
    });
    const start = window.location.hash.replace(/^#/, "");
    const accepted = ["overview", "rotation", "stocks", "themes", "value-chain", "fundamentals", "research", "portfolio"];
    showView(accepted.includes(start) ? start : "overview");
  }

  function bindSearch() {
    const form = byId("quote-form");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        lookupQuote(byId("quote-symbol").value);
      });
    }
    const secondaryButton = byId("secondary-search");
    if (secondaryButton) {
      secondaryButton.addEventListener("click", () => lookupQuote(byId("secondary-symbol").value));
    }
    const secondaryInput = byId("secondary-symbol");
    if (secondaryInput) {
      secondaryInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          lookupQuote(secondaryInput.value);
        }
      });
    }
    const refresh = byId("provider-refresh");
    if (refresh) refresh.addEventListener("click", loadProviderStatus);
    const refreshTop = byId("refresh-button");
    if (refreshTop) refreshTop.addEventListener("click", loadProviderStatus);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindNavigation();
    bindSearch();
    loadProviderStatus();
    // Initial view intentionally has no synthetic sector leaders or prices.
    setQuoteUnavailable("", "NOT_CONFIGURED", "Search a stock only after an approved data source is connected.");
  });
})();