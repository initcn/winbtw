// Centralized DOM cache
const DOM = {
  list: document.getElementById("app-list"),
  search: document.getElementById("search"),
  filter: document.getElementById("category-filter"),
  empty: document.getElementById("empty-state"),
  details: document.getElementById("details-content"),
  name: document.getElementById("app-name"),
  link: document.getElementById("app-link"),
  desc: document.getElementById("app-description"),
  category: document.getElementById("app-category"),
  winget: document.getElementById("winget-command"),

  // Buttons
  copyBtn: document.getElementById("copy-btn"),
  selectBtn: document.getElementById("select-btn"),
  copyAllBtn: document.getElementById("copy-all-btn"),
  schemaBtn: document.getElementById("schema-btn"),
  clearBtn: document.getElementById("clear-btn"),
  exportPs1Btn: document.getElementById("export-ps1-btn"),

  // Checkboxes
  toggles: {
    silent: document.getElementById("flag-silent"),
    disableInteract: document.getElementById("flag-disable-interact"),
    exact: document.getElementById("flag-exact"),
    force: document.getElementById("flag-force"),
    acceptsourceagreements: document.getElementById(
      "flag-accept-source-agreements",
    ),
    acceptpackageagreements: document.getElementById(
      "flag-accept-package-agreements",
    ),
  },

  toastContainer: document.getElementById("toast-container"),
};

// State management
const state = {
  apps: [],
  currentApp: null,
  selectedPackages: new Set(),
};

// --- INITIALIZATION ---
async function init() {
  try {
    const res = await fetch("apps.csv");
    const text = await res.text();

    state.apps = parseCSV(text).sort((a, b) => a.name.localeCompare(b.name));

    generateCategories();
    renderApps(state.apps);
  } catch (err) {
    showToast("Failed to load apps.csv", "error");
    console.error("Failed to load apps:", err);
  }
}

// --- LOGIC ---
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    // Simple CSV parse (does not handle commas inside quotes)
    const values = line.split(",");
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = (values[i] || "").replace("\r", "").trim();
    });
    return obj;
  });
}

function generateCategories() {
  const categories = [
    ...new Set(state.apps.map((app) => app.category).filter(Boolean)),
  ].sort();

  DOM.filter.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    DOM.filter.appendChild(option);
  });
}

function renderApps(data) {
  DOM.list.innerHTML = "";

  if (!data.length) {
    DOM.list.innerHTML = `<div class="empty-state" style="font-size:16px;">No apps found</div>`;
    return;
  }

  data.forEach((app) => {
    const card = document.createElement("div");
    card.className = "app-card";
    card.innerHTML = `
            <div class="app-title">${app.name}</div>
            <div class="app-package">${app.packagename || "No Package"}</div>
        `;

    card.addEventListener("click", () => {
      document
        .querySelectorAll(".app-card")
        .forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      showDetails(app);
    });

    DOM.list.appendChild(card);
  });
}

// --- WINGET COMMAND GENERATOR ---
function getWingetFlags() {
  let flags = [];
  if (DOM.toggles.exact.checked) flags.push("--exact");
  if (DOM.toggles.disableInteract.checked)
    flags.push("--disable-interactivity");
  if (DOM.toggles.silent.checked) flags.push("--silent");
  if (DOM.toggles.force.checked) flags.push("--force");
  if (DOM.toggles.acceptsourceagreements.checked)
    flags.push("--accept-source-agreements");
  if (DOM.toggles.acceptpackageagreements.checked)
    flags.push("--accept-package-agreements");
  return flags.join(" ");
}

function generateInstallString(pkg) {
  const flags = getWingetFlags();
  return `winget install --id "${pkg}" ${flags}`.trim();
}

function updateDisplayedCommand() {
  if (!state.currentApp || !state.currentApp.packagename) return;
  DOM.winget.textContent = generateInstallString(state.currentApp.packagename);
}

function showDetails(app) {
  state.currentApp = app;
  DOM.empty.style.display = "none";
  DOM.details.classList.remove("hidden");

  DOM.name.textContent = app.name;
  DOM.link.href = app.link;
  DOM.link.textContent = app.link;
  DOM.desc.textContent = app.description;
  DOM.category.textContent = app.category || "Unknown";

  if (app.packagename) {
    updateDisplayedCommand();
  } else {
    DOM.winget.textContent = "No winget package available";
  }

  updateSelectButton();
}

function updateSelectButton() {
  if (!state.currentApp?.packagename) {
    DOM.selectBtn.disabled = true;
    DOM.selectBtn.textContent = "No Package";
    DOM.selectBtn.classList.remove("selected");
    return;
  }

  DOM.selectBtn.disabled = false;
  const exists = state.selectedPackages.has(state.currentApp.packagename);

  DOM.selectBtn.textContent = exists ? "Added to List" : "Add to List";
  DOM.selectBtn.classList.toggle("selected", exists);
}

function applyFilters() {
  const query = DOM.search.value.toLowerCase();
  const category = DOM.filter.value;

  const filtered = state.apps.filter((app) => {
    const searchStr =
      `${app.name} ${app.description} ${app.packagename} ${app.category}`.toLowerCase();
    const matchesSearch = searchStr.includes(query);
    const matchesCategory = category === "all" || app.category === category;
    return matchesSearch && matchesCategory;
  });

  renderApps(filtered);
}

// --- TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  DOM.toastContainer.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300); // Wait for animation
  }, 3000);
}

// --- EVENT LISTENERS ---
DOM.search.addEventListener("input", applyFilters);
DOM.filter.addEventListener("change", applyFilters);

// Update commands live when toggles are clicked
Object.values(DOM.toggles).forEach((checkbox) => {
  checkbox.addEventListener("change", updateDisplayedCommand);
});

// Copy single
DOM.copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(DOM.winget.textContent);
    showToast("Command copied to clipboard", "success");
  } catch {
    showToast("Copy failed", "error");
  }
});

// Add to List
DOM.selectBtn.addEventListener("click", () => {
  const pkg = state.currentApp?.packagename;
  if (!pkg) return;

  if (state.selectedPackages.has(pkg)) {
    state.selectedPackages.delete(pkg);
    showToast(`Removed ${pkg}`, "info");
  } else {
    state.selectedPackages.add(pkg);
    showToast(`Added ${pkg}`, "success");
  }

  updateSelectButton();
});

// Clear All
DOM.clearBtn.addEventListener("click", () => {
  if (state.selectedPackages.size === 0)
    return showToast("List is already empty", "info");
  state.selectedPackages.clear();
  updateSelectButton();
  showToast("Cleared all selected apps", "success");
});

// Copy All
DOM.copyAllBtn.addEventListener("click", async () => {
  if (state.selectedPackages.size === 0)
    return showToast("No apps selected", "error");

  const commands = [...state.selectedPackages]
    .map((pkg) => generateInstallString(pkg))
    .join("\n");

  try {
    await navigator.clipboard.writeText(commands);
    showToast(`Copied ${state.selectedPackages.size} commands`, "success");
  } catch {
    showToast("Copy failed", "error");
  }
});

// Download Schema
DOM.schemaBtn.addEventListener("click", () => {
  if (state.selectedPackages.size === 0)
    return showToast("No apps selected", "error");

  const schema = {
    $schema: "https://aka.ms/winget-packages.schema.2.0.json",
    Sources: [
      {
        Packages: [...state.selectedPackages].map((pkg) => ({
          PackageIdentifier: pkg,
        })),
        SourceDetails: {
          Argument: "https://cdn.winget.microsoft.com/cache",
          Identifier: "Microsoft.Winget.Source_8wekyb3d8bbwe",
          Name: "winget",
          Type: "Microsoft.PreIndexed.Package",
        },
      },
    ],
  };

  downloadFile(
    "winget-schema.json",
    JSON.stringify(schema, null, 2),
    "application/json",
  );
  showToast("Schema downloaded", "success");
});

// Export PowerShell Script
DOM.exportPs1Btn.addEventListener("click", () => {
  if (state.selectedPackages.size === 0)
    return showToast("No apps selected", "error");

  const scriptLines = [
    "# PowerShell Script generated by Apps Library",
    "Write-Host 'Starting Windows Package Manager (winget) installations...' -ForegroundColor Cyan",
    "",
  ];

  [...state.selectedPackages].forEach((pkg) => {
    const cmd = generateInstallString(pkg);
    scriptLines.push(`Write-Host 'Installing ${pkg}...'`);
    scriptLines.push(cmd);
    scriptLines.push(
      `if ($LASTEXITCODE -ne 0) { Write-Host 'Warning: Install failed for ${pkg}' -ForegroundColor Yellow }`,
    );
    scriptLines.push("");
  });

  scriptLines.push(
    "Write-Host 'Installations Complete!' -ForegroundColor Green",
  );
  scriptLines.push("Read-Host -Prompt 'Press Enter to exit'");

  // Join with Windows CRLF
  downloadFile("install-apps.ps1", scriptLines.join("\r\n"), "text/plain");
  showToast("PowerShell script downloaded", "success");
});

// Helper for file downloads
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Boot the app
init();
