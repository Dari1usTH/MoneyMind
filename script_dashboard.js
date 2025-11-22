const API_BASE = "http://localhost:3001";
const SELECTED_ACCOUNT_KEY = "mm_selected_account_id";

let accounts = [];
let selectedAccount = null;
let currentNewsCategory = 'forex';
let positions = [];

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const greetingText = document.getElementById("greetingText");
    const dateBox = document.getElementById("currentDate");

    const now = new Date();
    const hour = now.getHours();
    let greeting = "Hello";

    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    else greeting = "Good evening";

    if (greetingText) greetingText.textContent = greeting + ",";
    if (dateBox) dateBox.textContent = now.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    await loadAccounts();
    await loadPositions();
    renderSelectedAccountChip();
    updateDashboardStats();
    
    initNews();
    loadNews();
    initProfileButton(); 

  } catch (err) {
    console.error(err);
  }
});

function renderSelectedAccountChip() {
  if (!selectedAccount) return;

  const nameEl = document.getElementById("currentAccountName");
  const typeEl = document.getElementById("currentAccountType");
  const balEl = document.getElementById("currentAccountBalance");

  const balance = Number(selectedAccount.balance || 0);

  if (nameEl) nameEl.textContent = selectedAccount.account_name;
  if (typeEl) typeEl.textContent = (selectedAccount.account_type || "").toUpperCase();
  if (balEl) balEl.textContent = balance.toFixed(2) + " " + (selectedAccount.currency || "");
}

async function loadAccounts() {
  try {
    const res = await fetch(API_BASE + "/api/accounts", { credentials: "include" });
    const data = await res.json();
    if (!data.success) return;

    accounts = data.accounts || [];
    const storedIdRaw = localStorage.getItem(SELECTED_ACCOUNT_KEY);
    const storedId = storedIdRaw ? Number(storedIdRaw) : null;

    selectedAccount =
      accounts.find(a => a.id === storedId) ||
      accounts.find(a => a.is_default) ||
      accounts[0] ||
      null;

    if (selectedAccount) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, String(selectedAccount.id));
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadPositions() {
  try {
    const res = await fetch(API_BASE + "/api/orders", { credentials: "include" });
    const data = await res.json();
    if (!data.success) return;

    positions = data.orders || [];
  } catch (err) {
    console.error(err);
    positions = [];
  }
}

function updateDashboardStats() {
  const totalBalanceEl = document.querySelector('.cards-row .stat-card:nth-child(1) .card-value');
  if (totalBalanceEl && selectedAccount) {
    const balance = Number(selectedAccount.balance || 0);
    totalBalanceEl.textContent = balance.toFixed(2) + " " + (selectedAccount.currency || "");
  }

  const monthlyPLEl = document.querySelector('.cards-row .stat-card:nth-child(2) .card-value');
  if (monthlyPLEl && selectedAccount) {
    const balance = Number(selectedAccount.balance || 0);
    const initialBalance = Number(selectedAccount.initial_balance || 0);
    const profitLoss = balance - initialBalance;
    
    monthlyPLEl.textContent = (profitLoss >= 0 ? "+" : "") + profitLoss.toFixed(2);
    
    monthlyPLEl.className = profitLoss >= 0 ? "card-value profit" : "card-value loss";
  }

  const accountsNumberEl = document.querySelector('.cards-row .stat-card:nth-child(3) .card-value');
  if (accountsNumberEl) {
    accountsNumberEl.textContent = accounts.length;
    accountsNumberEl.className = "card-value";
  }

  const activePositionsEl = document.querySelector('.cards-row .stat-card:nth-child(4) .card-value');
  if (activePositionsEl) {
    const activePositions = positions.filter(p => p.status === 'open').length;
    activePositionsEl.textContent = activePositions;
  }
}

async function loadNews(category = 'forex') {
    try {
        const newsStatus = document.getElementById('newsStatus');
        const newsList = document.getElementById('newsList');
        
        if (!newsStatus || !newsList) return;

        newsStatus.textContent = 'Loading news...';
        newsList.innerHTML = '';

        const response = await fetch(`${API_BASE}/api/news?category=${category}`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.success) {
            newsStatus.textContent = `Error: ${data.message}`;
            return;
        }

        newsStatus.textContent = `Loaded ${data.articles.length} articles`;

        if (data.articles.length === 0) {
            newsList.innerHTML = '<div class="news-item">No articles found</div>';
            return;
        }

        data.articles.forEach(article => {
            const newsItem = document.createElement('div');
            newsItem.className = 'news-item';
            
            const publishedDate = article.publishedAt 
                ? new Date(article.publishedAt).toLocaleDateString()
                : 'Unknown date';
            
            newsItem.innerHTML = `
                <h4>${article.title || 'No title'}</h4>
                ${article.summary ? `<p>${article.summary}</p>` : ''}
                <div class="news-meta">
                    ${article.source ? `<span>Source: ${article.source}</span>` : ''}
                    <span>Date: ${publishedDate}</span>
                </div>
                ${article.url ? `<a href="${article.url}" target="_blank">Read more</a>` : ''}
            `;
            
            newsList.appendChild(newsItem);
        });

    } catch (error) {
        console.error('Error loading news:', error);
        const newsStatus = document.getElementById('newsStatus');
        if (newsStatus) {
            newsStatus.textContent = 'Failed to load news';
        }
    }
}

function initNews() {
    const newsTopicSelect = document.getElementById('newsTopicSelect');
    const newsRefreshBtn = document.getElementById('newsRefreshBtn');

    if (newsTopicSelect) {
        newsTopicSelect.addEventListener('change', (e) => {
            currentNewsCategory = e.target.value;
            loadNews(currentNewsCategory);
        });
    }

    if (newsRefreshBtn) {
        newsRefreshBtn.addEventListener('click', () => {
            loadNews(currentNewsCategory);
        });
    }
}

function initProfileButton() {
    const goProfileBtn = document.getElementById('goProfileBtn');
    if (goProfileBtn) {
        goProfileBtn.addEventListener('click', function() {
            window.location.href = "../profile/profile.html";
        });
    }
}