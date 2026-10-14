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
    if (body && body.status === "UNKNOWN") {
      setText("provider-status-title", "Provider configured · health not verified");
      setText("provider-status-detail", body.detail || "A successful, recent provider request is needed to verify API health.");
      setText("sidebar-source-title", "Health unverified");
      setText("sidebar-source-subtitle", "No current market reading is implied");
      if (pulse) pulse.className = "status-pulse warn";
      if (indicator) indicator.className = "source-indicator warn";
      return;
    }
    setText("provider-status-title", "Configured provider unavailable");
    setText("provider-status-detail", body && body.detail ? body.detail : "Quotes remain unavailable until the source recovers and passes freshness checks.");
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


  function clearAndMessage(containerId, message) {
    const container = byId(containerId);
    if (!container) return;
    container.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.className = "workspace-empty";
    paragraph.textContent = message;
    container.appendChild(paragraph);
  }

  function appendDataRow(containerId, title, description, meta) {
    const container = byId(containerId);
    if (!container) return;
    const row = document.createElement("article");
    row.className = "data-row";
    const main = document.createElement("div");
    main.className = "data-row-main";
    const heading = document.createElement("strong");
    heading.textContent = title || "Unnamed record";
    main.appendChild(heading);
    if (description) {
      const detail = document.createElement("p");
      detail.textContent = description;
      main.appendChild(detail);
    }
    const footer = document.createElement("small");
    footer.textContent = meta || "Source status not supplied";
    row.append(main, footer);
    container.appendChild(row);
  }

  async function getWorkspaceJson(path) {
    const response = await fetch(path, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });
    let body;
    try {
      body = await response.json();
    } catch (_error) {
      throw new Error("The workspace API returned an unreadable response.");
    }
    // Symbol lookup uses 404 for an absent canonical identity and 409 when an
    // exchange must be selected. Preserve these structured truth states for UI.
    if (!response.ok && response.status !== 404 && response.status !== 409) {
      throw new Error(body && body.detail ? body.detail : "Canonical workspace data is not available in this runtime.");
    }
    return body;
  }

  async function loadWorkspaceSummary() {
    const status = byId("workspace-summary-status");
    const metrics = byId("workspace-summary-metrics");
    if (!status || !metrics) return;
    status.textContent = "Checking canonical database counts…";
    metrics.replaceChildren();
    try {
      const body = await getWorkspaceJson("/workspace/summary");
      const labels = [
        ["canonicalStocks", "Canonical stocks"],
        ["sectors", "Sectors"],
        ["subSectors", "Sub-sectors"],
        ["stockGroups", "Stock groups"],
        ["themes", "Themes"],
        ["verifiedThemeMemberships", "Verified theme links"],
        ["verifiedValueChainEvidence", "Verified value-chain evidence"],
        ["verifiedObservations", "Verified observations"]
      ];
      status.textContent = body.truthState === "NOT_LOADED"
        ? "Database responds, but canonical stock records have not been loaded. Seed target: 4,187; target is not a live count."
        : "Counts read from the canonical database. Counts alone do not imply every record is verified or current.";
      labels.forEach(([key, label]) => {
        const card = document.createElement("div");
        card.className = "summary-metric";
        const value = document.createElement("strong");
        value.textContent = typeof body[key] === "number" ? body[key].toLocaleString("en-IN") : "XX";
        const caption = document.createElement("span");
        caption.textContent = label;
        card.append(value, caption);
        metrics.appendChild(card);
      });
    } catch (error) {
      status.textContent = error instanceof Error
        ? error.message
        : "Canonical database status could not be verified. Counts remain unavailable.";
      status.classList.add("is-warning");
      metrics.replaceChildren();
    }
  }

  async function loadStocks() {
    const status = byId("stocks-status");
    const container = byId("stock-results");
    if (!status || !container) return;
    status.textContent = "Reading canonical stock registry…";
    container.replaceChildren();
    const query = byId("stock-query") ? byId("stock-query").value.trim() : "";
    const sector = byId("stock-sector") ? byId("stock-sector").value.trim() : "";
    const params = new URLSearchParams({ limit: "50" });
    if (query) params.set("q", query);
    if (sector) params.set("sector", sector);
    try {
      const body = await getWorkspaceJson("/workspace/stocks?" + params.toString());
      status.textContent = body.total === 0
        ? "No canonical stock records matched. This is not a substitute for the immutable MASTER_4187 source."
        : String(body.total.toLocaleString("en-IN")) + " canonical record(s) match; showing up to " + body.limit + ". Official scores are shown only when a locked, Owner-approved SS-1.0-R3 snapshot exists.";
      if (!Array.isArray(body.items) || body.items.length === 0) {
        clearAndMessage("stock-results", "No verified canonical stock records are available for this query.");
        return;
      }
      body.items.forEach((item) => {
        const sectorText = [item.sector, item.subSector].filter(Boolean).join(" › ");
        const score = item.stockScore && Number.isFinite(item.stockScore.value)
          ? "Official Stock Score " + item.stockScore.value + "/100"
          : "Official Stock Score: NOT_CONFIGURED";
        appendDataRow("stock-results",
          String(item.name || item.symbol || "Unnamed stock"),
          [String(item.exchange || "Exchange unknown") + ":" + String(item.symbol || "Symbol unknown"), sectorText || "Classification unavailable"].join(" · "),
          String(item.classificationStatus || "UNKNOWN") + " classification · " + score);
        const last = container.lastElementChild;
        if (last && item.shariahVerified === true) {
          const verified = document.createElement("span");
          verified.className = "verified-mark";
          verified.textContent = "✓ Verified Shariah";
          last.appendChild(verified);
        }
        if (last) {
          const openButton = document.createElement("button");
          openButton.type = "button";
          openButton.className = "row-action";
          openButton.textContent = "Open Company Detail";
          openButton.addEventListener("click", () => {
            setText("company-status", "Loading " + String(item.symbol || "") + " from the canonical registry…");
            if (byId("company-symbol")) byId("company-symbol").value = String(item.symbol || "");
            if (byId("company-exchange")) byId("company-exchange").value = String(item.exchange || "");
            showView("company");
            history.replaceState(null, "", "#company");
          });
          last.appendChild(openButton);
        }
      });
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Stock registry unavailable.";
      status.classList.add("is-warning");
      clearAndMessage("stock-results", "No stock universe has been substituted or fabricated.");
    }
  }

  async function loadRotation() {
    const status = byId("rotation-runtime-status") || byId("home-rotation-status");
    if (!status) return;
    const horizonControl = byId("rotation-horizon");
    const horizon = horizonControl ? horizonControl.value : "1D";
    status.textContent = "Loading approved rotation snapshots…";
    clearAndMessage("rotation-results", "Waiting for canonical score snapshots.");
    clearAndMessage("home-rotation-results", "Waiting for canonical score snapshots.");
    try {
      const body = await getWorkspaceJson("/workspace/rotation?horizon=" + encodeURIComponent(horizon) + "&limit=50");
      const message = body.truthState === "NO_VERIFIED_SNAPSHOTS"
        ? "No persisted rotation snapshot passed formula approval, lock and confidence gates for " + horizon + "."
        : "Showing persisted snapshots that passed formula approval, lock and hierarchy confidence eligibility. Last calculated time is shown per row.";
      status.textContent = message;
      const homeStatus = byId("home-rotation-status");
      if (homeStatus) homeStatus.textContent = message;
      const homeState = byId("home-rotation-state");
      if (homeState) homeState.textContent = body.truthState === "NO_VERIFIED_SNAPSHOTS" ? "NO APPROVED SNAPSHOTS" : "APPROVED SNAPSHOTS";
      if (!Array.isArray(body.items) || body.items.length === 0) {
        clearAndMessage("rotation-results", "No approved and eligible rotation snapshot is available. No ranking has been inferred.");
        clearAndMessage("home-rotation-results", "No verified sector leadership is being claimed.");
        setText("rotation-empty-title", "No approved rotation snapshot");
        return;
      }
      body.items.forEach((item) => {
        const rowText = "Level " + item.level + " · " + item.horizon + " · Confidence " + item.confidence + "%";
        const meta = "Score " + item.score + " · " + item.formulaKey + " " + item.formulaVersion + " · Calculated " + readableTime(Date.parse(item.calculatedAt));
        appendDataRow("rotation-results", String(item.entity || "Unknown group"), rowText + (item.sector ? " · " + item.sector : ""), meta);
        appendDataRow("home-rotation-results", String(item.entity || "Unknown group"), rowText + (item.sector ? " · " + item.sector : ""), meta);
      });
      setText("rotation-empty-title", "Persisted rotation snapshots loaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rotation data unavailable.";
      status.textContent = message;
      const homeStatus = byId("home-rotation-status");
      if (homeStatus) homeStatus.textContent = message;
      const homeState = byId("home-rotation-state");
      if (homeState) homeState.textContent = "DATA UNAVAILABLE";
      clearAndMessage("rotation-results", "No rankings are generated without approved persisted snapshots.");
      clearAndMessage("home-rotation-results", "No sector leaders or laggards have been fabricated.");
    }
  }

  async function loadThemes() {
    const status = byId("themes-status");
    const container = byId("theme-results");
    if (!status || !container) return;
    const query = byId("theme-query") ? byId("theme-query").value.trim() : "";
    const params = new URLSearchParams({ limit: "50" });
    if (query) params.set("q", query);
    status.textContent = "Reading theme hierarchy and verified stock memberships…";
    container.replaceChildren();
    try {
      const body = await getWorkspaceJson("/workspace/themes?" + params.toString());
      if (!Array.isArray(body.items) || body.items.length === 0) {
        status.textContent = "No verified theme records are available from the connected canonical database.";
        clearAndMessage("theme-results", "Pending research or unverified theme links are not promoted to verified mappings.");
        return;
      }
      status.textContent = "Verified theme memberships only. The API does not include pending or unverified stock links.";
      body.items.forEach((theme) => {
        const article = document.createElement("article");
        article.className = "data-row theme-data-row";
        const title = document.createElement("strong");
        title.textContent = String(theme.name || "Unnamed theme");
        article.appendChild(title);
        const subThemes = Array.isArray(theme.subThemes) ? theme.subThemes : [];
        subThemes.forEach((subTheme) => {
          const sub = document.createElement("p");
          const industries = Array.isArray(subTheme.industries) ? subTheme.industries : [];
          const industrySummary = industries.map((industry) => {
            const names = Array.isArray(industry.verifiedStocks)
              ? industry.verifiedStocks.map((stock) => String(stock.symbol || stock.name || "")).filter(Boolean)
              : [];
            return String(industry.name || "Industry") + (names.length ? " (" + names.join(", ") + ")" : "");
          });
          sub.textContent = String(subTheme.name || "Sub-theme") + (industrySummary.length ? " · " + industrySummary.join(" | ") : "");
          article.appendChild(sub);
        });
        container.appendChild(article);
      });
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Theme mappings unavailable.";
      status.classList.add("is-warning");
      clearAndMessage("theme-results", "No theme mapping has been invented.");
    }
  }


  function symbolEndpoint(path, symbol, exchange, limit) {
    const params = new URLSearchParams();
    if (exchange) params.set("exchange", exchange);
    if (Number.isInteger(limit)) params.set("limit", String(limit));
    const query = params.toString();
    return path + "/" + encodeURIComponent(symbol) + (query ? "?" + query : "");
  }

  function readSymbolForm(prefix) {
    const symbolNode = byId(prefix + "-symbol");
    const exchangeNode = byId(prefix + "-exchange");
    const symbol = symbolNode ? symbolNode.value.trim().toUpperCase() : "";
    const exchange = exchangeNode ? exchangeNode.value : "";
    if (!/^[A-Z0-9&.-]{1,25}$/.test(symbol)) {
      const statusNode = byId(prefix + "-status");
      if (statusNode) statusNode.textContent = "Enter a valid stock symbol before searching.";
      return null;
    }
    return { symbol, exchange };
  }

  function renderAmbiguousIdentity(containerId, body, onChoose) {
    const container = byId(containerId);
    if (!container) return;
    container.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.className = "workspace-empty";
    paragraph.textContent = "More than one canonical instrument uses this symbol. Select the exchange explicitly; no identity has been guessed.";
    container.appendChild(paragraph);
    (Array.isArray(body.candidates) ? body.candidates : []).forEach((candidate) => {
      const row = document.createElement("article");
      row.className = "data-row";
      const title = document.createElement("strong");
      title.textContent = String(candidate.name || candidate.symbol || "Canonical candidate");
      const detail = document.createElement("p");
      detail.textContent = String(candidate.exchange || "Exchange unknown") + ":" + String(candidate.symbol || "");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "row-action";
      button.textContent = "Use " + String(candidate.exchange || "exchange");
      button.addEventListener("click", () => onChoose(String(candidate.exchange || "")));
      row.append(title, detail, button);
      container.appendChild(row);
    });
  }

  function renderEvidenceItems(containerId, items, emptyMessage, formatItem) {
    const container = byId(containerId);
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      clearAndMessage(containerId, emptyMessage);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement("article");
      row.className = "data-row";
      const title = document.createElement("strong");
      title.textContent = String(item.stageName || item.evidenceKey || item.name || item.key || "Evidence record");
      row.appendChild(title);
      const detail = document.createElement("p");
      detail.textContent = formatItem(item);
      row.appendChild(detail);
      const sourceMeta = [
        item.source ? "Source: " + item.source : "",
        item.sourceName ? "Source: " + item.sourceName : "",
        item.sourceUrl ? "URL: " + item.sourceUrl : "",
        item.sourceTimestamp ? "Source time: " + readableTime(Date.parse(item.sourceTimestamp)) : "",
        item.effectiveTime ? "Effective: " + readableTime(Date.parse(item.effectiveTime)) : "",
        item.knowledgeTime ? "Known at: " + readableTime(Date.parse(item.knowledgeTime)) : "",
        item.observedAt ? "Observed: " + readableTime(Date.parse(item.observedAt)) : "",
        item.truthState ? "Truth: " + item.truthState : "",
        item.verificationStatus ? "Verification: " + item.verificationStatus : ""
      ].filter(Boolean).join(" · ");
      if (sourceMeta) {
        const meta = document.createElement("small");
        meta.textContent = sourceMeta;
        row.appendChild(meta);
      }
      if (Array.isArray(item.evidence)) {
        item.evidence.forEach((evidence) => {
          const nested = document.createElement("div");
          nested.className = "evidence-claim";
          const claim = document.createElement("p");
          claim.textContent = String(evidence.claim || "No claim text supplied");
          nested.appendChild(claim);
          const meta = document.createElement("small");
          meta.textContent = [
            evidence.evidenceType || "",
            evidence.sourceName || "",
            evidence.observedAt ? readableTime(Date.parse(evidence.observedAt)) : "",
            evidence.verification || ""
          ].filter(Boolean).join(" · ");
          nested.appendChild(meta);
          // Render the source URL as inert text, not as executable or trusted markup.
          if (evidence.sourceUrl) {
            const sourceText = document.createElement("small");
            sourceText.textContent = "Evidence URL: " + String(evidence.sourceUrl);
            nested.appendChild(sourceText);
          }
          row.appendChild(nested);
        });
      }
      container.appendChild(row);
    });
  }

  async function loadCompany() {
    const input = readSymbolForm("company");
    const status = byId("company-status");
    const container = byId("company-results");
    if (!input || !status || !container) return;
    status.classList.remove("is-warning");
    status.textContent = "Reading canonical identity and approved company evidence…";
    container.replaceChildren();
    try {
      const body = await getWorkspaceJson(symbolEndpoint("/workspace/company", input.symbol, input.exchange));
      if (body.truthState === "NOT_FOUND") {
        status.textContent = "No canonical company record found for " + input.symbol + ". The staged seed is not treated as a canonical stock.";
        clearAndMessage("company-results", "No canonical record is available. Resolve identity evidence and the import gate before this screen can display a company.");
        return;
      }
      if (body.truthState === "AMBIGUOUS") {
        status.textContent = "Exchange selection required.";
        renderAmbiguousIdentity("company-results", body, (exchange) => {
          byId("company-exchange").value = exchange;
          loadCompany();
        });
        return;
      }
      const company = body.company || {};
      status.textContent = "Canonical company record loaded. Facts and scores are displayed only when the relevant evidence/approval gate is met.";
      appendDataRow("company-results", String(company.name || input.symbol),
        String(company.exchange || "Exchange unknown") + ":" + String(company.symbol || input.symbol) + " · " + [company.sector, company.subSector].filter(Boolean).join(" › "),
        "Classification " + String(company.classificationStatus || "PENDING") + " · Registry updated " + readableTime(Date.parse(company.updatedAt || "")));
      const score = company.stockScore;
      appendDataRow("company-results", "Stock Score",
        score && Number.isFinite(score.value) ? String(score.value) + "/100 · Confidence " + score.confidence + "%" : "XX · No official score snapshot is configured",
        score ? String(score.formulaKey || "Approved formula") + " " + String(score.formulaVersion || "") + " · Calculated " + readableTime(Date.parse(score.calculatedAt || "")) : String(company.stockScoreTruthState || "NOT_CONFIGURED"));
      appendDataRow("company-results", "Verified Stock Groups",
        Array.isArray(company.verifiedStockGroups) && company.verifiedStockGroups.length
          ? company.verifiedStockGroups.map((group) => String(group.name)).join(", ")
          : "XX · No verified group memberships",
        "Memberships require verification evidence.");
      appendDataRow("company-results", "Verified Theme Path",
        Array.isArray(company.verifiedThemes) && company.verifiedThemes.length
          ? company.verifiedThemes.map((theme) => [theme.theme, theme.subTheme, theme.industry].filter(Boolean).join(" › ")).join(" | ")
          : "XX · No verified theme memberships",
        "Theme membership does not change Rotation or Stock Score mathematics.");
      if (company.shariahVerified === true) {
        const mark = document.createElement("span");
        mark.className = "verified-mark";
        mark.textContent = "✓ Verified Shariah";
        container.appendChild(mark);
      }
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Company record could not be loaded.";
      status.classList.add("is-warning");
      clearAndMessage("company-results", "Canonical company data remains unavailable; no values were inferred.");
    }
  }

  async function loadValueChain() {
    const input = readSymbolForm("value-chain");
    const status = byId("value-chain-status");
    const container = byId("value-chain-results");
    if (!input || !status || !container) return;
    status.classList.remove("is-warning");
    status.textContent = "Searching only explicitly verified company-specific value-chain evidence…";
    container.replaceChildren();
    try {
      const body = await getWorkspaceJson(symbolEndpoint("/workspace/value-chain", input.symbol, input.exchange));
      if (body.truthState === "NOT_FOUND") {
        status.textContent = "No canonical company record found for " + input.symbol + ".";
        clearAndMessage("value-chain-results", "No canonical company mapping exists for this symbol.");
        return;
      }
      if (body.truthState === "AMBIGUOUS") {
        status.textContent = "Exchange selection required.";
        renderAmbiguousIdentity("value-chain-results", body, (exchange) => {
          byId("value-chain-exchange").value = exchange;
          loadValueChain();
        });
        return;
      }
      if (!Array.isArray(body.items) || body.items.length === 0) {
        status.textContent = "Canonical company found; no VERIFIED value-chain evidence is available.";
        clearAndMessage("value-chain-results", "Supplier, customer, raw-material, capacity and end-use facts stay unavailable until attributable evidence is verified.");
        return;
      }
      status.textContent = "Verified value-chain evidence loaded for " + String(body.company && body.company.name || input.symbol) + ".";
      renderEvidenceItems("value-chain-results", body.items, "No verified evidence.", (item) => String(item.stageName || "Value-chain stage"));
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Value-chain evidence unavailable.";
      status.classList.add("is-warning");
      clearAndMessage("value-chain-results", "Unverified company relationships are not displayed.");
    }
  }

  async function loadFundamentals() {
    const input = readSymbolForm("fundamentals");
    const status = byId("fundamentals-status");
    const container = byId("fundamentals-results");
    if (!input || !status || !container) return;
    status.classList.remove("is-warning");
    status.textContent = "Searching verified fundamental evidence…";
    container.replaceChildren();
    try {
      const body = await getWorkspaceJson(symbolEndpoint("/workspace/fundamentals", input.symbol, input.exchange, 50));
      if (body.truthState === "NOT_FOUND") {
        status.textContent = "No canonical company record found for " + input.symbol + ".";
        clearAndMessage("fundamentals-results", "No fundamental values are inferred for an unresolved identity.");
        return;
      }
      if (body.truthState === "AMBIGUOUS") {
        status.textContent = "Exchange selection required.";
        renderAmbiguousIdentity("fundamentals-results", body, (exchange) => {
          byId("fundamentals-exchange").value = exchange;
          loadFundamentals();
        });
        return;
      }
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) {
        status.textContent = "No verified fundamental evidence found. This does not imply that the company has no fundamentals.";
        clearAndMessage("fundamentals-results", "Values remain XX until a verified fundamental data source is ingested.");
        return;
      }
      status.textContent = "Verified fundamental evidence only. Values are not converted into an unapproved score.";
      renderEvidenceItems("fundamentals-results", items, "No verified fundamental evidence.", (item) =>
        String(item.dataNature || "Fundamental") + " · " + String(item.value || "XX"));
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Fundamental evidence unavailable.";
      status.classList.add("is-warning");
      clearAndMessage("fundamentals-results", "No estimate or missing value has been substituted.");
    }
  }

  async function loadResearchEvidence() {
    const input = readSymbolForm("research");
    const status = byId("research-status");
    const container = byId("research-results");
    if (!input || !status || !container) return;
    status.classList.remove("is-warning");
    status.textContent = "Searching verified evidence with source and time provenance…";
    container.replaceChildren();
    try {
      const body = await getWorkspaceJson(symbolEndpoint("/workspace/research", input.symbol, input.exchange, 50));
      if (body.truthState === "NOT_FOUND") {
        status.textContent = "No canonical company record found for " + input.symbol + ".";
        clearAndMessage("research-results", "Evidence search needs a resolved canonical company identity.");
        return;
      }
      if (body.truthState === "AMBIGUOUS") {
        status.textContent = "Exchange selection required.";
        renderAmbiguousIdentity("research-results", body, (exchange) => {
          byId("research-exchange").value = exchange;
          loadResearchEvidence();
        });
        return;
      }
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) {
        status.textContent = "No verified research evidence found for this company.";
        clearAndMessage("research-results", "Proposed, conflicting or pending evidence is not promoted to verified truth.");
        return;
      }
      status.textContent = "Verified source events only; source time and knowledge time are displayed separately.";
      renderEvidenceItems("research-results", items, "No verified evidence.", (item) =>
        String(item.value || "XX") + " · " + String(item.dataNature || "Evidence"));
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Research evidence unavailable.";
      status.classList.add("is-warning");
      clearAndMessage("research-results", "Evidence is unavailable; no claim has been inferred.");
    }
  }

  function loadViewData(name) {
    if (name === "overview") {
      loadWorkspaceSummary();
      loadRotation();
    } else if (name === "rotation") {
      loadRotation();
    } else if (name === "stocks") {
      loadStocks();
    } else if (name === "themes") {
      loadThemes();
    } else if (name === "company") {
      loadCompany();
    } else if (name === "value-chain") {
      loadValueChain();
    } else if (name === "fundamentals") {
      loadFundamentals();
    } else if (name === "research") {
      loadResearchEvidence();
    }
  }

  function bindWorkspace() {
    const summaryRefresh = byId("workspace-summary-refresh");
    if (summaryRefresh) summaryRefresh.addEventListener("click", loadWorkspaceSummary);
    const stockForm = byId("stock-search-form");
    if (stockForm) stockForm.addEventListener("submit", (event) => {
      event.preventDefault();
      loadStocks();
    });
    const themeForm = byId("theme-search-form");
    if (themeForm) themeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      loadThemes();
    });
    const rotationRefresh = byId("rotation-refresh");
    if (rotationRefresh) rotationRefresh.addEventListener("click", loadRotation);
    const rotationHorizon = byId("rotation-horizon");
    if (rotationHorizon) rotationHorizon.addEventListener("change", loadRotation);
    const companyForm = byId("company-search-form");
    if (companyForm) companyForm.addEventListener("submit", (event) => { event.preventDefault(); loadCompany(); });
    const valueChainForm = byId("value-chain-search-form");
    if (valueChainForm) valueChainForm.addEventListener("submit", (event) => { event.preventDefault(); loadValueChain(); });
    const fundamentalsForm = byId("fundamentals-search-form");
    if (fundamentalsForm) fundamentalsForm.addEventListener("submit", (event) => { event.preventDefault(); loadFundamentals(); });
    const researchForm = byId("research-search-form");
    if (researchForm) researchForm.addEventListener("submit", (event) => { event.preventDefault(); loadResearchEvidence(); });
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
      company: "COMPANY DETAIL",
      themes: "THEME EXPLORER",
      "value-chain": "BUSINESS VALUE CHAIN",
      fundamentals: "FUNDAMENTALS",
      research: "RESEARCH & EVIDENCE",
      portfolio: "PORTFOLIO"
    };
    setText("current-section", labels[name] || "OVERVIEW");
    document.title = "MarketNiora — " + (labels[name] || "Market Intelligence");
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadViewData(name);
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
    const accepted = ["overview", "rotation", "stocks", "company", "themes", "value-chain", "fundamentals", "research", "portfolio"];
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
    bindWorkspace();
    loadProviderStatus();
    // Initial view intentionally has no synthetic sector leaders or prices.
    setQuoteUnavailable("", "NOT_CONFIGURED", "Search a stock only after an approved data source is connected.");
  });
})();