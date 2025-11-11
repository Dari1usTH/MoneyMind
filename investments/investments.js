const LS_KEY = "mm_investments";
const el = (sel) => document.querySelector(sel);

let investments = loadInvestments();
let chartState = { period: "all", points: [] };

const periodButtons = document.querySelectorAll(".period-switch button");
const monthFilter = el("#monthFilter");
const invRows = el("#invRows");
const emptyState = el("#emptyState");
const balanceValue = el("#balanceValue");
const pnlValue = el("#pnlValue");
const pnlBadge = el("#pnlBadge");
const investedYear = el("#investedYear");
const investedMonth = el("#investedMonth");
const growthEl = el("#growthPercent");
const searchBox = el("#searchBox");
const addModal = el("#addModal");
const addForm = el("#addForm");
const btnAdd = el("#btnAddInvestment");
const btnClose = el("#closeModal");
const btnMyInvestments = el("#btnMyInvestments");
const btnExport = el("#btnExport");
const importInput = el("#importInput");

init();

function init() {
  const now = new Date();
  monthFilter.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  wireEvents();
  renderAll();
}

function wireEvents() {
  periodButtons.forEach(b => b.addEventListener("click", () => {
    periodButtons.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    chartState.period = b.dataset.period;
    renderChart();
    renderStats();
  }));

  monthFilter.addEventListener("change", renderTable);
  searchBox.addEventListener("input", renderTable);

  btnAdd.addEventListener("click", () => addModal.showModal());
  btnClose.addEventListener("click", () => addModal.close());
  btnMyInvestments.addEventListener("click", () => {
    document.getElementById("myInvestments").scrollIntoView({ behavior: "smooth" });
  });

  addForm.addEventListener("submit", onAddSubmit);

  btnExport.addEventListener("click", onExport);
  importInput.addEventListener("change", onImport);
}

function renderAll() {
  ensureChartSeries();
  renderChart();
  renderStats();
  renderTable();
}

function renderStats() {
  const { ytd, mtd, balance } = computeTotals(investments);
  balanceValue.textContent = fmtMoney(balance);
  investedYear.textContent = fmtMoney(ytd);
  investedMonth.textContent = fmtMoney(mtd);

  const growth = computeGrowthPercent();
  const pnl = balance * (growth/100);
  pnlValue.textContent = `${pnl >= 0 ? "+" : "-"}${fmtMoney(Math.abs(pnl))}`;
  pnlValue.className = "value " + (pnl >= 0 ? "profit" : "loss");
  pnlBadge.textContent = `${growth >= 0 ? "Up" : "Down"} ${growth.toFixed(2)}%`;
  pnlBadge.className = "badge " + (growth >= 0 ? "success" : "danger");
  growthEl.textContent = `${growth.toFixed(2)}%`;
}

function renderTable() {
  const q = searchBox.value.trim().toLowerCase();
  const ym = monthFilter.value;

  const filtered = investments.filter(inv => {
    const matchesQuery =
      !q || inv.name.toLowerCase().includes(q) ||
      (inv.category || "").toLowerCase().includes(q) ||
      (inv.description || "").toLowerCase().includes(q);

    const matchesMonth = !ym || inv.dateISO.startsWith(ym);
    return matchesQuery && matchesMonth;
  });

  invRows.innerHTML = "";
  if (filtered.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  filtered
    .sort((a,b) => b.dateISO.localeCompare(a.dateISO))
    .forEach(addRow);
}

function addRow(inv) {
  const tr = document.createElement("tr");

  const link = inv.fileData
    ? `<a href="${inv.fileData}" download="${sanitize(inv.fileName)}">Download</a>`
    : `<span class="muted">—</span>`;

  tr.innerHTML = `
    <td>${fmtDate(inv.dateISO)}</td>
    <td>${esc(inv.name)}</td>
    <td><span class="badge">${esc(inv.category || "—")}</span></td>
    <td>${fmtMoney(inv.amount)}</td>
    <td>${link}</td>
    <td>${esc(inv.description || "")}</td>
    <td class="row-actions">
      <button data-id="${inv.id}" data-action="delete" title="Delete">🗑️</button>
    </td>
  `;

  tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
    if (confirm("Are you deleting this recording?")) {
      investments = investments.filter(x => x.id !== inv.id);
      saveInvestments(investments);
      renderAll();
    }
  });

  invRows.appendChild(tr);
}

async function onAddSubmit(e) {
  e.preventDefault();
  const fd = new FormData(addForm);

  const when = fd.get("date") ? new Date(fd.get("date")) : new Date();
  const file = fd.get("file");
  let fileData = "", fileName = "", fileType = "";

  if (file && file.size > 0) {
    const okTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!okTypes.includes(file.type)) {
      alert("Accepted only PDF, PNG or JPG.");
      return;
    }
    fileData = await fileToBase64(file);
    fileName = file.name;
    fileType = file.type;
  }

  const item = {
    id: crypto.randomUUID(),
    name: fd.get("name").toString().trim(),
    amount: Number(fd.get("amount")),
    category: fd.get("category").toString(),
    description: (fd.get("description") || "").toString().trim(),
    dateISO: toLocalISO(when).slice(0,16).replace("T"," "),
    fileData, fileName, fileType
  };
  
  investments.push(item);
  saveInvestments(investments);

  addForm.reset();
  addModal.close();
  renderAll();
}

function loadInvestments() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch { return []; }
}
function saveInvestments(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

function onExport() {
  const blob = new Blob([JSON.stringify(investments, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "moneymind-investments.json";
  a.click();
  URL.revokeObjectURL(url);
}
function onImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error();
      investments = data;
      saveInvestments(investments);
      renderAll();
      alert("Import successful!");
    } catch {
      alert("Invalid file.");
    }
  };
  reader.readAsText(file);
}

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("growthChart"));
const ctx = canvas.getContext("2d");

function ensureChartSeries() {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 10);
  const pts = [];
  let value = 100;

  for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate()+1)) {
    const r = (Math.random() - 0.48) * 0.6; 
    value *= 1 + r / 100;
    pts.push({ t: new Date(d), v: value });
  }
  chartState.points = pts;
}

function renderChart() {
  const { width } = canvas.getBoundingClientRect();
  canvas.width = width * devicePixelRatio;
  canvas.height = 220 * devicePixelRatio;

  const periodYears = chartState.period === "all" ? 10 : Number(chartState.period);
  const from = new Date(); from.setFullYear(from.getFullYear() - periodYears);

  const series = chartState.points.filter(p => p.t >= from);
  if (series.length < 2) return;

  const pad = 16 * devicePixelRatio;
  const W = canvas.width, H = canvas.height;
  const min = Math.min(...series.map(p => p.v));
  const max = Math.max(...series.map(p => p.v));
  const x = (i) => pad + i * (W - pad*2) / (series.length - 1);
  const y = (v) => H - pad - ( (v - min) / (max - min) ) * (H - pad*2);

  ctx.clearRect(0,0,W,H);

  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1 * devicePixelRatio;
  for (let i=0;i<6;i++){
    const yy = pad + i*(H-pad*2)/5;
    ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(W-pad, yy); ctx.strokeStyle = "#ffffff"; ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.beginPath();
  series.forEach((p,i) => i===0 ? ctx.moveTo(x(i), y(p.v)) : ctx.lineTo(x(i), y(p.v)));
  ctx.lineWidth = 2.5 * devicePixelRatio;
  ctx.strokeStyle = "#00ffc6";
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, pad, 0, H - pad);
  grad.addColorStop(0, "rgba(0,255,198,0.25)");
  grad.addColorStop(1, "rgba(0,255,198,0.00)");
  ctx.lineTo(W-pad, H-pad);
  ctx.lineTo(pad, H-pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

function computeGrowthPercent() {
  const years = chartState.period === "all" ? 10 : Number(chartState.period);
  const from = new Date(); from.setFullYear(from.getFullYear() - years);
  const s = chartState.points.filter(p => p.t >= from);
  if (s.length < 2) return 0;
  const first = s[0].v, last = s[s.length-1].v;
  return ((last - first) / first) * 100;
}

function computeTotals(list) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const y = `${now.getFullYear()}`;

  let balance = 0, mtd = 0, ytd = 0;
  list.forEach(inv => {
    balance += inv.amount;
    if (inv.dateISO.startsWith(ym)) mtd += inv.amount;
    if (inv.dateISO.startsWith(y)) ytd += inv.amount;
  });
  return { balance, mtd, ytd };
}

function fmtMoney(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
}
function fmtDate(iso) {
  const s = iso.replace(" ", "T");
  const d = new Date(s);
  return d.toLocaleString();
}
function toLocalISO(d) {
  const off = d.getTimezoneOffset();
  const ms = d.getTime() - off * 60000;
  return new Date(ms).toISOString().slice(0,19);
}
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function esc(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function sanitize(name){ return name.replace(/[^\w\-.]+/g,"_"); }

new ResizeObserver(() => renderChart()).observe(document.querySelector(".chart"));
