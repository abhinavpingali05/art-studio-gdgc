let potteryOptions = { items: [], glazes: [] };
let editingPotteryId = null;

const originalShowPage = window.showPage;

window.showPage = function (page) {
  document.getElementById("potteryPage").classList.add("hidden");
  originalShowPage(page);
};

function getPotteryUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch {
    return null;
  }
}

function showPotteryPage() {
  document.getElementById("homePage").classList.add("hidden");
  document.getElementById("accountPage").classList.add("hidden");
  document.getElementById("muralPage").classList.add("hidden");
  document.getElementById("ordersPage").classList.add("hidden");
  document.getElementById("potteryPage").classList.remove("hidden");

  window.scrollTo(0, 0);
  loadPotteryPage();
}

function potteryMessage(text, isError = false) {
  const box = document.getElementById("potteryMessage");
  box.textContent = text;
  box.classList.remove("hidden");
  box.style.color = isError ? "#b42318" : "#287747";
}

function hidePotteryMessage() {
  const box = document.getElementById("potteryMessage");
  box.textContent = "";
  box.classList.add("hidden");
}

async function potteryApi(url, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: "Bearer " + token } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

// Return a date after the specified number of days.
// Uses local calendar dates to match the user's date picker.
function dateAfterDays(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Validate a date without timezone-sensitive ISO conversions.
function isValidPotteryDate(neededBy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(neededBy)) {
    return false;
  }

  const [year, month, day] = neededBy.split("-").map(Number);

  // Validate the actual calendar date using UTC components.
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  // YYYY-MM-DD strings can be compared chronologically.
  return neededBy >= dateAfterDays(14);
}

// Update the Pottery navigation badge.
function updatePotteryBadge(requests, user) {
  if (typeof window.setNavigationBadge !== "function") {
    return;
  }

  const activeRequests = requests.filter((request) =>
    user.role === "admin"
      ? request.status === "requested"
      : ["requested", "approved"].includes(request.status)
  );

  window.setNavigationBadge("potteryBadge", activeRequests.length);
}

async function loadPotteryPage() {
  hidePotteryMessage();

  const user = getPotteryUser();
  const formArea = document.getElementById("potteryFormArea");
  const list = document.getElementById("potteryRequestsList");
  const title = document.getElementById("potteryListTitle");

  if (!user) {
    editingPotteryId = null;

    if (typeof window.setNavigationBadge === "function") {
      window.setNavigationBadge("potteryBadge", 0);
    }

    formArea.innerHTML = `
      <div class="pottery-note">
        <p>Please log in as a customer to request pottery.</p>
        <button type="button" class="main-button"
          onclick="showPage('account')">
          Log in / Sign up
        </button>
      </div>`;

    list.innerHTML = "<p>Log in to view pottery requests.</p>";
    title.textContent = "My pottery requests.";

    await loadPotteryOptions();
    return;
  }

  title.textContent =
    user.role === "admin"
      ? "Manage pottery requests."
      : "My pottery requests.";

  if (user.role === "admin") {
    formArea.innerHTML = `
      <div class="pottery-note">
        You are logged in as studio admin. Review customer requests below.
      </div>`;
  }

  try {
    await loadPotteryOptions();

    if (user.role === "customer" && !editingPotteryId) {
      renderPotteryForm();
    }

    const requests = await potteryApi("/api/pottery");

    renderPotteryRequests(requests, user);
    updatePotteryBadge(requests, user);
  } catch (error) {
    list.innerHTML = "";

    const message = document.createElement("p");
    message.textContent = error.message + " ";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Try again";
    retry.addEventListener("click", loadPotteryPage);

    message.appendChild(retry);
    list.appendChild(message);
  }
}

async function loadPotteryOptions() {
  try {
    potteryOptions = await potteryApi("/api/pottery/options");
  } catch (error) {
    potteryOptions = {
      items: [],
      glazes: []
    };

    document.getElementById("potteryFormArea").innerHTML = `
      <p class="pottery-error">${escapePotteryText(error.message)}</p>
      <button type="button" onclick="loadPotteryPage()">Try again</button>`;
  }
}

function escapePotteryText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderPotteryForm(request = null) {
  const user = getPotteryUser();

  if (!user || user.role !== "customer") {
    return;
  }

  const itemOptions = potteryOptions.items.map((item) => `
    <option value="${escapePotteryText(item.id)}"
      ${request?.itemId === item.id ? "selected" : ""}>
      ${escapePotteryText(item.name)}
    </option>`).join("");

  const glazeOptions = potteryOptions.glazes.map((glaze) => `
    <option value="${escapePotteryText(glaze.id)}"
      ${request?.glazeId === glaze.id ? "selected" : ""}>
      ${escapePotteryText(glaze.name)}
    </option>`).join("");

  document.getElementById("potteryFormArea").innerHTML = `
    <form id="potteryForm" class="pottery-form">
      <h3>${request ? "Edit pottery request" : "Request handmade pottery"}</h3>

      <label for="potteryItem">Pottery item</label>
      <select id="potteryItem" required>
        <option value="">Choose an item</option>
        ${itemOptions}
      </select>

      <label for="potteryGlaze">Glaze colour</label>
      <select id="potteryGlaze" required>
        <option value="">Choose a glaze</option>
        ${glazeOptions}
      </select>

      <label for="potteryQuantity">Quantity (1–12)</label>
      <input id="potteryQuantity" type="number"
        min="1" max="12" step="1"
        value="${request ? request.quantity : 1}" required>

      <label for="potteryNeededBy">Needed by</label>
      <input id="potteryNeededBy" type="date"
        min="${dateAfterDays(14)}"
        value="${request ? escapePotteryText(request.neededBy) : ""}"
        required>

      <div class="pottery-form-actions">
        <button class="main-button" type="submit">
          ${request ? "Save changes" : "Submit request"}
        </button>

        ${request ? `
          <button class="pottery-secondary-button" type="button"
            onclick="cancelPotteryEdit()">
            Stop editing
          </button>` : ""}
      </div>
    </form>`;

  document.getElementById("potteryForm").addEventListener(
    "submit",
    submitPotteryRequest
  );
}

async function submitPotteryRequest(event) {
  event.preventDefault();

  const itemId = document.getElementById("potteryItem").value;
  const glazeId = document.getElementById("potteryGlaze").value;
  const quantity = Number(
    document.getElementById("potteryQuantity").value
  );
  const neededBy = document.getElementById("potteryNeededBy").value;

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 12) {
    potteryMessage("Quantity must be between 1 and 12.", true);
    return;
  }

  if (!isValidPotteryDate(neededBy)) {
    potteryMessage(
      `Choose a needed-by date on or after ${dateAfterDays(14)}.`,
      true
    );
    return;
  }

  const body = JSON.stringify({
    itemId,
    glazeId,
    quantity,
    neededBy
  });

  try {
    let result;

    if (editingPotteryId) {
      result = await potteryApi(`/api/pottery/${editingPotteryId}`, {
        method: "PUT",
        body
      });

      editingPotteryId = null;
    } else {
      result = await potteryApi("/api/pottery", {
        method: "POST",
        body
      });
    }

    potteryMessage(result.message);
    await loadPotteryPage();
  } catch (error) {
    potteryMessage(error.message, true);
  }
}

function cancelPotteryEdit() {
  editingPotteryId = null;
  loadPotteryPage();
}

function renderPotteryRequests(requests, user) {
  const list = document.getElementById("potteryRequestsList");
  list.innerHTML = "";

  if (!requests.length) {
    list.innerHTML = user.role === "admin"
      ? "<p>No pottery requests yet.</p>"
      : "<p>You haven't made any pottery requests yet.</p>";
    return;
  }

  requests.forEach((request) => {
    const card = document.createElement("article");
    card.className = "pottery-request-card";

    const heading = document.createElement("h3");
    heading.textContent = request.itemName;
    card.appendChild(heading);

    const details = document.createElement("p");
    details.textContent =
      `Glaze: ${request.glazeName} · Quantity: ${request.quantity} · Needed by: ${request.neededBy}`;
    card.appendChild(details);

    if (user.role === "admin") {
      const customer = document.createElement("p");
      customer.textContent = `Customer: ${request.customerName}`;
      card.appendChild(customer);
    }

    const status = document.createElement("p");
    status.className = "pottery-status";
    status.textContent = `Status: ${request.status}`;
    card.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "pottery-actions";

    if (user.role === "admin" && request.status === "requested") {
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "main-button";
      accept.textContent = "Accept";
      accept.addEventListener("click", () =>
        updatePotteryStatus(request._id, "accept")
      );

      const decline = document.createElement("button");
      decline.type = "button";
      decline.className = "pottery-secondary-button";
      decline.textContent = "Decline";
      decline.addEventListener("click", () =>
        updatePotteryStatus(request._id, "decline")
      );

      actions.append(accept, decline);
    }

    if (user.role === "customer" && request.status === "requested") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "pottery-secondary-button";
      edit.textContent = "Edit";

      edit.addEventListener("click", () => {
        editingPotteryId = request._id;
        renderPotteryForm(request);

        document.getElementById("potteryFormArea").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "pottery-secondary-button";
      cancel.textContent = "Cancel request";
      cancel.addEventListener("click", () =>
        cancelPotteryRequest(request._id)
      );

      actions.append(edit, cancel);
    }

    if (actions.children.length) {
      card.appendChild(actions);
    }

    list.appendChild(card);
  });
}

async function updatePotteryStatus(requestId, action) {
  try {
    const result = await potteryApi(
      `/api/pottery/${requestId}/${action}`,
      { method: "POST" }
    );

    potteryMessage(result.message);
    await loadPotteryPage();
  } catch (error) {
    potteryMessage(error.message, true);
  }
}

async function cancelPotteryRequest(requestId) {
  if (!confirm("Cancel this pottery request?")) {
    return;
  }

  try {
    const result = await potteryApi(
      `/api/pottery/${requestId}/cancel`,
      { method: "POST" }
    );

    potteryMessage(result.message);
    await loadPotteryPage();
  } catch (error) {
    potteryMessage(error.message, true);
  }
}