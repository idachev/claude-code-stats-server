/**
 * AdminApiClient - Handles all API communications for the admin dashboard
 *
 * Features:
 * - Centralized API communication
 * - Automatic CSRF token handling
 * - Error handling and retry logic
 * - Response formatting
 */
class AdminApiClient {
  constructor() {
    // Use absolute URL to avoid issues with credentials in the browser URL
    const origin = window.location.origin.replace(/\/\/[^:]+:[^@]+@/, "//"); // Strip credentials
    this.baseUrl = `${origin}/admin/users`;
    this.csrfToken = this.getCsrfToken();
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "X-CSRF-Token": this.csrfToken,
    };
  }

  /**
   * Get CSRF token from meta tag
   */
  getCsrfToken() {
    const tokenMeta = document.querySelector('meta[name="csrf-token"]');
    return tokenMeta ? tokenMeta.content : "";
  }

  /**
   * Make a fetch request with common configuration
   */
  async request(url, options = {}) {
    const config = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      credentials: "same-origin",
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return { success: true };
      }

      return await response.json();
    } catch (error) {
      console.error("API Request failed:", error);
      throw error;
    }
  }

  /**
   * Get paginated users with filters
   * @param {Object} params - Query parameters
   * @param {string} params.search - Search term
   * @param {string[]} params.tags - Tags to filter by
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.sortBy - Sort field
   * @param {string} params.order - Sort order (asc/desc)
   */
  async getUsers(params = {}) {
    const queryParams = new URLSearchParams();

    if (params.search) queryParams.append("search", params.search);
    if (params.tags && params.tags.length > 0) {
      params.tags.forEach((tag) => queryParams.append("tags", tag));
    }
    if (params.page) queryParams.append("page", params.page);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params.order) queryParams.append("order", params.order);

    const url = `${this.baseUrl}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return this.request(url, { method: "GET" });
  }

  /**
   * Get a single user by username
   */
  async getUser(username) {
    return this.request(`${this.baseUrl}/${username}`, { method: "GET" });
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @param {string} userData.username - Username
   * @param {string[]} userData.tags - Optional tags
   */
  async createUser(userData) {
    return this.request(this.baseUrl, {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  /**
   * Regenerate API key for a user
   */
  async regenerateApiKey(username) {
    return this.request(`${this.baseUrl}/${username}/api-key/regenerate`, {
      method: "POST",
    });
  }

  /**
   * Check if an API key is valid
   */
  async checkApiKey(username, apiKey) {
    return this.request(`${this.baseUrl}/${username}/api-key/check`, {
      method: "POST",
      body: JSON.stringify({ apiKey }),
    });
  }

  /**
   * Deactivate a user
   */
  async deactivateUser(username) {
    return this.request(`${this.baseUrl}/${username}/deactivate`, {
      method: "POST",
    });
  }

  /**
   * Get tags for a user
   */
  async getUserTags(username) {
    return this.request(`${this.baseUrl}/${username}/tags`, {
      method: "GET",
    });
  }

  /**
   * Add tags to a user
   */
  async addUserTags(username, tags) {
    return this.request(`${this.baseUrl}/${username}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags }),
    });
  }

  /**
   * Replace all tags for a user
   */
  async updateUserTags(username, tags) {
    return this.request(`${this.baseUrl}/${username}/tags`, {
      method: "PUT",
      body: JSON.stringify({ tags }),
    });
  }

  /**
   * Remove a specific tag from a user
   */
  async removeUserTag(username, tagName) {
    return this.request(`${this.baseUrl}/${username}/tags/${encodeURIComponent(tagName)}`, {
      method: "DELETE",
    });
  }

  /**
   * Logout the admin
   */
  async logout() {
    return this.request("/admin/logout", {
      method: "POST",
    });
  }
}

// Export for use in other scripts
if (typeof window !== "undefined") {
  window.AdminApiClient = AdminApiClient;
}
