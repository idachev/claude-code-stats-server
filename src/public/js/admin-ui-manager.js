/**
 * AdminUIManager - Main UI controller for admin dashboard
 */
// biome-ignore lint/correctness/noUnusedVariables: This class is used in admin.ejs via script tag
class AdminUIManager {
  constructor() {
    this.api = new AdminApiClient();
    this.isLoading = false;
    this.currentPage = 1;
    this.pageLimit = 10;
    this.sortBy = "createdAt";
    this.sortOrder = "desc";
    this.searchTerm = "";
    this.selectedTags = [];
    this.needsUserRefresh = false;
    this.availableTags = new Set();

    // Initialize after constructor
    this.init();
  }

  /**
   * Initialize UI manager
   */
  async init() {
    await this.setupEventListeners();
    await this.loadInitialData();
  }

  /**
   * Set up all event listeners
   */
  async setupEventListeners() {
    // API Key modal buttons
    const copyApiKeyBtn = document.getElementById("copyApiKeyBtn");
    const closeApiKeyBtn = document.getElementById("closeApiKeyBtn");

    if (copyApiKeyBtn) {
      copyApiKeyBtn.addEventListener("click", () => this.copyApiKey());
    }

    if (closeApiKeyBtn) {
      closeApiKeyBtn.addEventListener("click", () => this.closeApiKeyModal());
    }

    // Create user modal buttons
    const cancelCreateBtn = document.getElementById("cancel-create-user-btn");
    if (cancelCreateBtn) {
      cancelCreateBtn.addEventListener("click", () => this.closeCreateUserModal());
    }

    // Manage tags modal buttons
    const cancelTagsBtn = document.getElementById("cancel-tags-btn");
    if (cancelTagsBtn) {
      cancelTagsBtn.addEventListener("click", () => this.closeManageTagsModal());
    }

    // Event delegation for dynamic elements
    document.addEventListener("click", async (e) => {
      // Handle user action buttons (manage tags, regenerate key, deactivate)
      const actionBtn = e.target.closest(".user-action-btn");
      if (actionBtn) {
        // Prevent event from bubbling and being handled multiple times
        e.stopPropagation();
        e.preventDefault();

        const action = actionBtn.dataset.action;
        const username = actionBtn.dataset.username;

        switch (action) {
          case "manage-tags":
            await this.showManageTagsModal(username);
            break;
          case "regenerate-key":
            await this.handleRegenerateApiKey(username);
            break;
          case "deactivate":
            await this.handleDeactivateUser(username);
            break;
        }
        return;
      }

      // Handle pagination buttons
      const pageBtn = e.target.closest(".pagination-btn");
      if (pageBtn) {
        const page = parseInt(pageBtn.dataset.page);
        if (!Number.isNaN(page)) {
          this.changePage(page);
        }
      }

      // Handle retry button
      const retryBtn = e.target.closest(".retry-btn");
      if (retryBtn) {
        const retryFunc = retryBtn.dataset.retry;
        if (retryFunc && typeof this[retryFunc] === "function") {
          this[retryFunc]();
        }
      }
    });

    // Tag filter
    const tagFilter = document.getElementById("tag-filter");
    if (tagFilter) {
      tagFilter.addEventListener("change", (e) => {
        const selectedTag = e.target.value;
        if (selectedTag && !this.selectedTags.includes(selectedTag)) {
          this.selectedTags = selectedTag ? [selectedTag] : [];
          this.currentPage = 1;
          this.loadUsers();
        }
      });
    }

    // Create user form
    const createUserForm = document.getElementById("createUserForm");
    if (createUserForm) {
      createUserForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleCreateUser();
      });
    }

    // Manage tags form
    const manageTagsForm = document.getElementById("manageTagsForm");
    if (manageTagsForm) {
      manageTagsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleUpdateTags();
      });
    }

    // Logout button
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.handleLogout());
    }

    // Create user button
    const createUserBtn = document.getElementById("create-user-btn");
    if (createUserBtn) {
      createUserBtn.addEventListener("click", () => this.showCreateUserModal());
    }

    // Confirmation modal buttons
    const confirmBtn = document.getElementById("confirmationConfirmBtn");
    const cancelConfirmBtn = document.getElementById("confirmationCancelBtn");

    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => this.resolveConfirmation(true));
    }

    if (cancelConfirmBtn) {
      cancelConfirmBtn.addEventListener("click", () => this.resolveConfirmation(false));
    }
  }

  /**
   * Load initial data on page load
   */
  async loadInitialData() {
    await this.loadUsers();
    this.updateAvailableTags();
  }

  /**
   * Show loading indicator
   */
  showLoading() {
    const indicator = document.getElementById("loading-indicator");
    if (indicator) {
      indicator.classList.remove("hidden");
    }
    this.isLoading = true;
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const indicator = document.getElementById("loading-indicator");
    if (indicator) {
      indicator.classList.add("hidden");
    }
    this.isLoading = false;
  }

  /**
   * Load users with current filters and pagination
   */
  async loadUsers() {
    // Don't reload if already loading
    if (this.isLoading) return;

    this.showLoading();

    try {
      const params = {
        page: this.currentPage,
        limit: this.pageLimit,
        sortBy: this.sortBy,
        order: this.sortOrder,
      };

      if (this.searchTerm) {
        params.search = this.searchTerm;
      }

      if (this.selectedTags.length > 0) {
        params.tags = this.selectedTags;
      }

      const response = await this.api.getUsers(params);
      this.renderUsersTable(response.users);
      this.renderPagination(response.pagination);
      this.updateAvailableTags();
    } catch (error) {
      this.showError(`Failed to load users: ${error.message}`);
      // Show empty state on error
      const tbody = document.querySelector("#users-table tbody");
      if (tbody) {
        tbody.innerHTML = `
					<tr>
						<td colspan="5" class="px-6 py-8 text-center">
							<div class="text-red-400">
								<p class="mb-2">Failed to load users</p>
								<button class="retry-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
									data-retry="loadUsers">
									Try Again
								</button>
							</div>
						</td>
					</tr>
				`;
      }
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Render users table
   */
  renderUsersTable(users) {
    const tbody = document.querySelector("#users-table tbody");
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = `
				<tr>
					<td colspan="5" class="px-6 py-8 text-center text-gray-500">
						No users found
					</td>
				</tr>
			`;
      return;
    }

    tbody.innerHTML = users
      .map(
        (user) => `
			<tr class="hover:bg-dark-bg transition-colors">
				<td class="px-6 py-4 text-sm text-gray-300">${user.id}</td>
				<td class="px-6 py-4 text-sm font-medium text-gray-100">${this.escapeHtml(user.username)}</td>
				<td class="px-6 py-4">
					<div class="flex flex-wrap gap-1">
						${user.tags
              .map(
                (tag) => `
							<span class="px-2 py-1 text-xs rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/30">
								${this.escapeHtml(tag)}
							</span>
						`,
              )
              .join("")}
					</div>
				</td>
				<td class="px-6 py-4 text-sm text-gray-400">${this.formatDate(user.createdAt)}</td>
				<td class="px-6 py-4">
					<div class="flex gap-2">
						<button data-action="manage-tags" data-username="${this.escapeHtml(user.username)}"
							class="user-action-btn text-green-400 hover:text-green-300 transition-colors" title="Manage Tags">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
							</svg>
						</button>
						<button data-action="regenerate-key" data-username="${this.escapeHtml(user.username)}"
							class="user-action-btn text-yellow-400 hover:text-yellow-300 transition-colors" title="Regenerate API Key">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
							</svg>
						</button>
						<button data-action="deactivate" data-username="${this.escapeHtml(user.username)}"
							class="user-action-btn text-red-400 hover:text-red-300 transition-colors" title="Deactivate User">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
							</svg>
						</button>
					</div>
				</td>
			</tr>
		`,
      )
      .join("");
  }

  /**
   * Render pagination controls
   */
  renderPagination(pagination) {
    const container = document.getElementById("pagination-controls");
    if (!container) return;

    if (pagination.totalPages <= 1) {
      container.innerHTML = "";
      return;
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

    container.innerHTML = html;
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
   * Change page
   */
  changePage(page) {
    this.currentPage = page;
    this.loadUsers();
  }

  /**
   * Handle creating a new user
   */
  async handleCreateUser() {
    const usernameInput = document.getElementById("newUsername");
    const tagsInput = document.getElementById("newUserTags");

    if (!usernameInput) return;

    const username = usernameInput.value.trim();
    const tags = tagsInput
      ? tagsInput.value
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t)
      : [];

    if (!username) {
      this.showError("Username is required");
      return;
    }

    try {
      const response = await this.api.createUser({ username, tags });
      this.showSuccess(`User '${username}' created successfully`);
      this.needsUserRefresh = true; // Mark that users need to be refreshed
      this.showApiKeyModal(response.apiKey);
      this.closeCreateUserModal();
    } catch (error) {
      this.showError(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Show create user modal
   */
  showCreateUserModal() {
    const modal = document.getElementById("createUserModal");
    if (modal) {
      modal.classList.remove("hidden");
      // Reset form
      const form = document.getElementById("createUserForm");
      if (form) {
        form.reset();
      }
      // Focus on username input
      const usernameInput = document.getElementById("newUsername");
      if (usernameInput) {
        setTimeout(() => usernameInput.focus(), 100);
      }
    }
  }

  /**
   * Close create user modal
   */
  closeCreateUserModal() {
    const modal = document.getElementById("createUserModal");
    if (modal) {
      modal.classList.add("hidden");
    }
  }

  /**
   * Show API key modal
   */
  showApiKeyModal(apiKey) {
    const modal = document.getElementById("apiKeyModal");
    const display = document.getElementById("apiKeyDisplay");

    if (modal && display) {
      display.textContent = apiKey;
      modal.classList.remove("hidden");
    }
  }

  /**
   * Close API key modal and refresh users if needed
   */
  async closeApiKeyModal() {
    const modal = document.getElementById("apiKeyModal");
    if (modal) {
      modal.classList.add("hidden");
    }

    // Always refresh users after closing API key modal
    // This covers both create user and regenerate key scenarios
    if (this.needsUserRefresh) {
      this.needsUserRefresh = false;
      await this.loadUsers();
    }
  }

  /**
   * Copy API key to clipboard
   */
  async copyApiKey() {
    const display = document.getElementById("apiKeyDisplay");
    const btn = document.getElementById("copyApiKeyBtn");

    if (display && btn) {
      try {
        await navigator.clipboard.writeText(display.textContent);
        const originalText = btn.textContent;
        btn.textContent = "Copied!";
        btn.classList.add("bg-green-600");

        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove("bg-green-600");
        }, 2000);
      } catch (_error) {
        this.showError("Failed to copy to clipboard");
      }
    }
  }

  /**
   * Handle regenerating API key
   */
  async handleRegenerateApiKey(username) {
    const confirmed = await this.showConfirmation(
      "Regenerate API Key",
      `Regenerate API key for user '${username}'? The old key will be invalidated.`,
      "Regenerate",
      "warning",
    );

    if (!confirmed) return;

    try {
      const response = await this.api.regenerateApiKey(username);
      this.showSuccess(`API key regenerated for '${username}'`);
      this.needsUserRefresh = true; // Refresh to show updated timestamp
      this.showApiKeyModal(response.apiKey);
    } catch (error) {
      this.showError(`Failed to regenerate API key: ${error.message}`);
    }
  }

  /**
   * Handle deactivating a user
   */
  async handleDeactivateUser(username) {
    const confirmed = await this.showConfirmation(
      "Deactivate User",
      `Deactivate user '${username}'? Their API key will be invalidated and they will no longer be able to access the system.`,
      "Deactivate",
      "danger",
    );

    if (!confirmed) return;

    try {
      await this.api.deactivateUser(username);
      this.showSuccess(`User ${username} has been deactivated`);
      await this.loadUsers();
    } catch (error) {
      this.showError(`Failed to deactivate user: ${error.message}`);
    }
  }

  /**
   * Show manage tags modal
   */
  async showManageTagsModal(username) {
    const modal = document.getElementById("manageTagsModal");
    const usernameSpan = document.getElementById("tagModalUsername");
    const currentTagsList = document.getElementById("currentTagsList");
    const tagsInput = document.getElementById("updatedTags");

    if (!modal || !usernameSpan || !currentTagsList || !tagsInput) return;

    // Store username in dataset for later use
    modal.dataset.username = username;
    usernameSpan.textContent = username;

    try {
      const response = await this.api.getUser(username);
      // The API might return the user directly or wrapped in a user property
      const user = response.user || response;

      // Display current tags
      if (user.tags && user.tags.length > 0) {
        currentTagsList.innerHTML = user.tags
          .map(
            (tag) => `
					<span class="px-2 py-1 text-xs rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/30">
						${this.escapeHtml(tag)}
					</span>
				`,
          )
          .join("");
      } else {
        currentTagsList.innerHTML = '<span class="text-gray-500">No tags</span>';
      }

      // Populate input with current tags
      tagsInput.value = user.tags ? user.tags.join(", ") : "";

      // Show modal
      modal.classList.remove("hidden");

      // Focus on input
      setTimeout(() => tagsInput.focus(), 100);
    } catch (error) {
      this.showError(`Failed to load user details: ${error.message}`);
    }
  }

  /**
   * Close manage tags modal
   */
  closeManageTagsModal() {
    const modal = document.getElementById("manageTagsModal");
    if (modal) {
      modal.classList.add("hidden");
      delete modal.dataset.username;
    }
  }

  /**
   * Handle updating user tags
   */
  async handleUpdateTags() {
    const modal = document.getElementById("manageTagsModal");
    const updatedTagsInput = document.getElementById("updatedTags");

    if (!modal || !updatedTagsInput) return;

    const username = modal.dataset.username;
    const tags = updatedTagsInput.value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);

    try {
      await this.api.updateUserTags(username, tags);
      this.showSuccess(`Tags updated for ${username}`);
      this.closeManageTagsModal();
      await this.loadUsers();
    } catch (error) {
      this.showError(`Failed to update tags: ${error.message}`);
    }
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    try {
      await this.api.logout();
      window.location.href = "/dashboard";
    } catch (error) {
      this.showError(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Update available tags for filter
   */
  updateAvailableTags() {
    // This would normally fetch tags from the server
    // For now, we'll collect them from the current users
    const tbody = document.querySelector("#users-table tbody");
    if (!tbody) return;

    const tagElements = tbody.querySelectorAll(".bg-blue-600\\/20");
    const tags = new Set();

    tagElements.forEach((el) => {
      const tag = el.textContent.trim();
      if (tag) tags.add(tag);
    });

    this.availableTags = tags;
  }

  /**
   * Show confirmation dialog
   */
  showConfirmation(title, message, confirmText = "Confirm", type = "danger") {
    return new Promise((resolve) => {
      const modal = document.getElementById("confirmationModal");
      const titleEl = document.getElementById("confirmationTitle");
      const messageEl = document.getElementById("confirmationMessage");
      const confirmBtn = document.getElementById("confirmationConfirmBtn");

      if (!modal || !titleEl || !messageEl || !confirmBtn) {
        // Fallback to native confirm
        resolve(window.confirm(message));
        return;
      }

      // Set content
      titleEl.textContent = title;
      messageEl.textContent = message;
      confirmBtn.textContent = confirmText;

      // Set button color based on type
      confirmBtn.className = "px-4 py-2 text-white rounded transition-colors ";
      if (type === "danger") {
        confirmBtn.className += "bg-red-600 hover:bg-red-700";
      } else if (type === "warning") {
        confirmBtn.className += "bg-yellow-600 hover:bg-yellow-700";
      } else {
        confirmBtn.className += "bg-blue-600 hover:bg-blue-700";
      }

      // Store resolve function for later use
      this.confirmationResolve = resolve;

      // Show modal
      modal.classList.remove("hidden");
    });
  }

  /**
   * Resolve confirmation dialog
   */
  resolveConfirmation(confirmed) {
    const modal = document.getElementById("confirmationModal");
    if (modal) {
      modal.classList.add("hidden");
    }

    if (this.confirmationResolve) {
      this.confirmationResolve(confirmed);
      this.confirmationResolve = null;
    }
  }

  /**
   * Show success toast
   */
  showSuccess(message) {
    this.showToast(message, "success");
  }

  /**
   * Show error toast
   */
  showError(message) {
    this.showToast(message, "error");
  }

  /**
   * Show toast notification
   */
  showToast(message, type = "info") {
    // Remove any existing toasts
    const existingToast = document.querySelector(".toast-notification");
    if (existingToast) {
      existingToast.remove();
    }

    const bgColor = type === "success" ? "bg-green-600" : type === "error" ? "bg-red-600" : "bg-blue-600";

    const toast = document.createElement("div");
    toast.className = `toast-notification fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full z-[70]`;
    toast.innerHTML = `
			<div class="flex items-center gap-3">
				${this.getToastIcon(type)}
				<span>${this.escapeHtml(message)}</span>
			</div>
		`;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove("translate-x-full");
      toast.classList.add("translate-x-0");
    }, 10);

    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove("translate-x-0");
      toast.classList.add("translate-x-full");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Get toast icon based on type
   */
  getToastIcon(type) {
    const icons = {
      success: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>`,
      error: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>`,
      info: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>`,
    };

    return icons[type] || icons.info;
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Note: AdminUIManager is initialized manually in the admin.ejs file
// to avoid duplicate instances and duplicate event handlers
