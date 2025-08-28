/**
 * AdminUIManager - Main UI controller for admin dashboard
 */
// biome-ignore lint/correctness/noUnusedVariables: This class is used in admin.ejs via script tag
class AdminUIManager {
  constructor(apiClient, templateLoader, initialPageSize, pageSizes) {
    this.api = apiClient || new AdminApiClient();
    this.templates = templateLoader;
    this.isLoading = false;
    this.loadingTimer = null; // Timer for delayed loading indicator

    // Read initial state from URL parameters
    const urlParams = new URLSearchParams(window.location.search);

    // Page and pageLimit
    this.currentPage = parseInt(urlParams.get("page")) || 1;
    this.pageLimit = parseInt(urlParams.get("pageSize")) || initialPageSize || 20;
    this.pageSizes = pageSizes || [10, 20, 50, 100];

    // Sort parameters
    this.sortBy = urlParams.get("sortBy") || "createdAt";
    this.sortOrder = urlParams.get("sortOrder") || "desc";

    // Search term
    this.searchTerm = urlParams.get("search") || "";

    // Tags - support multiple tag parameters
    this.selectedTags = urlParams.getAll("tag");

    this.needsUserRefresh = false;
    this.availableTags = new Set();

    // Initialize after constructor
    this.init();
  }

  /**
   * Initialize UI manager
   */
  async init() {
    // Set initial values in UI elements from URL parameters
    this.syncUIFromState();

    await this.setupEventListeners();
    await this.loadInitialData();

    // Clean up timers on page unload
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });
  }

  /**
   * Cleanup method to clear timers and prevent memory leaks
   */
  cleanup() {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
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
        const isInactive = actionBtn.dataset.isInactive === "true";

        switch (action) {
          case "manage-tags":
            await this.showManageTagsModal(username);
            break;
          case "regenerate-key":
            await this.handleRegenerateApiKey(username, isInactive);
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

    // Tag filter dropdown (single select)
    const tagFilter = document.getElementById("tag-filter");
    if (tagFilter) {
      tagFilter.addEventListener("change", (e) => {
        const selectedTag = e.target.value;
        // Set selectedTags to array with single tag or empty array for "All Tags"
        this.selectedTags = selectedTag ? [selectedTag] : [];
        this.currentPage = 1;
        this.loadUsers();

        // Also sync with the advanced filter checkboxes
        document.querySelectorAll(".tag-checkbox").forEach((checkbox) => {
          checkbox.checked = this.selectedTags.includes(checkbox.value);
        });
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
    this.isLoading = true;

    // Clear any existing timer
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
    }

    // Only show loading indicator after 1250ms delay
    // This prevents flickering for fast responses
    this.loadingTimer = setTimeout(() => {
      // Only show if still loading
      if (this.isLoading) {
        const indicator = document.getElementById("loading-indicator");
        if (indicator) {
          indicator.classList.remove("hidden");
        }
      }
    }, 1250);
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    this.isLoading = false;

    // Clear the timer if it hasn't fired yet
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }

    // Hide the indicator immediately
    const indicator = document.getElementById("loading-indicator");
    if (indicator) {
      indicator.classList.add("hidden");
    }
  }

  /**
   * Load users with current filters and pagination
   */
  async loadUsers() {
    // Don't reload if already loading
    if (this.isLoading) return;

    // Update URL parameters before loading
    // Pass all current values, let updateURLParameters handle the logic
    this.updateURLParameters({
      page: this.currentPage,
      pageSize: this.pageLimit,
      search: this.searchTerm,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
      tags: this.selectedTags,
    });

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
      tbody.innerHTML = this.templates.renderEmptyState();
      return;
    }

    tbody.innerHTML = users.map((user) => this.templates.renderUserRow(user)).join("");
  }

  /**
   * Render pagination controls
   */
  renderPagination(pagination) {
    const container = document.getElementById("pagination-controls");
    if (!container) return;

    // Add pageSizes to pagination data for template
    const paginationWithSizes = {
      ...pagination,
      pageSizes: this.pageSizes,
    };
    container.innerHTML = this.templates.renderPagination(paginationWithSizes);

    // Add event listener for the new page size selector
    const pageSizeSelector = document.getElementById("page-size-selector");
    if (pageSizeSelector) {
      pageSizeSelector.addEventListener("change", (e) => {
        this.pageLimit = parseInt(e.target.value);
        this.currentPage = 1;
        this.loadUsers();
      });
    }
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

      // Refresh tag dropdown if new tags were added
      if (tags.length > 0) {
        await this.refreshTagDropdown();
      }

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
  async handleRegenerateApiKey(username, isInactive = false) {
    // Different confirmation messages based on user status
    const title = isInactive ? "Activate User & Regenerate API Key" : "Regenerate API Key";
    const message = isInactive
      ? `Activate user '${username}' and regenerate their API key? This will allow them to access the system again with a new key.`
      : `Regenerate API key for user '${username}'? The old key will be invalidated.`;
    const buttonText = isInactive ? "Activate & Regenerate" : "Regenerate";
    const style = isInactive ? "success" : "warning";

    const confirmed = await this.showConfirmation(title, message, buttonText, style);

    if (!confirmed) return;

    try {
      const response = await this.api.regenerateApiKey(username);
      const successMessage = isInactive
        ? `User '${username}' has been activated with a new API key`
        : `API key regenerated for '${username}'`;
      this.showSuccess(successMessage);
      this.needsUserRefresh = true; // Refresh to show updated status
      this.showApiKeyModal(response.apiKey);
    } catch (error) {
      this.showError(`Failed to ${isInactive ? "activate user" : "regenerate API key"}: ${error.message}`);
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

      // Display current tags with colors
      if (user.tags && user.tags.length > 0) {
        currentTagsList.innerHTML = user.tags
          .map((tag) => {
            const color = window.TagColors.getTagColor(tag);

            return `
          <span class="inline-flex items-center px-2.5 py-1 text-xs rounded-full ${color.bg} ${color.text} border ${color.border}">
            ${this.escapeHtml(tag)}
          </span>
        `;
          })
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
   * Update URL query parameters without page reload
   */
  updateURLParameter(param, value) {
    const url = new URL(window.location);
    if (value) {
      url.searchParams.set(param, value);
    } else {
      url.searchParams.delete(param);
    }
    window.history.replaceState({}, "", url);
  }

  /**
   * Update multiple URL parameters at once
   */
  updateURLParameters(params, existingUrl = null) {
    const url = existingUrl || new URL(window.location);

    // Handle each parameter
    Object.entries(params).forEach(([key, value]) => {
      if (key === "tags") {
        // Special handling for tags - remove all and re-add
        url.searchParams.delete("tag");
        // Add new tag parameters only if there are selected tags
        if (Array.isArray(value) && value.length > 0) {
          value.forEach((tag) => url.searchParams.append("tag", tag));
        }
      } else if (value !== null && value !== undefined && value !== "") {
        // Always update the parameter if it has a value
        url.searchParams.set(key, value);
      } else if (url.searchParams.has(key) && value === "") {
        // Keep the parameter but with empty string if it was already there
        url.searchParams.set(key, "");
      }
      // Never delete parameters (except tags handled above)
    });

    window.history.replaceState({}, "", url);
  }

  /**
   * Sync UI elements with current state
   */
  syncUIFromState() {
    // Sync search input
    const searchInput = document.getElementById("search-input");
    if (searchInput && this.searchTerm) {
      searchInput.value = this.searchTerm;
    }

    // Sync sort by
    const sortByEl = document.getElementById("sort-by");
    if (sortByEl) {
      sortByEl.value = this.sortBy;
    }

    // Sync sort order
    const sortOrderEl = document.getElementById("sort-order");
    if (sortOrderEl) {
      sortOrderEl.value = this.sortOrder;
    }

    // Sync tag checkboxes
    if (this.selectedTags.length > 0) {
      document.querySelectorAll(".tag-checkbox-dropdown").forEach((checkbox) => {
        checkbox.checked = this.selectedTags.includes(checkbox.value);
      });

      // Update button text
      const tagButtonText = document.getElementById("tagButtonText");
      if (tagButtonText) {
        const count = this.selectedTags.length;
        tagButtonText.textContent = `${count} tag${count > 1 ? "s" : ""} selected`;
      }

      // Show clear button if tags selected
      const clearTagsSection = document.getElementById("clearTagsSection");
      if (clearTagsSection) {
        clearTagsSection.classList.remove("hidden");
      }
    }
  }

  /**
   * Refresh the tag dropdown with latest tags from server
   */
  async refreshTagDropdown() {
    try {
      const tags = await this.api.getAllTags();
      const tagDropdownMenu = document.getElementById("tagDropdownMenu");

      if (!tagDropdownMenu || !tags) return;

      // Store currently selected tags
      const checkedTags = new Set(
        Array.from(document.querySelectorAll(".tag-checkbox-dropdown:checked")).map((cb) => cb.value),
      );

      // Rebuild the dropdown content
      if (tags.length > 0) {
        let dropdownHTML = '<div class="p-2">';

        tags.forEach((tag) => {
          const isChecked = checkedTags.has(tag) ? "checked" : "";
          const color = window.TagColors.getTagColor(tag);
          dropdownHTML += `
            <label class="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer">
              <input type="checkbox" name="tags" value="${tag}" ${isChecked}
                class="tag-checkbox-dropdown rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 bg-gray-700">
              <span class="tag-label-dropdown text-gray-300 text-sm px-2 py-1 rounded-full ${color.bg} ${color.text} border ${color.border}"
                data-tag="${tag}">${tag}</span>
            </label>
          `;
        });

        dropdownHTML += "</div>";

        // Add clear tags section
        const hasCheckedTags = checkedTags.size > 0;
        dropdownHTML += `
          <div id="clearTagsSection" class="${hasCheckedTags ? "" : "hidden"} p-2 border-t border-dark-border">
            <button type="button" id="clearTagsButton"
              class="w-full px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              Clear all tags
            </button>
          </div>
        `;

        tagDropdownMenu.innerHTML = dropdownHTML;

        // Reattach event listeners to new checkboxes
        this.attachTagCheckboxListeners();
      } else {
        tagDropdownMenu.innerHTML = '<div class="p-3 text-gray-500 text-sm">No tags available</div>';
      }
    } catch (error) {
      console.error("Failed to refresh tags:", error);
    }
  }

  /**
   * Attach event listeners to tag checkboxes (called after rebuilding dropdown)
   */
  attachTagCheckboxListeners() {
    const tagCheckboxes = document.querySelectorAll(".tag-checkbox-dropdown");
    const tagButtonText = document.getElementById("tagButtonText");
    const clearTagsSection = document.getElementById("clearTagsSection");

    tagCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        // Get all checked tags
        const checkedTags = Array.from(document.querySelectorAll(".tag-checkbox-dropdown:checked")).map(
          (cb) => cb.value,
        );

        // Update adminUI state
        this.selectedTags = checkedTags;
        this.currentPage = 1;

        // Update button text
        const checkedCount = checkedTags.length;
        if (checkedCount > 0) {
          tagButtonText.textContent = `${checkedCount} tag${checkedCount > 1 ? "s" : ""} selected`;
          // Show clear button
          if (clearTagsSection) {
            clearTagsSection.classList.remove("hidden");
          }
        } else {
          tagButtonText.textContent = "All Tags";
          // Hide clear button
          if (clearTagsSection) {
            clearTagsSection.classList.add("hidden");
          }
        }

        // Load users with new filter
        this.loadUsers();
      });
    });

    // Handle clear tags button
    const clearTagsButton = document.getElementById("clearTagsButton");
    if (clearTagsButton) {
      clearTagsButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Uncheck all tag checkboxes
        tagCheckboxes.forEach((checkbox) => {
          checkbox.checked = false;
        });

        // Clear adminUI state
        this.selectedTags = [];
        this.currentPage = 1;

        // Update button text
        tagButtonText.textContent = "All Tags";

        // Hide clear button
        if (clearTagsSection) {
          clearTagsSection.classList.add("hidden");
        }

        // Reload users
        this.loadUsers();
      });
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

      // Refresh tag dropdown with new tags
      await this.refreshTagDropdown();

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
