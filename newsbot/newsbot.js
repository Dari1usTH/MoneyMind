const API_BASE = "http://localhost:3001";

const newsCategorySelect = document.getElementById("newsCategory");
const newsRefreshBtn = document.getElementById("newsRefreshBtn");
const newsListEl = document.getElementById("newsList");
const newsStatusEl = document.getElementById("newsStatus");

function timeAgo(isoString) {
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
    const item = document.createElement("article");
    item.className = "news-item";

    const h4 = document.createElement("h4");
    h4.textContent = article.title || "Untitled";
    item.appendChild(h4);

    if (article.summary) {
      const p = document.createElement("p");
      p.textContent = article.summary;
      item.appendChild(p);
    }

    const meta = document.createElement("div");
    meta.className = "news-meta";

    const srcSpan = document.createElement("span");
    if (article.source) srcSpan.textContent = article.source;

    const timeSpan = document.createElement("span");
    if (article.publishedAt) timeSpan.textContent = timeAgo(article.publishedAt);

    meta.appendChild(srcSpan);
    meta.appendChild(timeSpan);
    item.appendChild(meta);

    if (article.url) {
      const a = document.createElement("a");
      a.href = article.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Open article";
      item.appendChild(a);
    }

    frag.appendChild(item);
  });

  newsListEl.appendChild(frag);
}

async function loadNews() {
  if (!newsListEl) return;

  const category = newsCategorySelect?.value || "forex";

  newsStatusEl.textContent = "Loading latest news...";
  newsListEl.innerHTML = "";

  try {
    const res = await fetch(
      `${API_BASE}/api/news?category=${encodeURIComponent(category)}`
    );
    const data = await res.json();

    if (!data.success) {
      newsStatusEl.textContent = data.message || "Could not load news.";
      return;
    }

    if (!data.articles || !data.articles.length) {
      newsStatusEl.textContent = "No news available at this moment.";
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
  if (!newsListEl) return;
  loadNews();
  newsRefreshBtn?.addEventListener("click", loadNews);
  newsCategorySelect?.addEventListener("change", loadNews);
});
