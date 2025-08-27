/**
 * Tag Color Configuration
 *
 * Browser-only module for tag colors used in the admin dashboard.
 * Uses the same color palette as the main dashboard charts for consistency.
 */

// Create global TagColors object
window.TagColors = (() => {
  // Color palette matching the main dashboard chart colors
  const TAG_COLOR_PALETTE = [
    { bg: "bg-blue-600/20", text: "text-blue-400", border: "border-blue-600/30" }, // blue
    { bg: "bg-purple-600/20", text: "text-purple-400", border: "border-purple-600/30" }, // purple
    { bg: "bg-green-600/20", text: "text-green-400", border: "border-green-600/30" }, // green
    { bg: "bg-red-600/20", text: "text-red-400", border: "border-red-600/30" }, // red
    { bg: "bg-amber-600/20", text: "text-amber-400", border: "border-amber-600/30" }, // amber
    { bg: "bg-orange-600/20", text: "text-orange-400", border: "border-orange-600/30" }, // orange
    { bg: "bg-pink-600/20", text: "text-pink-400", border: "border-pink-600/30" }, // pink
    { bg: "bg-slate-600/20", text: "text-slate-400", border: "border-slate-600/30" }, // slate
  ];

  /**
   * Get consistent color for a tag based on its name
   * @param {string} tag - The tag name
   * @returns {Object} Color object with bg, text, and border properties
   */
  function getTagColor(tag) {
    // Simple hash function to deterministically assign colors
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % TAG_COLOR_PALETTE.length;
    return TAG_COLOR_PALETTE[index];
  }

  /**
   * Create a tag HTML element with proper coloring
   * @param {string} tag - The tag name
   * @param {Function} escapeHtml - Optional HTML escape function
   * @returns {string} HTML string for the tag element
   */
  function createTagElement(tag, escapeHtml) {
    const color = getTagColor(tag);
    const escapedTag = escapeHtml ? escapeHtml(tag) : tag;
    return `<span class="inline-flex items-center px-2 py-1 text-xs rounded-full ${color.bg} ${color.text} border ${color.border}">${escapedTag}</span>`;
  }

  // Public API
  return {
    getTagColor,
    createTagElement,
    getAllColors: () => [...TAG_COLOR_PALETTE],
    PALETTE: TAG_COLOR_PALETTE,
  };
})();
