document.addEventListener("DOMContentLoaded", () => {
  const greetingText = document.getElementById("greetingText");
  const dateBox = document.getElementById("currentDate");

  const now = new Date();
  const hour = now.getHours();

  let greeting = "Hello";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  else greeting = "Good evening";

  if (greetingText) {
    greetingText.textContent = greeting + ",";
  }

  if (dateBox) {
    const formatted = now.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    dateBox.textContent = formatted;
  }

  initNewsBot();
});

function initNewsBot() {
  const topicSelect = document.getElementById("newsTopicSelect");
  const topicLabel = document.getElementById("newsTopicLabel");
  const refreshBtn = document.getElementById("refreshNewsBtn");
  const newsStatus = document.getElementById("newsStatus");
  const newsList = document.getElementById("newsList");

  if (!topicSelect || !topicLabel || !refreshBtn || !newsStatus || !newsList) return;

  const topicLabels = {
    forex: "forex & currency",
    stocks: "stocks & equities",
    crypto: "crypto & blockchain",
    economy: "global economy",
  };

  async function loadNews() {
    const topic = topicSelect.value || "forex";
    topicLabel.textContent = topicLabels[topic] || "markets";

    newsList.innerHTML = "";
    newsStatus.textContent = "Loading latest news…";

    try {
      const articles = await getMockNews(topic);

      if (!articles.length) {
        newsStatus.textContent = "No news found for this topic right now.";
        return;
      }

      newsStatus.textContent = "";
      newsList.innerHTML = "";

      articles.slice(0, 6).forEach((article) => {
        const li = document.createElement("li");
        li.classList.add("news-item");

        const titleLink = document.createElement("a");
        titleLink.href = article.url || "#";
        titleLink.target = "_blank";
        titleLink.rel = "noopener noreferrer";
        titleLink.textContent = article.title || "Untitled article";

        const sourceSpan = document.createElement("span");
        sourceSpan.classList.add("news-source");
        sourceSpan.textContent = article.source || "Unknown source";

        const timeSpan = document.createElement("span");
        timeSpan.classList.add("news-time");
        timeSpan.textContent = article.time || "";

        const metaRow = document.createElement("div");
        metaRow.classList.add("news-meta");
        metaRow.appendChild(sourceSpan);
        metaRow.appendChild(timeSpan);

        const desc = document.createElement("p");
        desc.classList.add("news-desc");
        desc.textContent = article.description || "";

        li.appendChild(titleLink);
        li.appendChild(metaRow);
        li.appendChild(desc);
        newsList.appendChild(li);
      });
    } catch (err) {
      console.error("Error loading news:", err);
      newsStatus.textContent = "Could not load news. Please try again.";
    }
  }

  topicSelect.addEventListener("change", loadNews);
  refreshBtn.addEventListener("click", loadNews);

  loadNews();
}

async function getMockNews(topic) {
  const base = [
    {
      title: "Dollar edges higher as traders await key economic data",
      source: "FX Street",
      time: "15 min ago",
      description: "The foreign exchange market remains cautious ahead of major macro releases, with traders adjusting risk exposure.",
      url: "#",
    },
    {
      title: "Retail traders pile into tech stocks amid earnings optimism",
      source: "MarketWatch",
      time: "32 min ago",
      description: "Speculative flows return to growth stocks as sentiment around quarterly earnings improves.",
      url: "#",
    },
    {
      title: "Bitcoin holds steady despite broader risk-off mood",
      source: "CryptoPulse",
      time: "1 h ago",
      description: "Crypto markets show resilience while traditional assets experience mild profit-taking.",
      url: "#",
    },
    {
      title: "Gold sees safe-haven demand as bond yields cool",
      source: "Investing Journal",
      time: "2 h ago",
      description: "Precious metals gain as investors reassess inflation expectations and yield trajectory.",
      url: "#",
    },
  ];

  if (topic === "forex") {
    return base.slice(0, 3);
  }
  if (topic === "stocks") {
    return base.slice(1, 4);
  }
  if (topic === "crypto") {
    return base.slice(2, 3).concat(base[0]);
  }
  if (topic === "economy") {
    return base.slice(0, 2).concat(base[3]);
  }
  return base;
}
