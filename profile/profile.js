const API_BASE = "http://localhost:3001";
const LOGIN_PATH = "/login/login.html";
const SELECTED_ACCOUNT_KEY = "mm_selected_account_id";

let accounts = [];
let selectedAccountId = loadSelectedAccountId();

function loadSelectedAccountId() {
  try {
    const raw = localStorage.getItem(SELECTED_ACCOUNT_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function saveSelectedAccountId(id) {
  try {
    if (id == null) {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    } else {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, String(id));
    }
  } catch {
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHeaderDate();
  setupModalHandlers();
  loadProfile();
  loadAccounts();
});

function initHeaderDate() {
  const dateEl = document.getElementById("currentDate");
  if (!dateEl) return;

  const now = new Date();
  dateEl.textContent = now.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function setupModalHandlers() {
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const newAccountForm = document.getElementById("newAccountForm");
  const openNewAccountBtn = document.getElementById("openNewAccountBtn");

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => toggleModal(false));
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", () => toggleModal(false));
  }
  if (newAccountForm) {
    newAccountForm.addEventListener("submit", handleCreateAccount);
  }
  if (openNewAccountBtn) {
    openNewAccountBtn.addEventListener("click", () => toggleModal(true));
  }
}

function toggleModal(show) {
  const modal = document.getElementById("newAccountModal");
  const backdrop = document.getElementById("modalBackdrop");
  if (!modal || !backdrop) return;

  if (show) {
    modal.classList.remove("hidden");
    backdrop.classList.remove("hidden");
  } else {
    modal.classList.add("hidden");
    backdrop.classList.add("hidden");
  }
}

async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      credentials: "include",
    });

    if (res.status === 401) {
      window.location.href = LOGIN_PATH;
      return;
    }

    const data = await res.json();
    if (!data.success) {
      console.error("Failed to load profile:", data.message);
      return;
    }

    populateProfile(data.user);
  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

function populateProfile(user) {
  document.getElementById("firstName").textContent = user.first_name || "";
  document.getElementById("lastName").textContent = user.last_name || "";
  document.getElementById("username").textContent = user.username || "";
  document.getElementById("email").textContent = user.email || "";
  document.getElementById("phone").textContent = user.phone_number || "";

  document.getElementById("birthDate").textContent = user.birth_date
    ? new Date(user.birth_date).toLocaleDateString()
    : "-";

  document.getElementById("createdAt").textContent = user.created_at
    ? new Date(user.created_at).toLocaleDateString()
    : "-";

  const userNameEl = document.getElementById("userName");
  if (userNameEl) {
    userNameEl.textContent = user.first_name || user.username || "Guest";
  }
}

async function loadAccounts(selectId = null) {
  try {
    const res = await fetch(`${API_BASE}/api/accounts`, {
      credentials: "include",
    });

    if (res.status === 401) {
      window.location.href = LOGIN_PATH;
      return;
    }

    const data = await res.json();
    if (!data.success) {
      console.error("Failed to load accounts:", data.message);
      return;
    }

    accounts = data.accounts || [];

    if (accounts.length > 0) {
      if (selectId && accounts.some((a) => a.id === selectId)) {
        selectedAccountId = selectId;
      } else {
        const defaultAcc = accounts.find(
          (a) => a.is_default === 1 || a.is_default === true
        );
        selectedAccountId = (defaultAcc || accounts[0]).id;
      }
    } else {
      selectedAccountId = null;
    }

    saveSelectedAccountId(selectedAccountId);

    renderAccounts();
    renderSelectedAccount();
  } catch (err) {
    console.error("Error loading accounts:", err);
  }
}

function renderAccounts() {
  const container = document.getElementById("accountsList");
  if (!container) return;

  container.innerHTML = "";

  accounts.forEach((account) => {
    const card = document.createElement("div");
    card.className = "account-card";
    if (account.id === selectedAccountId) {
      card.classList.add("active");
    }

    const balance = Number(account.balance || 0);

    card.innerHTML = `
      <div class="account-name">${account.account_name}</div>
      <div class="account-meta">${account.account_type.toUpperCase()} • ${account.currency}</div>
      <div class="account-balance">${balance.toFixed(2)} ${account.currency}</div>
      ${account.is_default ? '<div class="account-meta">Default</div>' : ""}
    `;

    card.addEventListener("click", async () => {
      if (selectedAccountId === account.id) return;

      try {
        const res = await fetch(`${API_BASE}/api/accounts/${account.id}/default`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await res.json();
        if (!data.success) {
          console.error("Could not set default account:", data.message);
          return;
        }

        if (Array.isArray(data.accounts)) {
          accounts = data.accounts;
        } else {
          accounts = accounts.map((a) => ({
            ...a,
            is_default: a.id === account.id ? 1 : 0,
          }));
        }

        selectedAccountId = account.id;
        saveSelectedAccountId(selectedAccountId);

        renderAccounts();
        renderSelectedAccount();
      } catch (err) {
        console.error("Error while setting default account:", err);
      }
    });
    container.appendChild(card);
  });

  const addCard = document.createElement("div");
  addCard.className = "account-card add-card";
  addCard.innerHTML = `
    <div class="plus">+</div>
    <div>Create new account</div>
  `;
  addCard.addEventListener("click", () => toggleModal(true));
  container.appendChild(addCard);
}

function renderSelectedAccount() {
  const acc = accounts.find((a) => a.id === selectedAccountId);

  const nameEl = document.getElementById("detailName");
  const typeEl = document.getElementById("detailType");
  const currencyEl = document.getElementById("detailCurrency");
  const balanceEl = document.getElementById("detailBalance");
  const createdEl = document.getElementById("detailCreatedAt");

  if (!nameEl || !typeEl || !currencyEl || !balanceEl || !createdEl) return;

  if (!acc) {
    nameEl.textContent = "-";
    typeEl.textContent = "-";
    currencyEl.textContent = "-";
    balanceEl.textContent = "-";
    createdEl.textContent = "-";
    return;
  }

  const balance = Number(acc.balance || 0);

  nameEl.textContent = acc.account_name;
  typeEl.textContent = acc.account_type;
  currencyEl.textContent = acc.currency;
  balanceEl.textContent = balance.toFixed(2) + " " + acc.currency;
  createdEl.textContent = acc.created_at
    ? new Date(acc.created_at).toLocaleString()
    : "-";
}


async function handleCreateAccount(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  const payload = {
    accountName: formData.get("accountName")?.toString().trim(),
    accountType: formData.get("accountType"),
    currency: formData.get("currency"),
    initialBalance: Number(formData.get("initialBalance") || 0),
  };

  if (!payload.accountName) {
    alert("Te rog completează numele contului.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Failed to create account.");
      return;
    }

    const newAccountId = data.account?.id;

    await loadAccounts(newAccountId); 

    toggleModal(false);
    form.reset();
  } catch (err) {
    console.error("Error creating account:", err);
    alert("Server error while creating account.");
  }
}
