/**
 * LoadingManager - Handles loading states and error displays
 *
 * Features:
 * - Global loading overlay
 * - Inline loading states
 * - Error message displays
 * - Retry mechanisms
 */
class LoadingManager {
  constructor() {
    this.activeLoaders = new Set();
    this.createGlobalLoader();
  }

  /**
   * Create global loading overlay
   */
  createGlobalLoader() {
    // Check if loader already exists
    if (document.getElementById("globalLoader")) {
      return;
    }

    const loader = document.createElement("div");
    loader.id = "globalLoader";
    loader.className = "fixed inset-0 bg-black bg-opacity-50 z-[100] hidden flex items-center justify-center";
    loader.innerHTML = `
      <div class="bg-dark-card border border-dark-border rounded-lg p-6 flex flex-col items-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-300">Loading...</p>
      </div>
    `;
    document.body.appendChild(loader);
  }

  /**
   * Show global loading overlay
   */
  showGlobalLoader(message = "Loading...") {
    const loader = document.getElementById("globalLoader");
    if (loader) {
      const textElement = loader.querySelector("p");
      if (textElement) {
        textElement.textContent = message;
      }
      loader.classList.remove("hidden");
      loader.classList.add("flex");
    }
  }

  /**
   * Hide global loading overlay
   */
  hideGlobalLoader() {
    const loader = document.getElementById("globalLoader");
    if (loader) {
      loader.classList.add("hidden");
      loader.classList.remove("flex");
    }
  }

  /**
   * Create inline loader for specific element
   */
  createInlineLoader(containerId, message = "Loading...") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const loaderId = `loader-${containerId}`;

    // Store original content
    if (!container.dataset.originalContent) {
      container.dataset.originalContent = container.innerHTML;
    }

    container.innerHTML = `
      <div id="${loaderId}" class="flex flex-col items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-3 text-gray-400">${this.escapeHtml(message)}</p>
      </div>
    `;

    this.activeLoaders.add(loaderId);
    return loaderId;
  }

  /**
   * Remove inline loader and restore content
   */
  removeInlineLoader(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const loaderId = `loader-${containerId}`;

    if (this.activeLoaders.has(loaderId)) {
      // Restore original content if available
      if (container.dataset.originalContent) {
        container.innerHTML = container.dataset.originalContent;
        delete container.dataset.originalContent;
      }

      this.activeLoaders.delete(loaderId);
    }
  }

  /**
   * Show error message in container
   */
  showError(containerId, error, retryCallback = null) {
    const container = document.getElementById(containerId);
    if (!container) {
      // Fallback to toast notification if container not found
      this.showErrorToast(error);
      return;
    }

    const errorMessage = typeof error === "string" ? error : error.message || "An error occurred";

    container.innerHTML = `
      <div class="bg-red-900/20 border border-red-600/30 rounded-lg p-6 text-center">
        <svg class="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p class="text-red-400 text-lg font-medium mb-2">Error</p>
        <p class="text-gray-300 mb-4">${this.escapeHtml(errorMessage)}</p>
        ${
          retryCallback
            ? `
          <button data-retry="${retryCallback}"
            class="retry-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Try Again
          </button>
        `
            : ""
        }
      </div>
    `;
  }

  /**
   * Show error toast notification
   */
  showErrorToast(message) {
    // Use the toast system if available
    if (window.adminUI && typeof window.adminUI.showError === "function") {
      window.adminUI.showError(message);
    } else {
      // Fallback to alert
      alert(`Error: ${message}`);
    }
  }

  /**
   * Show empty state message
   */
  showEmptyState(containerId, message = "No data available", actionButton = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="text-center py-12">
        <svg class="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
        </svg>
        <p class="text-gray-400 text-lg mb-4">${this.escapeHtml(message)}</p>
        ${actionButton ? actionButton : ""}
      </div>
    `;
  }

  /**
   * Create skeleton loader for table rows
   */
  createTableSkeleton(rows = 5, columns = 5) {
    let html = "";
    for (let i = 0; i < rows; i++) {
      html += '<tr class="animate-pulse">';
      for (let j = 0; j < columns; j++) {
        html += `
          <td class="px-6 py-4">
            <div class="h-4 bg-gray-700 rounded ${j === 1 ? "w-32" : "w-20"}"></div>
          </td>
        `;
      }
      html += "</tr>";
    }
    return html;
  }

  /**
   * Track async operation with loading state
   */
  async withLoading(asyncFn, options = {}) {
    const {
      containerId = null,
      globalLoader = false,
      message = "Loading...",
      errorContainer = null,
      onError = null,
    } = options;

    let loaderId = null;

    try {
      // Show loading state
      if (globalLoader) {
        this.showGlobalLoader(message);
      } else if (containerId) {
        loaderId = this.createInlineLoader(containerId, message);
      }

      // Execute async function
      const result = await asyncFn();

      return result;
    } catch (error) {
      // Handle error
      console.error("Operation failed:", error);

      if (onError) {
        onError(error);
      } else if (errorContainer) {
        this.showError(errorContainer, error);
      } else {
        this.showErrorToast(error.message || "Operation failed");
      }

      throw error;
    } finally {
      // Clean up loading state
      if (globalLoader) {
        this.hideGlobalLoader();
      } else if (containerId && loaderId) {
        this.removeInlineLoader(containerId);
      }
    }
  }

  /**
   * Retry mechanism with exponential backoff
   */
  async retryWithBackoff(asyncFn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await asyncFn();
      } catch (error) {
        lastError = error;

        if (i < maxRetries - 1) {
          // Calculate delay with exponential backoff
          const delay = baseDelay * 2 ** i;
          console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);

          // Show retry message
          if (window.adminUI) {
            window.adminUI.showToast(`Retrying... (${i + 1}/${maxRetries})`, "info");
          }

          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create loading button state
   */
  setButtonLoading(buttonId, loading = true, loadingText = "Loading...") {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (loading) {
      // Store original state
      button.dataset.originalText = button.textContent;
      button.dataset.originalDisabled = button.disabled;

      // Set loading state
      button.disabled = true;
      button.innerHTML = `
        <span class="inline-flex items-center">
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          ${this.escapeHtml(loadingText)}
        </span>
      `;
      button.classList.add("opacity-75", "cursor-not-allowed");
    } else {
      // Restore original state
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }

      if (button.dataset.originalDisabled !== undefined) {
        button.disabled = button.dataset.originalDisabled === "true";
        delete button.dataset.originalDisabled;
      }

      button.classList.remove("opacity-75", "cursor-not-allowed");
    }
  }
}

// Export for use
if (typeof window !== "undefined") {
  window.LoadingManager = LoadingManager;
}
