const API_BASE = "http://localhost:3001";
const SELECTED_ACCOUNT_KEY = "mm_selected_account_id";

let currentUser = null;
let accounts = [];
let selectedAccount = null;

let searchResults = [];
let pendingWatchlistInstrument = null;

let currentInstrument = null;
let currentTimeframe = "1D";

let watchlist = [];

let chartInstance = null;
let chartRefreshTimer = null;

const INSTRUMENTS = [
  {
    symbol: "BTCUSD",
    name: "Bitcoin",
    type: "crypto",
    currency: "USD",
    last: 83734,
    change: -3.2,
  },
  {
    symbol: "ETHUSD",
    name: "Ethereum",
    type: "crypto",
    currency: "USD",
    last: 2741,
    change: -3.1,
  },
  {
    symbol: "SOLUSD",
    name: "Solana",
    type: "crypto",
    currency: "USD",
    last: 126.9,
    change: -4.8,
  },
  {
    symbol: "XAUUSD",
    name: "Gold",
    type: "forex",
    currency: "USD",
    last: 4065,
    change: 0.5,
  },
  {
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    type: "forex",
    currency: "USD",
    last: 1.1,
    change: -0.1,
  },
  {
    symbol: "GBPUSD",
    name: "British Pound / US Dollar",
    type: "forex",
    currency: "USD",
    last: 1.3,
    change: 0.2,
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    type: "stocks",
    currency: "USD",
    last: 185.3,
    change: 0.8,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    type: "stocks",
    currency: "USD",
    last: 220.7,
    change: -1.4,
  },
  {
    symbol: "SPX500",
    name: "S&P 500 Index CFD",
    type: "stocks",
    currency: "USD",
    last: 6578,
    change: 0.4,
  },
];

document.addEventListener("DOMContentLoaded", function () {
  initInvestPage().catch(function (err) {
    console.error("Init error:", err);
  });
});

async function initInvestPage() {
  const logoutBtn = document.getElementById("logoutBtn");
  const goProfileBtn = document.getElementById("goProfileBtn");

  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  if (goProfileBtn) {
    goProfileBtn.addEventListener("click", function () {
      window.location.href = "../profile/profile.html";
    });
  }

  await loadMe();
  await loadAccounts();

  await loadWatchlistFromServer();
  await loadWatchlistFromServer();
  await loadPositionsFromServer();


  initMarketTabs();
  initSearch();
  initOrderForm();
  initTimeframeButtons();
  initWatchlistPanel();

  renderMarkets();
  renderWatchlist();
  renderPositions();

  autoSelectInitialInstrument();
}

async function loadMe() {
  try {
    const res = await fetch(API_BASE + "/api/me", {
      credentials: "include",
    });

    if (res.status === 401) {
      window.location.href = "../login/login.html";
      return;
    }

    const data = await res.json();
    if (!data.success) {
      console.warn("Could not load /api/me:", data);
      return;
    }

    currentUser = data.user;
  } catch (err) {
    console.error("loadMe error:", err);
  }
}

async function loadPositionsFromServer() {
  if (!selectedAccount) {
    positions = [];
    renderPositions();
    return;
  }

  try {
    const res = await fetch(
      API_BASE + "/api/orders?accountId=" + encodeURIComponent(selectedAccount.id),
      { credentials: "include" }
    );

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const data = await res.json();
    if (!data.success || !Array.isArray(data.orders)) {
      throw new Error("Invalid orders payload");
    }

    positions = data.orders.map(function (row) {
      return {
        id: row.id,
        accountId: row.account_id,
        instrumentSymbol: row.symbol,
        instrumentName: row.name,
        side: row.side,
        quantity: Number(row.quantity),
        entryPrice: Number(row.entry_price),
        stopLoss: row.stop_loss != null ? Number(row.stop_loss) : null,
        takeProfit: row.take_profit != null ? Number(row.take_profit) : null,
        openedAt: row.opened_at,
        status: row.status,
        apiSymbol: row.api_symbol,
        closePrice: row.close_price != null ? Number(row.close_price) : null,
        profitLoss: row.profit_loss != null ? Number(row.profit_loss) : null,
      };
    });

    renderPositions();
  } catch (err) {
    console.error("loadPositionsFromServer error:", err);
    positions = [];
    renderPositions();
  }
}

async function loadAccounts() {
  try {
    const res = await fetch(API_BASE + "/api/accounts", {
      credentials: "include",
    });
    const data = await res.json();
    if (!data.success) {
      console.error("Could not load accounts:", data);
      return;
    }

    accounts = data.accounts || [];

    const storedIdRaw = localStorage.getItem(SELECTED_ACCOUNT_KEY);
    const storedId = storedIdRaw ? Number(storedIdRaw) : null;

    selectedAccount =
      accounts.find(function (a) {
        return a.id === storedId;
      }) ||
      accounts.find(function (a) {
        return a.is_default;
      }) ||
      accounts[0] ||
      null;

    if (selectedAccount) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, String(selectedAccount.id));
      renderSelectedAccountChip();
    }
  } catch (err) {
    console.error("loadAccounts error:", err);
  }
}

async function loadWatchlistFromServer() {
  if (!currentUser) {
    watchlist = [];
    return;
  }
  try {
    const res = await fetch(API_BASE + "/api/watchlist", {
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const data = await res.json();
    if (!data.success || !Array.isArray(data.items)) {
      throw new Error("Invalid watchlist payload");
    }

    watchlist = data.items.map(function (row) {
      return {
        symbol: row.symbol,
        apiSymbol: row.api_symbol || row.symbol,
        name: row.name,
        type: row.instrument_type || "stocks",
        currency: row.currency || "USD",
        exchange: row.exchange || null,
      };
    });

    saveWatchlistToStorage();
  } catch (err) {
    console.error("loadWatchlistFromServer error:", err);
    loadWatchlistFromStorage();
  }
}

async function addInstrumentToWatchlistOnServer(inst) {
  if (!currentUser) return;

  try {
    const res = await fetch(API_BASE + "/api/watchlist", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        symbol: inst.symbol,
        apiSymbol: inst.apiSymbol || inst.symbol,
        name: inst.name || inst.symbol,
        type: inst.type || "stocks",
        currency: inst.currency || null,
        exchange: inst.exchange || null,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error("addInstrumentToWatchlistOnServer failed:", data);
    }

    return data.item || null;
  } catch (err) {
    console.error("addInstrumentToWatchlistOnServer error:", err);
    return null;
  }
}

async function removeInstrumentFromWatchlistOnServer(symbol) {
  if (!currentUser) return;

  try {
    const res = await fetch(
      API_BASE + "/api/watchlist/" + encodeURIComponent(symbol),
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error("removeInstrumentFromWatchlistOnServer failed:", data);
    }
  } catch (err) {
    console.error("removeInstrumentFromWatchlistOnServer error:", err);
  }
}

function renderSelectedAccountChip() {
  if (!selectedAccount) return;

  const nameEl = document.getElementById("currentAccountName");
  const typeEl = document.getElementById("currentAccountType");
  const balEl = document.getElementById("currentAccountBalance");

  const balance = Number(selectedAccount.balance || 0);

  if (nameEl) nameEl.textContent = selectedAccount.account_name;
  if (typeEl)
    typeEl.textContent = (selectedAccount.account_type || "").toUpperCase();
  if (balEl)
    balEl.textContent =
      balance.toFixed(2) + " " + (selectedAccount.currency || "");
}

async function handleLogout() {
  try {
    await fetch(API_BASE + "/api/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("logout error:", err);
  } finally {
    window.location.href = "../login/login.html";
  }
}

function getWatchlistStorageKey() {
  const uid = currentUser && currentUser.id ? currentUser.id : "guest";
  return "mm_watchlist_v1_" + uid;
}

function loadWatchlistFromStorage() {
  try {
    const key = getWatchlistStorageKey();
    const raw = localStorage.getItem(key);
    if (!raw) {
      watchlist = [];
      return;
    }
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      if (parsed.length && typeof parsed[0] === "string") {
        watchlist = parsed.map(function (symbol) {
          return {
            symbol: symbol,
            apiSymbol: symbol,
            name: symbol,
            type: "stocks",
            currency: "USD",
          };
        });
      } else {
        watchlist = parsed;
      }
    } else {
      watchlist = [];
    }
  } catch (err) {
    console.error("loadWatchlistFromStorage error:", err);
    watchlist = [];
  }
}

function saveWatchlistToStorage() {
  try {
    const key = getWatchlistStorageKey();
    localStorage.setItem(key, JSON.stringify(watchlist));
  } catch (err) {
    console.error("saveWatchlistToStorage error:", err);
  }
}

function initMarketTabs() {
  const tabs = document.querySelectorAll(".market-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");
      renderMarkets();
      renderWatchlist();
    });
  });
}

function initSearch() {
  const searchInput = document.getElementById("instrumentSearch");
  if (!searchInput) return;

  let searchTimeout = null;

  searchInput.addEventListener("input", function () {
    const term = searchInput.value.trim();

    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
      performInstrumentSearch(term);
    }, 300);
  });
}

async function performInstrumentSearch(term) {
  const listEl = document.getElementById("instrumentList");

  if (!term || term.length < 2) {
    searchResults = [];
    if (listEl) {
      listEl.innerHTML =
        '<li class="instrument-empty">Type at least 2 characters (e.g. <b>BTCUSD</b>, <b>AAPL</b>, <b>EURUSD</b>).</li>';
    }
    return;
  }

  if (listEl) {
    listEl.innerHTML = '<li class="instrument-empty">Searching...</li>';
  }

  const market = getActiveMarketFilter();

  try {
    const res = await fetch(
      API_BASE +
        "/api/markets/search?q=" +
        encodeURIComponent(term) +
        "&type=" +
        encodeURIComponent(market),
      { credentials: "include" }
    );

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const payload = await res.json();
    if (!payload.success) {
      throw new Error(payload.message || "Search failed");
    }

    searchResults = Array.isArray(payload.results) ? payload.results : [];
  } catch (err) {
    console.error("performInstrumentSearch error:", err);
    searchResults = [];
  }

  renderMarkets();
}

function getActiveMarketFilter() {
  const active = document.querySelector(".market-tab.active");
  return active ? active.getAttribute("data-market") || "all" : "all";
}

function getSearchTerm() {
  const input = document.getElementById("instrumentSearch");
  return input ? input.value.trim().toLowerCase() : "";
}

function filterInstruments(baseList) {
  const market = getActiveMarketFilter();
  const term = getSearchTerm();

  return baseList.filter(function (inst) {
    if (market !== "all" && inst.type !== market) return false;

    if (term) {
      const haystack = (inst.symbol + " " + inst.name).toLowerCase();
      if (haystack.indexOf(term) === -1) return false;
    }

    return true;
  });
}

function renderMarkets() {
  const listEl = document.getElementById("instrumentList");
  if (!listEl) return;
  listEl.innerHTML = "";

  let base = searchResults.slice();

  if (!base.length) {
    listEl.innerHTML =
      '<li class="instrument-empty">No results yet. Search above for a symbol or name.</li>';
    return;
  }

  const filtered = filterInstruments(base);

  if (!filtered.length) {
    listEl.innerHTML =
      '<li class="instrument-empty">Nothing matches the selected filters.</li>';
    return;
  }

  filtered.forEach(function (inst) {
    const li = document.createElement("li");
    li.className = "instrument-item";
    li.setAttribute("data-symbol", inst.symbol);

    const isStarred =
      watchlist.findIndex(function (w) {
        return w.symbol === inst.symbol;
      }) !== -1;

    li.innerHTML =
      '<button class="star-btn ' +
      (isStarred ? "active" : "") +
      '" type="button" data-symbol="' +
      inst.symbol +
      '">' +
      (isStarred ? "★" : "☆") +
      "</button>" +
      '<div class="instrument-main">' +
      '<span class="instrument-symbol">' +
      inst.symbol +
      "</span>" +
      '<span class="instrument-name">' +
      inst.name +
      (inst.exchange ? " · " + inst.exchange : "") +
      "</span>" +
      "</div>" +
      '<div class="instrument-right">' +
      '<div class="instrument-price">' +
      (typeof inst.last === "number" ? inst.last.toFixed(2) : "-") +
      " " +
      (inst.currency || "") +
      "</div>" +
      "</div>";

    li.addEventListener("click", function (e) {
      const target = e.target;
      if (
        target &&
        target.classList &&
        target.classList.contains("star-btn")
      ) {
        return;
      }
      selectInstrument(inst);
    });

    const starBtn = li.querySelector(".star-btn");
    if (starBtn) {
      starBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleWatchlist(inst);
      });
    }

    listEl.appendChild(li);
  });
}

function renderWatchlist() {
  const cryptoEl = document.getElementById("watchlistCrypto");
  const forexEl = document.getElementById("watchlistForex");
  const stocksEl = document.getElementById("watchlistStocks");
  const countEl = document.getElementById("watchlistCount");

  const groupCrypto = document.getElementById("watchlistGroupCrypto");
  const groupForex = document.getElementById("watchlistGroupForex");
  const groupStocks = document.getElementById("watchlistGroupStocks");

  if (!cryptoEl || !forexEl || !stocksEl) return;

  cryptoEl.innerHTML = "";
  forexEl.innerHTML = "";
  stocksEl.innerHTML = "";

  const total = watchlist.length;
  if (countEl) {
    countEl.textContent = total + " item" + (total === 1 ? "" : "s");
  }

  const groups = { crypto: [], forex: [], stocks: [] };

  watchlist.forEach(function (inst) {
    const t = (inst.type || "stocks").toLowerCase();
    if (!groups[t]) {
      groups[t] = [];
    }
    groups[t].push(inst);
  });

  function renderGroup(listEl, items, emptyText) {
    if (!items.length) {
      listEl.innerHTML =
        '<li class="instrument-empty">' + emptyText + "</li>";
      return;
    }

    items.forEach(function (inst) {
      const li = document.createElement("li");
      li.className = "instrument-item";
      li.setAttribute("data-symbol", inst.symbol);

      li.innerHTML =
        '<button class="star-btn active" type="button" data-symbol="' +
        inst.symbol +
        '">★</button>' +
        '<div class="instrument-main">' +
        '<span class="instrument-symbol">' +
        inst.symbol +
        "</span>" +
        '<span class="instrument-name">' +
        inst.name +
        (inst.exchange ? " · " + inst.exchange : "") +
        "</span>" +
        "</div>";

      li.addEventListener("click", function (e) {
        const target = e.target;
        if (
          target &&
          target.classList &&
          target.classList.contains("star-btn")
        ) {
          return;
        }
        selectInstrument(inst);
      });

      const starBtn = li.querySelector(".star-btn");
      if (starBtn) {
        starBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          toggleWatchlist(inst);
        });
      }

      listEl.appendChild(li);
    });
  }

  const market = getActiveMarketFilter(); 

  if (groupCrypto && groupForex && groupStocks) {
    if (market === "all") {
      groupCrypto.style.display = "";
      groupForex.style.display = "";
      groupStocks.style.display = "";
    } else {
      groupCrypto.style.display = market === "crypto" ? "" : "none";
      groupForex.style.display = market === "forex" ? "" : "none";
      groupStocks.style.display = market === "stocks" ? "" : "none";
    }
  }

  renderGroup(cryptoEl, groups.crypto, "No favorite crypto.");
  renderGroup(forexEl, groups.forex, "No favorite forex.");
  renderGroup(stocksEl, groups.stocks, "No favorite stock.");
}

function openWatchlistCategoryPanel(inst) {
  const overlay = document.getElementById("watchlistOverlay");
  const panel = document.getElementById("watchlistCategoryPanel");
  const label = document.getElementById("wishlistPanelInstrumentLabel");

  pendingWatchlistInstrument = inst;

  if (label) {
    label.textContent =
      inst.symbol + " · " + (inst.name || inst.exchange || "");
  }

  if (overlay) overlay.classList.add("visible");
  if (panel) panel.classList.add("visible");
}

function closeWatchlistCategoryPanel() {
  const overlay = document.getElementById("watchlistOverlay");
  const panel = document.getElementById("watchlistCategoryPanel");

  pendingWatchlistInstrument = null;

  if (overlay) overlay.classList.remove("visible");
  if (panel) panel.classList.remove("visible");
}

function initWatchlistPanel() {
  const overlay = document.getElementById("watchlistOverlay");
  const cancelBtn = document.getElementById("wishlistCancelBtn");
  const catBtns = document.querySelectorAll(".wishlist-cat-btn");

  if (overlay) {
    overlay.addEventListener("click", function () {
      closeWatchlistCategoryPanel();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      closeWatchlistCategoryPanel();
    });
  }

  catBtns.forEach(function (btn) {
    btn.addEventListener("click", async function () {
      if (!pendingWatchlistInstrument) return;

      const chosenType = btn.getAttribute("data-type") || "stocks";

      const inst = Object.assign({}, pendingWatchlistInstrument, {
        type: chosenType,
      });

      const idx = watchlist.findIndex(function (w) {
        return w.symbol === inst.symbol;
      });
      if (idx === -1) {
        watchlist.push(inst);
      } else {
        watchlist[idx] = inst;
      }

      saveWatchlistToStorage();
      renderWatchlist();
      renderMarkets();

      await addInstrumentToWatchlistOnServer(inst);

      closeWatchlistCategoryPanel();
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeWatchlistCategoryPanel();
    }
  });
}

function toggleWatchlist(inst) {
  if (!inst || !inst.symbol) return;

  const idx = watchlist.findIndex(function (w) {
    return w.symbol === inst.symbol;
  });

  if (idx !== -1) {
    const symbol = inst.symbol;
    watchlist.splice(idx, 1);
    saveWatchlistToStorage();
    renderMarkets();
    renderWatchlist();
    removeInstrumentFromWatchlistOnServer(symbol);
    return;
  }

  openWatchlistCategoryPanel(inst);
}

function selectInstrument(symbolOrInstrument) {
  if (!symbolOrInstrument) return;

  let inst = null;

  if (typeof symbolOrInstrument === "string") {
    const symbol = symbolOrInstrument;
    inst =
      watchlist.find(function (w) {
        return w.symbol === symbol;
      }) ||
      searchResults.find(function (r) {
        return r.symbol === symbol;
      }) ||
      INSTRUMENTS.find(function (i) {
        return i.symbol === symbol;
      });
  } else {
    inst = symbolOrInstrument;
  }

  if (!inst || !inst.symbol) return;

  currentInstrument = inst;

  const chartTitle = document.getElementById("chartTitle");
  const chartSubtitle = document.getElementById("chartSubtitle");
  const ticketSymbol = document.getElementById("ticketInstrumentSymbol");
  const ticketName = document.getElementById("ticketInstrumentName");
  const priceInput = document.getElementById("orderPrice");
  const placeBtn = document.getElementById("placeOrderBtn");

  if (chartTitle) {
    chartTitle.textContent =
      (inst.name || inst.symbol) + " (" + inst.symbol + ")";
  }

  if (chartSubtitle) {
    chartSubtitle.textContent = "Loading real market data.";
  }

  if (ticketSymbol) ticketSymbol.textContent = inst.symbol;
  if (ticketName) ticketName.textContent = inst.name || inst.symbol;

  if (priceInput) {
    if (typeof inst.last === "number" && Number.isFinite(inst.last)) {
      priceInput.value = inst.last.toFixed(2);
    } else {
      priceInput.value = "";
    }
  }
  if (placeBtn) {
    placeBtn.disabled = false;
  }

  renderChartFromApi();   
  startChartAutoRefresh();   
}

function generateChartData(basePrice, points) {
  const labels = [];
  const data = [];
  let price = basePrice;

  for (let i = points - 1; i >= 0; i--) {
    price += (Math.random() - 0.5) * basePrice * 0.015;
    if (price < basePrice * 0.2) price = basePrice * 0.2;

    labels.unshift(String(i));
    data.unshift(Number(price.toFixed(2)));
  }

  return { labels: labels, data: data };
}

function renderSimulatedChart() {
  const canvas = document.getElementById("priceChart");
  if (!canvas || !currentInstrument) return;

  const basePrice =
    typeof currentInstrument.last === "number"
      ? currentInstrument.last
      : 100;
  let points = 60;

  if (currentTimeframe === "1W") points = 80;
  else if (currentTimeframe === "1M") points = 100;
  else if (currentTimeframe === "1Y") points = 120;

  const generated = generateChartData(basePrice, points);
  const labels = generated.labels;
  const data = generated.data;

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: currentInstrument.symbol + " price",
          data: data,
          fill: false,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { display: false },
        y: {
          ticks: {
            color: "#e6f7ff",
          },
        },
      },
    },
  });
}

function renderChartFromApi(fromInterval) {
  const canvas = document.getElementById("priceChart");
  const chartSubtitle = document.getElementById("chartSubtitle");
  if (!canvas || !currentInstrument) return;

  const apiSymbol =
    currentInstrument.apiSymbol || currentInstrument.symbol;

  if (chartSubtitle && !fromInterval) {
    chartSubtitle.textContent = "Loading real market data.";
  }

  const url =
    API_BASE +
    "/api/markets/ohlc?symbol=" +
    encodeURIComponent(apiSymbol) +
    "&timeframe=" +
    encodeURIComponent(currentTimeframe);

  fetch(url, { credentials: "include" })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      return res.json();
    })
    .then(function (payload) {
      if (!payload.success || !payload.candles || !payload.candles.length) {
        throw new Error("Invalid market data payload");
      }

      const labels = payload.candles.map(function (c) {
        return c.time;
      });
      const data = payload.candles.map(function (c) {
        return c.close;
      });

      if (chartInstance) {
        chartInstance.destroy();
      }

      chartInstance = new Chart(canvas, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: currentInstrument.symbol + " price",
              data: data,
              fill: false,
              tension: 0.25,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: { display: false },
            y: {
              ticks: {
                color: "#e6f7ff",
              },
            },
          },
        },
      });

      if (typeof payload.lastPrice === "number") {
        currentInstrument.last = payload.lastPrice;
      }

      if (chartSubtitle && !fromInterval) {
        const lastPrice =
          typeof currentInstrument.last === "number"
            ? currentInstrument.last.toFixed(2)
            : "-";
        chartSubtitle.textContent =
          "Real chart · Last price: " +
          lastPrice +
          " " +
          (currentInstrument.currency || "");
      }
    })
    .catch(function (err) {
      console.error("Market data error:", err);
      if (chartSubtitle && !fromInterval) {
        chartSubtitle.textContent =
          "Could not load real data. Showing a simulated chart.";
      }
      renderSimulatedChart();
    });
}

function startChartAutoRefresh() {
  if (chartRefreshTimer) {
    clearInterval(chartRefreshTimer);
    chartRefreshTimer = null;
  }

  chartRefreshTimer = setInterval(function () {
    if (currentInstrument) {
      renderChartFromApi(true);
    }
  }, 60000); 
}

function stopChartAutoRefresh() {
  if (chartRefreshTimer) {
    clearInterval(chartRefreshTimer);
    chartRefreshTimer = null;
  }
}

window.addEventListener("beforeunload", stopChartAutoRefresh);

function initTimeframeButtons() {
  const container = document;
  container.addEventListener("click", function (e) {
    const target = e.target;
    if (!target || !target.classList) return;
    if (!target.classList.contains("tf-btn")) return;

    const tf = target.getAttribute("data-tf");
    if (!tf) return;

    currentTimeframe = tf;

    const all = document.querySelectorAll(".tf-btn");
    all.forEach(function (btn) {
      btn.classList.remove("active");
    });
    target.classList.add("active");

    if (currentInstrument) {
      renderChartFromApi();
    }
  });
}

function initOrderForm() {
  const sideButtons = document.querySelectorAll(".side-btn");
  const sideInput = document.getElementById("orderSide");
  sideButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      sideButtons.forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      if (sideInput) {
        sideInput.value = btn.getAttribute("data-side") || "buy";
      }
    });
  });

  const form = document.getElementById("orderForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    placeOrder();
  });
}

async function placeOrder() {
  if (!currentInstrument || !selectedAccount) {
    alert("Select an instrument and make sure you have an account.");
    return;
  }

  const sideInput = document.getElementById("orderSide");
  const qtyInput = document.getElementById("orderQty");
  const priceInput = document.getElementById("orderPrice");
  const slInput = document.getElementById("orderSl");
  const tpInput = document.getElementById("orderTp");
  const infoEl = document.getElementById("orderInfo");

  const side = sideInput && sideInput.value === "sell" ? "sell" : "buy";
  const qty = qtyInput ? Number(qtyInput.value) : 0;
  const price =
    priceInput && priceInput.value
      ? Number(priceInput.value)
      : currentInstrument.last;
  const sl = slInput && slInput.value ? Number(slInput.value) : null;
  const tp = tpInput && tpInput.value ? Number(tpInput.value) : null;

  if (!qty || qty <= 0 || !price || price <= 0) {
    alert("Please enter a valid quantity and price.");
    return;
  }

  const payload = {
    accountId: selectedAccount.id,
    symbol: currentInstrument.symbol,
    apiSymbol: currentInstrument.apiSymbol || currentInstrument.symbol,
    name: currentInstrument.name || currentInstrument.symbol,
    type: currentInstrument.type || "stocks",
    currency: currentInstrument.currency || null,
    side: side,
    quantity: qty,
    entryPrice: price,
    stopLoss: sl,
    takeProfit: tp,
  };

  try {
    const res = await fetch(API_BASE + "/api/orders", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error("placeOrder API error:", data);
      alert(data.message || "Could not place order.");
      return;
    }

    const row = data.order;
    const position = {
      id: row.id,
      accountId: row.account_id,
      instrumentSymbol: row.symbol,
      instrumentName: row.name,
      side: row.side,
      quantity: Number(row.quantity),
      entryPrice: Number(row.entry_price),
      stopLoss: row.stop_loss != null ? Number(row.stop_loss) : null,
      takeProfit: row.take_profit != null ? Number(row.take_profit) : null,
      openedAt: row.opened_at,
      status: row.status,
      apiSymbol: row.api_symbol,
    };

    positions.unshift(position);
    renderPositions();

    if (qtyInput) qtyInput.value = "";
    if (slInput) slInput.value = "";
    if (tpInput) tpInput.value = "";

    if (infoEl) {
      infoEl.textContent =
        "Opened " +
        side.toUpperCase() +
        " " +
        qty +
        " " +
        currentInstrument.symbol +
        " @ " +
        price.toFixed(2) +
        ".";
    }
  } catch (err) {
    console.error("placeOrder error:", err);
    alert("Server error while placing order.");
  }
}

function renderPositions() {
  const listEl = document.getElementById("openPositionsList");
  const countEl = document.getElementById("openPositionsCount");
  if (!listEl) return;

  const openPositions = positions.filter(function (p) {
    const sameAccount =
      !selectedAccount || p.accountId === selectedAccount.id;
    return p.status === "open" && sameAccount;
  });

  if (countEl) countEl.textContent = String(openPositions.length);

  listEl.innerHTML = "";

  if (!openPositions.length) {
    const empty = document.createElement("div");
    empty.className = "instrument-empty";
    empty.textContent = "No open positions on this account yet.";
    listEl.appendChild(empty);
    return;
  }

  openPositions.forEach(function (pos) {
    let lastPrice = pos.entryPrice;

    const instLocal =
      INSTRUMENTS.find(function (i) {
        return i.symbol === pos.instrumentSymbol;
      }) ||
      watchlist.find(function (w) {
        return w.symbol === pos.instrumentSymbol;
      }) ||
      searchResults.find(function (r) {
        return r.symbol === pos.instrumentSymbol;
      });

    if (instLocal && typeof instLocal.last === "number") {
      lastPrice = instLocal.last;
    }

    const pnl =
      pos.side === "buy"
        ? (lastPrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - lastPrice) * pos.quantity;

    const openedAtStr = new Date(pos.openedAt).toLocaleString();

    const row = document.createElement("div");
    row.className = "position-row";

    row.innerHTML =
      '<div class="position-main">' +
      '  <div class="position-topline">' +
      '    <span class="position-symbol">' +
      pos.instrumentSymbol +
      "</span>" +
      '    <span class="position-side ' +
      (pos.side === "buy" ? "pl-buy" : "pl-sell") +
      '">' +
      pos.side.toUpperCase() +
      "</span>" +
      "  </div>" +
      '  <div class="position-subline">' +
      '    <span>Qty ' +
      pos.quantity +
      "</span>" +
      '    <span>• Entry ' +
      pos.entryPrice.toFixed(2) +
      "</span>" +
      '    <span>• Last ' +
      lastPrice.toFixed(2) +
      "</span>" +
      '    <span class="' +
      (pnl >= 0 ? "pl-positive" : "pl-negative") +
      '">• ' +
      (pnl >= 0 ? "+" : "") +
      pnl.toFixed(2) +
      "</span>" +
      "  </div>" +
      "</div>" +
      '<div class="position-meta">' +
      '  <span class="position-opened">' +
      openedAtStr +
      "</span>" +
      '  <button class="link-btn position-close-btn" data-id="' +
      pos.id +
      '">Close</button>' +
      "</div>";

    const closeBtn = row.querySelector(".position-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closePosition(pos.id);
      });
    }

    listEl.appendChild(row);
  });
}

async function closePosition(id) {
  const idx = positions.findIndex(function (p) {
    return p.id === id;
  });
  if (idx === -1) return;

  try {
    const res = await fetch(API_BASE + "/api/orders/" + encodeURIComponent(id) + "/close", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error("closePosition API error:", data);
      alert(data.message || "Could not close order.");
      return;
    }
    positions.splice(idx, 1);
    renderPositions();

    if (data.account) {
      const updatedAcc = data.account;
      const accIdx = accounts.findIndex(function (a) {
        return a.id === updatedAcc.id;
      });
      if (accIdx !== -1) {
        accounts[accIdx] = updatedAcc;
      }
      if (selectedAccount && selectedAccount.id === updatedAcc.id) {
        selectedAccount = updatedAcc;
        renderSelectedAccountChip();
      }
    }
  } catch (err) {
    console.error("closePosition error:", err);
    alert("Server error while closing order.");
  }
}

function autoSelectInitialInstrument() {
  if (currentInstrument) return;

  let inst = null;

  if (watchlist && watchlist.length > 0) {
    inst = watchlist[0]; 
  } else if (INSTRUMENTS && INSTRUMENTS.length > 0) {
    inst = INSTRUMENTS[0];
  }

  if (inst) {
    selectInstrument(inst);
  }
}