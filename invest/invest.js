const API_BASE = "http://localhost:3001";
const SELECTED_ACCOUNT_KEY = "mm_selected_account_id";

let currentUser = null;
let accounts = [];
let selectedAccount = null;

let currentInstrument = null;
let currentTimeframe = "1D";

let watchlist = [];
let positions = [];

let chartInstance = null;

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

  loadWatchlistFromStorage();
  loadPositionsFromStorage();

  initMarketTabs();
  initSearch();
  initOrderForm();
  initTimeframeButtons();

  renderMarkets();
  renderWatchlist();
  renderPositions();
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

function getPositionsStorageKey() {
  const uid = currentUser && currentUser.id ? currentUser.id : "guest";
  return "mm_positions_v1_" + uid;
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
    if (Array.isArray(parsed)) watchlist = parsed;
    else watchlist = [];
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

function loadPositionsFromStorage() {
  try {
    const key = getPositionsStorageKey();
    const raw = localStorage.getItem(key);
    if (!raw) {
      positions = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) positions = parsed;
    else positions = [];
  } catch (err) {
    console.error("loadPositionsFromStorage error:", err);
    positions = [];
  }
}

function savePositionsToStorage() {
  try {
    const key = getPositionsStorageKey();
    localStorage.setItem(key, JSON.stringify(positions));
  } catch (err) {
    console.error("savePositionsToStorage error:", err);
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
  searchInput.addEventListener("input", function () {
    renderMarkets();
    renderWatchlist();
  });
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

  const filtered = filterInstruments(INSTRUMENTS);

  filtered.forEach(function (inst) {
    const li = document.createElement("li");
    li.className = "instrument-item";
    li.setAttribute("data-symbol", inst.symbol);

    const isStarred = watchlist.indexOf(inst.symbol) !== -1;

    li.innerHTML =
      '<button class="star-btn ' +
      (isStarred ? "active" : "") +
      '" type="button" data-symbol="' +
      inst.symbol +
      '">' +
      (isStarred ? "★" : "☆") +
      '</button>' +
      '<div class="instrument-main">' +
      '<span class="instrument-symbol">' +
      inst.symbol +
      "</span>" +
      '<span class="instrument-name">' +
      inst.name +
      "</span>" +
      "</div>" +
      '<div class="instrument-right">' +
      '<div class="instrument-price">' +
      inst.last.toFixed(2) +
      " " +
      inst.currency +
      "</div>" +
      '<div class="instrument-change ' +
      (inst.change >= 0 ? "positive" : "negative") +
      '">' +
      (inst.change >= 0 ? "+" : "") +
      inst.change.toFixed(2) +
      "%</div>" +
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
      selectInstrument(inst.symbol);
    });

    const starBtn = li.querySelector(".star-btn");
    if (starBtn) {
      starBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleWatchlist(inst.symbol);
      });
    }

    listEl.appendChild(li);
  });
}

function renderWatchlist() {
  const listEl = document.getElementById("watchlistList");
  const countEl = document.getElementById("watchlistCount");
  if (!listEl) return;
  listEl.innerHTML = "";

  const base = INSTRUMENTS.filter(function (i) {
    return watchlist.indexOf(i.symbol) !== -1;
  });
  const filtered = filterInstruments(base);

  if (countEl) {
    countEl.textContent =
      base.length + " item" + (base.length === 1 ? "" : "s");
  }

  filtered.forEach(function (inst) {
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
      "</span>" +
      "</div>" +
      '<div class="instrument-right">' +
      '<div class="instrument-price">' +
      inst.last.toFixed(2) +
      " " +
      inst.currency +
      "</div>" +
      '<div class="instrument-change ' +
      (inst.change >= 0 ? "positive" : "negative") +
      '">' +
      (inst.change >= 0 ? "+" : "") +
      inst.change.toFixed(2) +
      "%</div>" +
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
      selectInstrument(inst.symbol);
    });

    const starBtn = li.querySelector(".star-btn");
    if (starBtn) {
      starBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleWatchlist(inst.symbol);
      });
    }

    listEl.appendChild(li);
  });
}

function toggleWatchlist(symbol) {
  const idx = watchlist.indexOf(symbol);
  if (idx === -1) {
    watchlist.push(symbol);
  } else {
    watchlist.splice(idx, 1);
  }
  saveWatchlistToStorage();
  renderMarkets();
  renderWatchlist();
}

function selectInstrument(symbol) {
  const inst = INSTRUMENTS.find(function (i) {
    return i.symbol === symbol;
  });
  if (!inst) return;

  currentInstrument = inst;

  const chartTitle = document.getElementById("chartTitle");
  const chartSubtitle = document.getElementById("chartSubtitle");
  const ticketSymbol = document.getElementById("ticketInstrumentSymbol");
  const ticketName = document.getElementById("ticketInstrumentName");
  const priceInput = document.getElementById("orderPrice");
  const placeBtn = document.getElementById("placeOrderBtn");

  if (chartTitle)
    chartTitle.textContent = inst.name + " (" + inst.symbol + ")";
  if (chartSubtitle)
    chartSubtitle.textContent =
      "Simulated chart · Last price: " +
      inst.last.toFixed(2) +
      " " +
      inst.currency;
  if (ticketSymbol) ticketSymbol.textContent = inst.symbol;
  if (ticketName) ticketName.textContent = inst.name;

  if (priceInput) {
    priceInput.value = inst.last.toFixed(2);
  }
  if (placeBtn) {
    placeBtn.disabled = false;
  }

  renderChart();
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

function renderChart() {
  const canvas = document.getElementById("priceChart");
  if (!canvas || !currentInstrument) return;

  const basePrice = currentInstrument.last;
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
        x: {
          display: false,
        },
        y: {
          ticks: {
            color: "#e6f7ff",
          },
        },
      },
    },
  });
}

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
      renderChart();
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

function placeOrder() {
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

  const side =
    sideInput && sideInput.value === "sell" ? "sell" : "buy";
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

  const position = {
    id: "pos_" + Date.now() + "_" + Math.random().toString(16).slice(2),
    accountId: selectedAccount.id,
    instrumentSymbol: currentInstrument.symbol,
    instrumentName: currentInstrument.name,
    side: side,
    quantity: qty,
    entryPrice: price,
    stopLoss: sl,
    takeProfit: tp,
    openedAt: new Date().toISOString(),
    status: "open",
  };

  positions.push(position);
  savePositionsToStorage();
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
}

function renderPositions() {
  const tbody = document.getElementById("openPositionsBody");
  const countEl = document.getElementById("openPositionsCount");
  if (!tbody) return;

  const openPositions = positions.filter(function (p) {
    const sameAccount =
      !selectedAccount || p.accountId === selectedAccount.id;
    return p.status === "open" && sameAccount;
  });

  if (countEl) countEl.textContent = String(openPositions.length);

  tbody.innerHTML = "";

  openPositions.forEach(function (pos) {
    const inst = INSTRUMENTS.find(function (i) {
      return i.symbol === pos.instrumentSymbol;
    });
    const lastPrice = inst ? inst.last : pos.entryPrice;
    const pnl =
      pos.side === "buy"
        ? (lastPrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - lastPrice) * pos.quantity;

    const tr = document.createElement("tr");

    tr.innerHTML =
      "<td>" +
      pos.instrumentSymbol +
      "</td>" +
      '<td class="' +
      (pos.side === "buy" ? "pl-buy" : "pl-sell") +
      '">' +
      pos.side.toUpperCase() +
      "</td>" +
      "<td>" +
      pos.quantity +
      "</td>" +
      "<td>" +
      pos.entryPrice.toFixed(2) +
      "</td>" +
      "<td>" +
      lastPrice.toFixed(2) +
      "</td>" +
      '<td class="' +
      (pnl >= 0 ? "pl-positive" : "pl-negative") +
      '">' +
      (pnl >= 0 ? "+" : "") +
      pnl.toFixed(2) +
      "</td>" +
      "<td>" +
      new Date(pos.openedAt).toLocaleTimeString() +
      "</td>" +
      '<td><button class="link-btn" data-id="' +
      pos.id +
      '">Close</button></td>';

    const closeBtn = tr.querySelector(".link-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closePosition(pos.id);
      });
    }

    tbody.appendChild(tr);
  });
}

function closePosition(id) {
  const idx = positions.findIndex(function (p) {
    return p.id === id;
  });
  if (idx === -1) return;

  positions[idx].status = "closed";
  positions[idx].closedAt = new Date().toISOString();
  savePositionsToStorage();
  renderPositions();
}
