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
      loadingState: null,
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
  }

  /**
   * Render a user row
   */
  renderUserRow(user) {
    const tagsHtml = user.tags
      .map(
        (tag) => `
			<span class="px-2 py-1 text-xs rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/30">
				${this.escapeHtml(tag)}
			</span>
		`,
      )
      .join("");

    return `
			<tr class="hover:bg-dark-bg transition-colors">
				<td class="px-6 py-4 text-sm text-gray-300">${user.id}</td>
				<td class="px-6 py-4 text-sm font-medium text-gray-100">${this.escapeHtml(user.username)}</td>
				<td class="px-6 py-4">
					<div class="flex flex-wrap gap-1">
						${tagsHtml}
					</div>
				</td>
				<td class="px-6 py-4 text-sm text-gray-400">${this.formatDate(user.createdAt)}</td>
				<td class="px-6 py-4">
					${this.renderUserActions(user.username)}
				</td>
			</tr>
		`;
  }

  /**
   * Render user action buttons
   */
  renderUserActions(username) {
    const escapedUsername = this.escapeHtml(username);
    return `
			<div class="flex gap-2">
				<button data-action="manage-tags" data-username="${escapedUsername}"
					class="user-action-btn text-green-400 hover:text-green-300 transition-colors" title="Manage Tags">
					${this.getIcon("tag")}
				</button>
				<button data-action="regenerate-key" data-username="${escapedUsername}"
					class="user-action-btn text-yellow-400 hover:text-yellow-300 transition-colors" title="Regenerate API Key">
					${this.getIcon("key")}
				</button>
				<button data-action="deactivate" data-username="${escapedUsername}"
					class="user-action-btn text-red-400 hover:text-red-300 transition-colors" title="Deactivate User">
					${this.getIcon("ban")}
				</button>
			</div>
		`;
  }

  /**
   * Render pagination controls
   */
  renderPagination(pagination) {
    if (pagination.totalPages <= 1) {
      return "";
    }

    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);

    let html = `
			<div class="flex items-center justify-between">
				<div class="text-sm text-gray-400">
					Showing ${start} to ${end} of ${pagination.total} users
				</div>
				<div class="flex gap-2">
		`;

    // Previous button
    if (pagination.page > 1) {
      html += `
				<button data-page="${pagination.page - 1}"
					class="pagination-btn px-3 py-1 bg-dark-bg border border-dark-border rounded text-gray-300 hover:bg-gray-700 transition-colors">
					Previous
				</button>
			`;
    }

    // Page numbers
    const pageNumbers = this.generatePageNumbers(pagination.page, pagination.totalPages);
    pageNumbers.forEach((p) => {
      if (p === "...") {
        html += '<span class="px-2 text-gray-500">...</span>';
      } else {
        const isActive = p === pagination.page;
        html += `
					<button data-page="${p}"
						class="pagination-btn px-3 py-1 ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-dark-bg border border-dark-border text-gray-300 hover:bg-gray-700"
            }
						rounded transition-colors">
						${p}
					</button>
				`;
      }
    });

    // Next button
    if (pagination.page < pagination.totalPages) {
      html += `
				<button data-page="${pagination.page + 1}"
					class="pagination-btn px-3 py-1 bg-dark-bg border border-dark-border rounded text-gray-300 hover:bg-gray-700 transition-colors">
					Next
				</button>
			`;
    }

    html += `
				</div>
			</div>
		`;

    return html;
  }

  /**
   * Generate page numbers for pagination
   */
  generatePageNumbers(current, total) {
    const pages = [];
    const maxVisible = 7;

    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (current > 3) {
        pages.push("...");
      }

      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 2) {
        pages.push("...");
      }

      pages.push(total);
    }

    return pages;
  }

  /**
   * Render loading state
   */
  renderLoadingState() {
    return `
			<tr>
				<td colspan="5" class="px-6 py-8 text-center">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					<div class="mt-2 text-gray-400">Loading...</div>
				</td>
			</tr>
		`;
  }

  /**
   * Render empty state
   */
  renderEmptyState(message = "No users found") {
    return `
			<tr>
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
