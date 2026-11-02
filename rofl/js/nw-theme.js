/* NW theme controller — browser/Electron renderer ES module. */
const STORAGE_KEY = "nw-theme-preference";
const VALID_PREFERENCES = new Set(["system", "light", "dark"]);

function readPreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return VALID_PREFERENCES.has(value) ? value : "system";
  } catch {
    return "system";
  }
}

function resolvePreference(preference) {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemePreference(preference = readPreference()) {
  const safePreference = VALID_PREFERENCES.has(preference) ? preference : "system";
  const effectiveTheme = resolvePreference(safePreference);
  const root = document.documentElement;

  root.dataset.themePreference = safePreference;
  root.dataset.theme = effectiveTheme;
  root.style.colorScheme = effectiveTheme;
}

export function setThemePreference(preference) {
  if (!VALID_PREFERENCES.has(preference)) {
    throw new TypeError('Theme must be "system", "light", or "dark".');
  }

  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The current session still gets the selected theme if storage is unavailable.
  }

  applyThemePreference(preference);
}

export function initTheme() {
  applyThemePreference();

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    if (document.documentElement.dataset.themePreference === "system") {
      applyThemePreference("system");
    }
  });
}
