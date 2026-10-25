let token = localStorage.getItem("token");
let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
let accountMode = "login";

// Keep this estimate aligned with the server's MURAL_RATE_PER_SQ_FT setting.
let muralRatePerSqFt = 150;

// Show a page
function showPage(page) {
  document.getElementById("homePage").classList.toggle("hidden", page !== "home");
  document.getElementById("accountPage").classList.toggle("hidden", page !== "account");
  document.getElementById("ordersPage").classList.toggle("hidden", page !== "orders");
  document.getElementById("muralPage").classList.toggle("hidden", page !== "mural");

  if (page === "home") loadPaintings();
  if (page === "orders" && currentUser) loadOrders();
  if (page === "mural") loadMuralPage();

  window.scrollTo(0, 0);
}

// Display a message
function setMessage(text, isError = false) {
  const message = document.getElementById("message");
  if (!message) return;

  message.textContent = text;
  message.classList.remove("hidden");
  message.style.color = isError ? "#b42318" : "#287747";
}

// Update navigation
function updateNavigation() {
  document.getElementById("ordersLink").classList.toggle("hidden", !currentUser);
  document.getElementById("logoutButton").classList.toggle("hidden", !currentUser);
  document.getElementById("accountLink").classList.toggle("hidden", !!currentUser);

  if (currentUser) {
    const ordersLink = document.getElementById("ordersLink");
    const badge = document.getElementById("ordersBadge");

    ordersLink.childNodes[0].textContent =
      currentUser.role === "admin" ? "Manage orders " : "My orders ";

    if (badge) ordersLink.appendChild(badge);
  }
}

// Make an API request
async function api(url, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: "Bearer " + token } : {}),
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

// Load paintings, search, and filter
async function loadPaintings() {
  const container = document.getElementById("paintings");
  const searchInput = document.getElementById("searchPainting");
  const filterInput = document.getElementById("availabilityFilter");

  container.innerHTML = "<p>Loading paintings...</p>";

  try {
    const paintings = await api("/api/paintings");

    function displayPaintings() {
      const searchText = searchInput.value.trim().toLowerCase();
      const filterValue = filterInput.value;

      const filteredPaintings = paintings.filter((painting) => {
        const title = String(painting.title || "").toLowerCase();
        const artist = String(painting.artist || "").toLowerCase();

        const matchesSearch =
          title.includes(searchText) || artist.includes(searchText);

        const matchesFilter =
          filterValue === "all" ||
          (filterValue === "available" && painting.available === true) ||
          (filterValue === "sold" && painting.available === false);

        return matchesSearch && matchesFilter;
      });

      document.getElementById("paintingCount").textContent =
        filteredPaintings.length + " ORIGINAL WORKS";

      container.innerHTML = "";

      if (filteredPaintings.length === 0) {
        container.innerHTML = "<p>No matching paintings found.</p>";
        return;
      }

      filteredPaintings.forEach((painting) => {
        const card = document.createElement("article");
        card.className = "painting-card";

        const art = document.createElement("div");
        art.className = "painting-art";

        const image = document.createElement("img");
        const imageUrl = String(painting.imageUrl || "").trim();

        if (/^https?:\/\//i.test(imageUrl)) {
          image.src = imageUrl;
        } else if (imageUrl) {
          image.src = "/" + imageUrl.replace(/^\/+/, "");
        }

        image.alt = painting.title || "Painting";
        image.className = "real-painting-image";
        image.onerror = function () {
          this.style.display = "none";
        };

        art.appendChild(image);

        if (!painting.available) {
          const sold = document.createElement("span");
          sold.className = "sold";
          sold.textContent = "SOLD";
          art.appendChild(sold);
        }

        const info = document.createElement("div");
        info.className = "painting-info";

        const titleArea = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = painting.title || "Untitled";

        const artist = document.createElement("p");
        artist.textContent = painting.artist || "Unknown artist";

        titleArea.append(title, artist);

        const price = document.createElement("strong");
        price.textContent =
          "₹" + Number(painting.price || 0).toLocaleString("en-IN");

        info.append(titleArea, price);
        card.append(art, info);

        if (painting.description) {
          const description = document.createElement("p");
          description.className = "description";
          description.textContent = painting.description;
          card.appendChild(description);
        }

        const button = document.createElement("button");
        button.className = "buy-button";
        button.disabled =
          !painting.available ||
          !currentUser ||
          currentUser.role !== "customer";

        let buttonText = "Purchase painting";

        if (!painting.available) {
          buttonText = "Unavailable";
        } else if (!currentUser) {
          buttonText = "Log in to purchase";
        } else if (currentUser.role !== "customer") {
          buttonText = "Admin account";
        }

        button.innerHTML = "<span>" + buttonText + "</span><span>↗</span>";
        button.addEventListener("click", () => buyPainting(painting._id));

        card.appendChild(button);
        container.appendChild(card);
      });
    }

    searchInput.oninput = displayPaintings;
    filterInput.onchange = displayPaintings;

    displayPaintings();
  } catch (error) {
    container.innerHTML = "";

    const message = document.createElement("p");
    message.textContent = error.message + " ";

    const retry = document.createElement("button");
    retry.textContent = "Try again";
    retry.onclick = loadPaintings;

    message.appendChild(retry);
    container.appendChild(message);
  }
}

// Theme-matched confirmation modal
function askStudioConfirmation(
  title,
  message,
  confirmText = "Confirm",
  danger = false
) {
  return new Promise((resolve) => {
    const modal = document.getElementById("studioConfirmModal");
    const titleElement = document.getElementById("studioConfirmTitle");
    const messageElement = document.getElementById("studioConfirmText");
    const cancelButton = document.getElementById("studioConfirmCancel");
    const acceptButton = document.getElementById("studioConfirmAccept");

    if (
      !modal ||
      !titleElement ||
      !messageElement ||
      !cancelButton ||
      !acceptButton
    ) {
      resolve(window.confirm(message));
      return;
    }

    titleElement.textContent = title;
    messageElement.textContent = message;
    acceptButton.textContent = confirmText;
    acceptButton.style.background = danger ? "#8d4b38" : "#292a24";
    modal.classList.remove("hidden");

    const backdrop = modal.querySelector("[data-modal-close]");

    const finish = (accepted) => {
      modal.classList.add("hidden");
      cancelButton.removeEventListener("click", onCancel);
      acceptButton.removeEventListener("click", onAccept);
      if (backdrop) backdrop.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKeyDown);
      resolve(accepted);
    };

    const onCancel = () => finish(false);
    const onAccept = () => finish(true);

    const onKeyDown = (event) => {
      if (event.key === "Escape") finish(false);
      if (event.key === "Enter") finish(true);
    };

    cancelButton.addEventListener("click", onCancel);
    acceptButton.addEventListener("click", onAccept);
    if (backdrop) backdrop.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKeyDown);

    cancelButton.focus();
  });
}

// Update a navigation badge
function setNavigationBadge(id, count) {
  const badge = document.getElementById(id);
  if (!badge) return;

  const safeCount = Math.max(0, Number(count) || 0);

  badge.textContent = safeCount > 99 ? "99+" : String(safeCount);
  badge.classList.toggle("hidden", safeCount === 0);
}

// Make this available to pottery.js
window.setNavigationBadge = setNavigationBadge;

// Refresh order and wall painting counts
async function refreshNavigationCounts() {
  if (!currentUser) {
    setNavigationBadge("ordersBadge", 0);
    setNavigationBadge("wallPaintingBadge", 0);
    setNavigationBadge("potteryBadge", 0);
    return;
  }

  const isAdmin = currentUser.role === "admin";

  try {
    const orders = await api("/api/orders");
    const activeOrders = orders.filter(
      (order) => order.status === "placed"
    );

    setNavigationBadge("ordersBadge", activeOrders.length);
  } catch (error) {
    console.error("Could not refresh order count:", error);
  }

  try {
    const bookings = await api("/api/mural-bookings");
    const activeBookings = bookings.filter((booking) =>
      isAdmin
        ? booking.status === "requested"
        : ["requested", "confirmed"].includes(booking.status)
    );

    setNavigationBadge("wallPaintingBadge", activeBookings.length);
  } catch (error) {
    console.error("Could not refresh wall painting count:", error);
  }
}

// Purchase a painting
async function buyPainting(paintingId) {
  if (!currentUser || currentUser.role !== "customer") {
    showPage("account");
    return;
  }

  const confirmed = await askStudioConfirmation(
    "Purchase this painting?",
    "Would you like to continue with this purchase?",
    "Purchase"
  );

  if (!confirmed) return;

  try {
    await api("/api/buy", {
      method: "POST",
      body: JSON.stringify({ paintingId })
    });

    showToast("Painting purchased successfully!");
    await loadPaintings();
    refreshNavigationCounts();
  } catch (error) {
    showToast(error.message, "error");
    await loadPaintings();
  }
}

// Inline account feedback
function showAccountMessage(text, type = "success") {
  const form = document.getElementById("accountForm");
  let message = document.getElementById("accountFeedback");

  if (!message) {
    message = document.createElement("p");
    message.id = "accountFeedback";
    message.className = "account-feedback";
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    form.insertAdjacentElement("beforebegin", message);
  }

  message.textContent = text;
  message.className = "account-feedback " + type;
  message.classList.remove("hidden");
}

// Toast messages
function showToast(text, type = "success") {
  let toast = document.getElementById("studioToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "studioToast";
    toast.className = "studio-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = text;
  toast.className = "studio-toast " + type + " is-visible";

  window.clearTimeout(showToast.timeoutId);

  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3200);
}

// Switch between login and registration
function switchAccount() {
  accountMode = accountMode === "login" ? "register" : "login";

  document.getElementById("accountTitle").textContent =
    accountMode === "login" ? "Welcome back." : "Create your account.";

  document.getElementById("submitAccount").textContent =
    accountMode === "login" ? "Log in" : "Create account";

  document.getElementById("nameLabel").classList.toggle(
    "hidden",
    accountMode === "login"
  );

  document.getElementById("name").required = accountMode === "register";

  document.getElementById("switchText").innerHTML =
    accountMode === "login"
      ? 'New here? <button type="button" onclick="switchAccount()">Create an account</button>'
      : 'Already registered? <button type="button" onclick="switchAccount()">Log in</button>';

  const feedback = document.getElementById("accountFeedback");
  if (feedback) feedback.classList.add("hidden");
}

// Login or register
document.getElementById("accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = document.getElementById("submitAccount");
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const endpoint = accountMode === "login" ? "/api/login" : "/api/register";
  const defaultButtonText =
    accountMode === "login" ? "Log in" : "Create account";

  const body =
    accountMode === "login"
      ? { email, password }
      : { name, email, password };

  submitButton.disabled = true;
  submitButton.classList.add("is-loading");
  submitButton.textContent =
    accountMode === "login" ? "Signing in…" : "Creating account…";

  try {
    const data = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(body)
    });

    token = data.token;
    currentUser = data.user;

    localStorage.setItem("token", token);
    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    updateNavigation();
    refreshNavigationCounts();
    form.reset();

    const welcomeMessage =
      "Welcome" + (currentUser.name ? ", " + currentUser.name : "") + "!";

    showPage("home");
    showToast(welcomeMessage);
  } catch (error) {
    showAccountMessage(
      error.message || "We couldn't sign you in. Please try again.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove("is-loading");
    submitButton.textContent = defaultButtonText;
  }
});

// Log out only after confirmation
async function logout() {
  const confirmed = await askStudioConfirmation(
    "Log out of your account?",
    "Are you sure you want to log out of Art Studio?",
    "Log out",
    true
  );

  if (!confirmed) return;

  token = null;
  currentUser = null;

  localStorage.removeItem("token");
  localStorage.removeItem("currentUser");

  updateNavigation();
  refreshNavigationCounts();
  showToast("You have been logged out.");
  showPage("home");
}

// Load customer orders or admin order management
async function loadOrders() {
  const list = document.getElementById("ordersList");
  const adminArea = document.getElementById("adminFormArea");

  list.innerHTML = "<p>Loading orders...</p>";
  adminArea.innerHTML = "";

  document.getElementById("ordersTitle").textContent =
    currentUser.role === "admin" ? "Manage orders." : "My orders.";

  // Admin form for adding paintings
  if (currentUser.role === "admin") {
    const form = document.createElement("form");
    form.className = "admin-form";

    form.innerHTML = `
      <h3>Add a painting</h3>
      <input id="newTitle" placeholder="Painting title" required>
      <input id="newArtist" placeholder="Artist name" required>
      <input id="newPrice" type="number" min="1" placeholder="Price in rupees" required>
      <input id="newImageUrl" type="text" placeholder="Image URL or public/images/filename.jpg">
      <textarea id="newDescription" placeholder="Description (optional)"></textarea>
      <button type="submit">Add painting</button>
    `;

    form.addEventListener("submit", addPainting);
    adminArea.appendChild(form);
  }

  try {
    const orders = await api("/api/orders");

    if (orders.length === 0) {
      list.innerHTML = "<p>No orders yet.</p>";
      setNavigationBadge("ordersBadge", 0);
      return;
    }

    list.innerHTML = "";

    orders.forEach((order) => {
      const row = document.createElement("article");
      row.className = "order";

      const title = document.createElement("h3");
      title.textContent = order.paintingTitle || "Painting order";

      const price = document.createElement("p");
      price.textContent =
        "Price: ₹" + Number(order.price || 0).toLocaleString("en-IN");

      const status = document.createElement("p");
      status.textContent = "Status: " + String(order.status || "").toUpperCase();

      row.append(title, price, status);

      if (currentUser.role === "admin") {
        const customer = document.createElement("p");
        customer.textContent = "Customer: " + (order.customerName || "Unknown");
        row.appendChild(customer);
      }

      // Orders are placed or cancelled; admins do not approve or decline them.
      if (currentUser.role === "customer" && order.status === "placed") {
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel order";
        cancelButton.addEventListener("click", () => cancelOrder(order._id));
        row.appendChild(cancelButton);
      }

      list.appendChild(row);
    });
  } catch (error) {
    list.innerHTML = "";

    const message = document.createElement("p");
    message.textContent = error.message + " ";

    const retry = document.createElement("button");
    retry.textContent = "Try again";
    retry.onclick = loadOrders;

    message.appendChild(retry);
    list.appendChild(message);
  }
}

// Add a painting
async function addPainting(event) {
  event.preventDefault();

  const title = document.getElementById("newTitle").value.trim();
  const artist = document.getElementById("newArtist").value.trim();
  const price = Number(document.getElementById("newPrice").value);
  const imageUrl = document.getElementById("newImageUrl").value.trim();
  const description = document.getElementById("newDescription").value.trim();

  try {
    await api("/api/paintings", {
      method: "POST",
      body: JSON.stringify({ title, artist, price, imageUrl, description })
    });

    showToast("Painting added successfully!");
    event.target.reset();
    await loadPaintings();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Customer cancels their own order
async function cancelOrder(orderId) {
  const confirmed = await askStudioConfirmation(
    "Cancel this order?",
    "Are you sure you want to cancel this order?",
    "Cancel order",
    true
  );

  if (!confirmed) return;

  try {
    const result = await api("/api/orders/" + orderId + "/cancel", {
      method: "POST"
    });

    showToast(result.message);
    await loadOrders();
    await loadPaintings();
    refreshNavigationCounts();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Show a message on the wall painting page
function setMuralMessage(text, isError = false) {
  const message = document.getElementById("muralMessage");
  message.textContent = text;
  message.classList.remove("hidden", "error");

  if (isError) message.classList.add("error");
}

// Load the wall painting form and booking list
async function loadMuralPage() {
  const formArea = document.getElementById("muralFormArea");
  const list = document.getElementById("muralBookingsList");
  const listTitle = document.getElementById("muralListTitle");

  formArea.innerHTML = "";
  list.innerHTML = "";
  document.getElementById("muralMessage").classList.add("hidden");

  if (!currentUser) {
  formArea.innerHTML =
    '<p class="hint">Please <button type="button" class="text-button" onclick="showPage(\'account\')">log in or create an account</button> to request a wall painting.</p>';

  list.innerHTML = "<p>Your wall bookings will appear here after you log in.</p>";
  listTitle.textContent = "My wall bookings.";
  setNavigationBadge("wallPaintingBadge", 0);
  return;
}

  if (currentUser.role === "customer") {
    const form = document.createElement("form");
    form.className = "mural-form";

    const today = new Date();
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + 7);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 90);

    const toDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    form.innerHTML = `
      <h3>Request a wall painting</h3>
      <label>Preferred date<input id="muralDate" type="date" min="${toDateString(minDate)}" max="${toDateString(maxDate)}" required></label>
      <label>Wall size (square feet)<input id="muralSize" type="number" min="10" max="500" step="1" placeholder="e.g. 120" required></label>
      <label>Full painting address<textarea id="muralAddress" rows="3" placeholder="Enter the complete address" required></textarea></label>
      <p class="mural-price" id="muralPrice">Estimated price: ₹0</p>
      <p class="hint">Final booking is subject to studio confirmation. The estimate uses the studio's current rate.</p>
      <button class="main-button" type="submit">Send booking request</button>
    `;

    formArea.appendChild(form);

    const sizeInput = form.querySelector("#muralSize");
    const priceText = form.querySelector("#muralPrice");

    sizeInput.addEventListener("input", () => {
      const size = Number(sizeInput.value);

      priceText.textContent =
        "Estimated price: ₹" +
        (
          Number.isInteger(size) && size >= 10 && size <= 500
            ? (size * muralRatePerSqFt).toLocaleString("en-IN")
            : "0"
        );
    });

    form.addEventListener("submit", submitMuralBooking);
    listTitle.textContent = "My wall bookings.";
  } else {
    formArea.innerHTML =
      '<p class="hint">You are logged in as studio admin. Review requests below and approve or decline them.</p>';

    listTitle.textContent = "Manage wall bookings.";
  }

  list.innerHTML = "<p>Loading wall bookings...</p>";

  try {
    const bookings = await api("/api/mural-bookings");
    list.innerHTML = "";

    const activeBookings = bookings.filter((booking) =>
      currentUser.role === "admin"
        ? booking.status === "requested"
        : ["requested", "confirmed"].includes(booking.status)
    );

    setNavigationBadge("wallPaintingBadge", activeBookings.length);

    if (bookings.length === 0) {
      list.innerHTML = "<p>No wall painting bookings yet.</p>";
      return;
    }

    bookings.forEach((booking) => {
      const card = document.createElement("article");
      card.className = "mural-booking";

      const details = document.createElement("div");
      details.className = "mural-booking-details";

      const heading = document.createElement("h3");
      heading.textContent = new Date(
        booking.bookingDate + "T00:00:00"
      ).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      const size = document.createElement("p");
      size.textContent = `Wall size: ${booking.sizeSqFt} sq. ft.`;

      const price = document.createElement("p");
      price.textContent =
        "Estimated price: ₹" +
        Number(booking.totalPrice || 0).toLocaleString("en-IN");

      const address = document.createElement("p");
      address.textContent = "Address: " + booking.address;

      const status = document.createElement("p");
      status.className = "order-status";
      status.textContent = "Status: " + String(booking.status || "").toUpperCase();

      details.append(heading, size, price, address, status);

      if (currentUser.role === "admin") {
        const customer = document.createElement("p");
        customer.textContent = "Customer: " + (booking.customerName || "Unknown");
        details.appendChild(customer);
      }

      card.appendChild(details);

      if (currentUser.role === "admin" && booking.status === "requested") {
        const actions = document.createElement("div");
        actions.className = "mural-actions";

        const approve = document.createElement("button");
        approve.type = "button";
        approve.textContent = "Confirm";
        approve.addEventListener("click", () =>
          updateMuralStatus(booking._id, "approve")
        );

        const decline = document.createElement("button");
        decline.type = "button";
        decline.textContent = "Decline";
        decline.addEventListener("click", () =>
          updateMuralStatus(booking._id, "decline")
        );

        actions.append(approve, decline);
        card.appendChild(actions);
      }

      // Customers can cancel requested or confirmed bookings at any time.
      if (
        currentUser.role === "customer" &&
        ["requested", "confirmed"].includes(booking.status)
      ) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "cancel-button";
        cancel.textContent = "Cancel booking";
        cancel.addEventListener("click", () =>
          cancelMuralBooking(booking._id)
        );
        card.appendChild(cancel);
      }

      list.appendChild(card);
    });
  } catch (error) {
    list.innerHTML = "";

    const message = document.createElement("p");
    message.textContent = error.message + " ";

    const retry = document.createElement("button");
    retry.textContent = "Try again";
    retry.onclick = loadMuralPage;

    message.appendChild(retry);
    list.appendChild(message);
  }
}

// Submit a new wall painting booking request
async function submitMuralBooking(event) {
  event.preventDefault();

  const bookingDate = document.getElementById("muralDate").value;
  const sizeSqFt = Number(document.getElementById("muralSize").value);
  const address = document.getElementById("muralAddress").value.trim();

  const submitButton = event.currentTarget.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending request…";
  }

  try {
    const result = await api("/api/mural-bookings", {
      method: "POST",
      body: JSON.stringify({ bookingDate, sizeSqFt, address })
    });

    await loadMuralPage();
    refreshNavigationCounts();
    setMuralMessage(result.message || "Wall painting request submitted.");
  } catch (error) {
    setMuralMessage(error.message, true);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Send booking request";
    }
  }
}

// Admin confirms or declines a wall painting booking
async function updateMuralStatus(bookingId, action) {
  const actionName = action === "approve" ? "confirm" : "decline";

  const confirmed = await askStudioConfirmation(
    `${actionName[0].toUpperCase() + actionName.slice(1)} booking?`,
    `Are you sure you want to ${actionName} this wall painting booking?`,
    actionName === "confirm" ? "Confirm" : "Decline",
    actionName !== "confirm"
  );

  if (!confirmed) return;

  try {
    const result = await api(
      `/api/mural-bookings/${bookingId}/${action}`,
      { method: "POST" }
    );

    await loadMuralPage();
    refreshNavigationCounts();
    setMuralMessage(result.message);
  } catch (error) {
    setMuralMessage(error.message, true);
  }
}

// Customer cancels their own wall painting booking
async function cancelMuralBooking(bookingId) {
  const confirmed = await askStudioConfirmation(
    "Cancel this booking?",
    "Are you sure you want to cancel this wall painting booking?",
    "Cancel booking",
    true
  );

  if (!confirmed) return;

  try {
    const result = await api(
      `/api/mural-bookings/${bookingId}/cancel`,
      { method: "POST" }
    );

    await loadMuralPage();
    refreshNavigationCounts();
    setMuralMessage(result.message);
  } catch (error) {
    setMuralMessage(error.message, true);
  }
}

// Start the website
updateNavigation();
refreshNavigationCounts();
loadPaintings();
