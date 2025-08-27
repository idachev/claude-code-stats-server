/**
 * TemplateLoader - Manages HTML templates for the admin dashboard
 *
 * This class handles loading and caching of HTML templates,
 * supporting both inline templates (using <template> elements)
 * and dynamic loading via fetch.
 */
class TemplateLoader {
  constructor() {
    this.cache = new Map();
    this.templates = {
      userRow: null,
      pagination: null,
      apiKeyModal: null,
      toast: null,
      emptyState: null,
    };
  }

  /**
   * Initialize templates from DOM or register for dynamic loading
   */
  async init() {
    // Check for inline templates first
    this.loadInlineTemplates();

    // Register template rendering functions
    this.registerTemplateHelpers();

    return this;
  }

  /**
   * Load templates that are already in the DOM
   */
  loadInlineTemplates() {
    // Look for template elements in the DOM
    const toastTemplate = document.getElementById("toastTemplate");
    if (toastTemplate) {
      this.templates.toast = toastTemplate.content;
    }

    // API Key Modal is already in the DOM as a regular element
    const apiKeyModal = document.getElementById("apiKeyModal");
    if (apiKeyModal) {
      this.templates.apiKeyModal = apiKeyModal;
    }
  }

  /**
   * Register template helper functions
   */
  registerTemplateHelpers() {
    // Helper to escape HTML
    this.escapeHtml = (text) => {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    };

    // Helper to format dates
    this.formatDate = (dateString) => {
      return new Date(dateString).toLocaleString();
    };

    // Use centralized tag color configuration
    // TagColors must be loaded from tag-colors.js before this script
    this.getTagColor = (tag) => {
      return window.TagColors.getTagColor(tag);
    };
  }

  /**
   * Render a user row
   */
  renderUserRow(user) {
    const tagsHtml = user.tags
      .map((tag) => {
        const color = this.getTagColor(tag);
        return `
      <span class="inline-flex items-center px-2 py-1 text-xs rounded-full ${color.bg} ${color.text} border ${color.border}">
        ${this.escapeHtml(tag)}
      </span>
    `;
      })
      .join("");

    // Add visual styling for inactive users
    const rowClasses = user.isActive
      ? "hover:bg-dark-bg transition-colors"
      : "hover:bg-dark-bg transition-colors opacity-60";

    const usernameClasses = user.isActive
      ? "text-sm font-medium text-gray-100"
      : "text-sm font-medium text-gray-400 line-through";

    // Add status badge
    const statusBadge = !user.isActive
      ? `<span class="ml-2 inline-flex items-center px-2 py-1 text-xs rounded-full bg-red-900 text-red-300 border border-red-800">Inactive</span>`
      : '';

    return `
      <tr class="${rowClasses}">
        <td class="px-6 py-4 text-sm text-gray-300">${user.id}</td>
        <td class="px-6 py-4">
          <span class="${usernameClasses}">${this.escapeHtml(user.username)}</span>
          ${statusBadge}
        </td>
        <td class="px-6 py-4">
          <div class="flex flex-wrap gap-1">
            ${tagsHtml}
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-gray-400">${this.formatDate(user.createdAt)}</td>
        <td class="px-6 py-4">
          ${this.renderUserActions(user.username, user.isActive)}
        </td>
      </tr>
    `;
  }

  /**
   * Render user action buttons
   */
  renderUserActions(username, isActive = true) {
    const escapedUsername = this.escapeHtml(username);

    // Show different button based on active status
    const keyActionButton = isActive
      ? `
        <button data-action="regenerate-key" data-username="${escapedUsername}"
          class="user-action-btn text-yellow-400 hover:text-yellow-300 transition-colors"
          title="Regenerate API Key">
          ${this.getIcon("key")}
        </button>
      `
      : `
        <button data-action="regenerate-key" data-username="${escapedUsername}" data-is-inactive="true"
          class="user-action-btn text-green-400 hover:text-green-300 transition-colors"
          title="Activate User & Regenerate Key">
          ${this.getIcon("check-circle")}
        </button>
      `;

    // Show deactivate button only for active users
    const deactivateButton = isActive ? `
      <button data-action="deactivate" data-username="${escapedUsername}"
        class="user-action-btn text-red-400 hover:text-red-300 transition-colors" title="Deactivate User">
        ${this.getIcon("ban")}
      </button>
    ` : '';

    return `
      <div class="flex gap-2">
        <button data-action="manage-tags" data-username="${escapedUsername}"
          class="user-action-btn text-green-400 hover:text-green-300 transition-colors" title="Manage Tags">
          ${this.getIcon("tag")}
        </button>
        ${keyActionButton}
        ${deactivateButton}
      </div>
    `;
  }

  /**
   * Render pagination controls
   * @param {Object} pagination - Pagination data including pageSizes array
   */
  renderPagination(pagination) {
    // Generate page size options dynamically from passed data
    const pageSizeOptions = pagination.pageSizes
      .map((size) => `<option value="${size}" ${pagination.limit === size ? "selected" : ""}>${size}</option>`)
      .join("");

    // Return empty if there are no results at all
    if (pagination.total === 0) {
      return "";
    }

    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);

    let html = `
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-400">
          Showing ${start} to ${end} of ${pagination.total} users
        </div>
        <div class="flex items-center gap-3">
          <div class="flex gap-1 items-center">
    `;

    // Page numbers on the left
    const pageNumbers = this.generatePageNumbers(pagination.page, pagination.totalPages);
    pageNumbers.forEach((p) => {
      if (p === "...") {
        html += this.renderPaginationEllipsis();
      } else {
        html += this.renderPageNumberButton(p, p === pagination.page);
      }
    });

    html += `
          </div>
          <div class="flex gap-1 items-center">
    `;

    // Navigation controls on the right
    // First page button - always visible
    html += this.renderNavigationButton({
      page: pagination.page > 1 ? 1 : null,
      title: "First page",
      iconPath: "M11 19l-7-7 7-7m8 14l-7-7 7-7",
      disabled: pagination.page <= 1,
    });

    // Previous button - always visible
    html += this.renderNavigationButton({
      page: pagination.page > 1 ? pagination.page - 1 : null,
      title: "Previous page",
      iconPath: "M15 19l-7-7 7-7",
      disabled: pagination.page <= 1,
    });

    // Page size selector in the middle of navigation
    html += `
            <select id="page-size-selector"
              class="px-3 py-1 h-[30px] mx-1 bg-dark-bg border border-dark-border rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500">
              ${pageSizeOptions}
            </select>
    `;

    // Next button - always visible
    html += this.renderNavigationButton({
      page: pagination.page < pagination.totalPages ? pagination.page + 1 : null,
      title: "Next page",
      iconPath: "M9 5l7 7-7 7",
      disabled: pagination.page >= pagination.totalPages,
    });

    // Last page button - always visible
    html += this.renderNavigationButton({
      page: pagination.page < pagination.totalPages ? pagination.totalPages : null,
      title: "Last page",
      iconPath: "M13 5l7 7-7 7M5 5l7 7-7 7",
      disabled: pagination.page >= pagination.totalPages,
    });

    html += `
          </div>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Render a navigation button (First, Previous, Next, Last)
   * @param {Object} config - Button configuration
   * @param {number|null} config.page - Page number to navigate to (null for disabled)
   * @param {string} config.title - Button title/tooltip
   * @param {string} config.iconPath - SVG path for the icon
   * @param {boolean} config.disabled - Whether the button is disabled
   */
  renderNavigationButton(config) {
    const { page, title, iconPath, disabled = false } = config;

    if (disabled) {
      return `
        <button disabled
          class="px-2 py-1 h-[30px] flex items-center justify-center bg-dark-bg border border-dark-border rounded text-gray-600 cursor-not-allowed opacity-50"
          title="${title}">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
          </svg>
        </button>
      `;
    }

    return `
      <button data-page="${page}"
        class="pagination-btn px-2 py-1 h-[30px] flex items-center justify-center bg-dark-bg border border-dark-border rounded text-gray-300 hover:bg-gray-700 transition-colors"
        title="${title}">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
        </svg>
      </button>
    `;
  }

  /**
   * Render a page number button
   * @param {number} pageNumber - The page number
   * @param {boolean} isActive - Whether this is the current page
   */
  renderPageNumberButton(pageNumber, isActive) {
    return `
      <button data-page="${pageNumber}"
        class="pagination-btn px-3 py-1 h-[30px] flex items-center justify-center ${
          isActive ? "bg-blue-600 text-white" : "bg-dark-bg border border-dark-border text-gray-300 hover:bg-gray-700"
        }
        rounded transition-colors">
        ${pageNumber}
      </button>
    `;
  }

  /**
   * Render a separator for pagination controls
   */
  renderPaginationSeparator() {
    return '<div class="w-px h-6 bg-dark-border mx-1"></div>';
  }

  /**
   * Render ellipsis for page numbers
   */
  renderPaginationEllipsis() {
    return '<span class="px-2 text-gray-500">...</span>';
  }

  /**
   * Generate page numbers for pagination
   * Rules:
   * 1. Always show first and last pages
   * 2. If total > 7, show ellipsis on left if current is not in [1,2,3]
   * 3. If total > 7, show ellipsis on right if current is not in [total-2, total-1, total]
   * 4. Always show current page and its immediate neighbors when possible
   */
  generatePageNumbers(current, total) {
    const pages = [];

    // If 7 or fewer pages, show all
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
      return pages;
    }

    // Always show first page
    pages.push(1);

    // Determine if we need left ellipsis
    // Show left ellipsis if current is not in [1, 2, 3]
    const needLeftEllipsis = current > 3;

    if (needLeftEllipsis) {
      pages.push("...");
    }

    // Add pages around current (current-1, current, current+1)
    // Making sure we don't duplicate pages
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    // Determine if we need right ellipsis
    // Show right ellipsis if current is not in [total-2, total-1, total]
    const needRightEllipsis = current < total - 2;

    if (needRightEllipsis) {
      // Check if there's actually a gap between the last added page and the last page
      const lastAddedPage = pages[pages.length - 1];
      if (typeof lastAddedPage === "number" && lastAddedPage < total - 1) {
        pages.push("...");
      }
    }

    // Always show last page if not already included
    if (!pages.includes(total)) {
      pages.push(total);
    }

    return pages;
  }

  /**
   * Render empty state
   */
  renderEmptyState(message = "No users found") {
    return `
      <tr class="empty-state">
        <td colspan="5" class="px-6 py-4 text-center text-gray-500">
          ${this.escapeHtml(message)}
        </td>
      </tr>
    `;
  }

  /**
   * Create a toast notification
   */
  createToast(message, type = "info") {
    if (this.templates.toast) {
      // Use template element if available
      const clone = this.templates.toast.cloneNode(true);
      const notification = clone.querySelector(".toast-notification");
      const messageEl = clone.querySelector(".toast-message");

      // Set message
      messageEl.textContent = message;

      // Set type-specific styles
      const bgColors = {
        success: "bg-green-600",
        error: "bg-red-600",
        info: "bg-blue-600",
      };
      notification.classList.add(bgColors[type] || bgColors.info);

      // Show appropriate icon
      clone.querySelector(`.${type}-path`)?.classList.remove("hidden");

      return notification;
    } else {
      // Fallback to creating element dynamically
      const bgColor = type === "success" ? "bg-green-600" : type === "error" ? "bg-red-600" : "bg-blue-600";

      const toast = document.createElement("div");
      toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-300 transform`;
      toast.innerHTML = `
        <div class="flex items-center gap-3">
          ${this.getIcon(type)}
          <span>${this.escapeHtml(message)}</span>
        </div>
      `;

      return toast;
    }
  }

  /**
   * Get SVG icon by name
   */
  getIcon(name) {
    const icons = {
      tag: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
        </svg>`,
      key: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
        </svg>`,
      ban: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
        </svg>`,
      "check-circle": `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`,
      success: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`,
      error: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`,
      info: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`,
    };

    return icons[name] || "";
  }
}

// Export for use
if (typeof window !== "undefined") {
  window.TemplateLoader = TemplateLoader;
}
