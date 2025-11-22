const API_BASE = "http://localhost:3001";

let currentTopic = "all";

let newsListEl;
let newsStatusEl;
let topicBtns;
let refreshBtn;
let topicLabelSpan;

const TOPIC_LABELS = {
  all: "all markets (forex, stocks & crypto)",
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
    if (article.source) srcSpan.textContent = `Source: ${article.source}`;

    const timeSpan = document.createElement("span");
    if (article.publishedAt) timeSpan.textContent = `Date: ${timeAgo(article.publishedAt)}`;

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

async function fetchCategory(category) {
  const res = await fetch(
    `${API_BASE}/api/news?category=${encodeURIComponent(category)}`
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Could not load news for " + category);
  }
  return data.articles || [];
}

async function loadNews(topicOverride) {
  if (!newsListEl || !newsStatusEl) return;

  const category = topicOverride || currentTopic;
  currentTopic = category;
  updateTopicLabel(category);

  if (category === "all") {
    newsStatusEl.textContent = "Loading latest news from all markets...";
  } else {
    newsStatusEl.textContent = "Loading latest news...";
  }
  newsListEl.innerHTML = "";

  try {
    let articles = [];

    if (category === "all") {
      const cats = ["forex", "stocks", "crypto"];

      const results = await Promise.allSettled(
        cats.map((c) => fetchCategory(c))
      );

      results.forEach((r) => {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          articles = articles.concat(r.value);
        }
      });

      articles.sort((a, b) => {
        const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return db - da;
      });

      articles = articles.slice(0, 30);
    } else {
      articles = await fetchCategory(category);
    }

    if (!articles.length) {
      newsStatusEl.textContent = "No news available for this topic right now.";
      return;
    }

    newsStatusEl.textContent = "";
    renderNews(articles);
  } catch (err) {
    console.error("News page error:", err);
    newsStatusEl.textContent = "Server error while loading news.";
  }
}

function setActiveTopicButton(topic) {
  if (!topicBtns) return;
  topicBtns.forEach((btn) => {
    if (btn.dataset.topic === topic) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  newsListEl = document.getElementById("newsList");
  newsStatusEl = document.getElementById("newsStatus");
  refreshBtn = document.getElementById("newsRefreshBtn");
  topicLabelSpan = document.querySelector(".news-sub span");
  topicBtns = document.querySelectorAll(".news-topic-btn");

  if (!newsListEl || !newsStatusEl) {
    console.warn("News page: elements not found in DOM");
    return;
  }

  topicBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const topic = btn.dataset.topic || "all";
      currentTopic = topic;
      setActiveTopicButton(topic);
      loadNews(topic);
    });
  });

  refreshBtn?.addEventListener("click", () => {
    loadNews();
  });

  setActiveTopicButton("all");
  loadNews("all");

  const newsCard = document.querySelector(".news-page-card");
  const resizeHandle = document.getElementById("newsResizeHandle");

  if (newsCard && resizeHandle) {
    const STORAGE_KEY = "mm_news_card_height_v1";

    const storedHeight = localStorage.getItem(STORAGE_KEY);
    if (storedHeight) {
      const h = Number(storedHeight);
      if (Number.isFinite(h) && h > 300) {
        newsCard.style.height = h + "px";
      }
    } else {
      newsCard.style.height = "420px";
    }

    let startY = 0;
    let startHeight = 0;
    let dragging = false;

    function onMouseMove(e) {
      if (!dragging) return;
      const delta = e.clientY - startY;
      let newHeight = startHeight + delta;

      const minH = 320;
      const maxH = Math.max(minH, window.innerHeight * 0.9);
      if (newHeight < minH) newHeight = minH;
      if (newHeight > maxH) newHeight = maxH;

      newsCard.style.height = newHeight + "px";
    }

    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      const h = newsCard.getBoundingClientRect().height;
      if (Number.isFinite(h)) {
        localStorage.setItem(STORAGE_KEY, String(Math.round(h)));
      }
    }

    resizeHandle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;

      const rect = newsCard.getBoundingClientRect();
      startHeight = rect.height;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }
});