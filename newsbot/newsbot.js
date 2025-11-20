const API_BASE = "http://localhost:3001";

let topicSelect;
let refreshBtn;
let newsListEl;
let newsStatusEl;
let topicLabelSpan;

const TOPIC_LABELS = {
  forex: "forex, markets & geopolitics",
  stocks: "US stocks & indices",
  crypto: "crypto & blockchain",
};

function timeAgo(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d)) return "";

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;

  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function renderNews(articles) {
  newsListEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  articles.forEach((article) => {
    const item = document.createElement("div");
    item.className = "news-item";

    const title = document.createElement("a");
    title.href = article.url || "#";
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = article.title || "Untitled article";
    item.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "news-meta";

    const srcSpan = document.createElement("span");
    if (article.source) srcSpan.textContent = article.source;

    const timeSpan = document.createElement("span");
    if (article.publishedAt) timeSpan.textContent = timeAgo(article.publishedAt);

    meta.appendChild(srcSpan);
    meta.appendChild(timeSpan);
    item.appendChild(meta);

    if (article.summary) {
      const p = document.createElement("p");
      p.className = "news-desc";
      p.textContent = article.summary;
      item.appendChild(p);
    }

    frag.appendChild(item);
  });

  newsListEl.appendChild(frag);
}

function updateTopicLabel(category) {
  if (!topicLabelSpan) return;
  const label = TOPIC_LABELS[category] || "markets & geopolitics";
  topicLabelSpan.textContent = label;
}

async function loadNews() {
  if (!newsListEl || !newsStatusEl) return;

  const category = topicSelect?.value || "forex";
  updateTopicLabel(category);

  newsStatusEl.textContent = "Loading latest news...";
  newsListEl.innerHTML = "";

  try {
    const res = await fetch(
      `${API_BASE}/api/news?category=${encodeURIComponent(category)}`
    );
    const data = await res.json();

    if (!res.ok || !data.success) {
      newsStatusEl.textContent =
        data.message || "Could not load news from server.";
      return;
    }

    if (!data.articles || !data.articles.length) {
      newsStatusEl.textContent = "No news available for this topic right now.";
      return;
    }

    newsStatusEl.textContent = "";
    renderNews(data.articles);
  } catch (err) {
    console.error("News bot error:", err);
    newsStatusEl.textContent = "Server error while loading news.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  topicSelect = document.getElementById("newsTopicSelect");
  refreshBtn = document.getElementById("newsRefreshBtn");
  newsListEl = document.getElementById("newsList");
  newsStatusEl = document.getElementById("newsStatus");
  topicLabelSpan = document.querySelector(".news-sub span");

  if (!newsListEl || !newsStatusEl) {
    console.warn("News bot: elements not found in DOM");
    return;
  }

  loadNews();

  refreshBtn?.addEventListener("click", loadNews);
  topicSelect?.addEventListener("change", loadNews);
});
