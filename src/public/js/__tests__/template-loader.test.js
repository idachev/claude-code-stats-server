import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";

describe("TemplateLoader - Pagination", () => {
  let TemplateLoader;

  beforeEach(() => {
    // Set up DOM environment
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "http://localhost",
      pretendToBeVisual: true,
      resources: "usable",
    });

    global.window = dom.window;
    global.document = dom.window.document;
    // Don't set navigator directly, it's read-only

    // Mock TagColors
    global.window.TagColors = {
      getTagColor: () => ({
        bg: "bg-blue-100",
        text: "text-blue-800",
        border: "border-blue-200",
      }),
    };

    // Load the TemplateLoader class
    const templateLoaderCode = fs.readFileSync(path.join(process.cwd(), "src/public/js/template-loader.js"), "utf-8");

    // Extract the class definition and make it available
    // The file defines: class TemplateLoader { ... }
    // We need to execute it in a way that makes the class available
    const wrappedCode = `${templateLoaderCode}\n global.TemplateLoader = TemplateLoader;`;
    // biome-ignore lint/security/noGlobalEval: Required for testing
    eval(wrappedCode);
    TemplateLoader = global.TemplateLoader;
  });

  describe("generatePageNumbers", () => {
    let templateLoader;

    beforeEach(() => {
      templateLoader = new TemplateLoader();
    });

    it("should show all pages when total is 7 or less", () => {
      // Test with exactly 7 pages
      const pages7 = templateLoader.generatePageNumbers(4, 7);
      expect(pages7).toEqual([1, 2, 3, 4, 5, 6, 7]);

      // Test with 5 pages
      const pages5 = templateLoader.generatePageNumbers(3, 5);
      expect(pages5).toEqual([1, 2, 3, 4, 5]);

      // Test with 1 page
      const pages1 = templateLoader.generatePageNumbers(1, 1);
      expect(pages1).toEqual([1]);
    });

    it("should show ellipsis only when total pages > 7", () => {
      // With 8 pages, should show ellipsis
      const pages8 = templateLoader.generatePageNumbers(5, 8);
      expect(pages8).toContain("...");

      // With 7 pages, should NOT show ellipsis
      const pages7 = templateLoader.generatePageNumbers(4, 7);
      expect(pages7).not.toContain("...");
    });

    it("should show adaptive edge pages based on current position", () => {
      // When in the middle, show current with neighbors
      const pagesMiddle = templateLoader.generatePageNumbers(8, 15);
      expect(pagesMiddle.join(" ")).toBe("1 ... 7 8 9 ... 15");

      // When at the beginning (page 1), show 1, 2, and last page
      const pagesStart = templateLoader.generatePageNumbers(1, 15);
      expect(pagesStart.join(" ")).toBe("1 2 ... 15");

      // When at the end (last page), show first page with ellipsis then last 2
      const pagesEnd = templateLoader.generatePageNumbers(15, 15);
      expect(pagesEnd.join(" ")).toBe("1 ... 14 15");
    });

    it("should follow the requested pattern for 11 pages", () => {
      // With 11 pages, current page 1: shows 1, 2, then ellipsis, then 11
      const pages1 = templateLoader.generatePageNumbers(1, 11);
      expect(pages1.join(" ")).toBe("1 2 ... 11");

      // With 11 pages, current page 2: shows 1, 2, 3, then ellipsis, then 11
      const pages2 = templateLoader.generatePageNumbers(2, 11);
      expect(pages2.join(" ")).toBe("1 2 3 ... 11");

      // With 11 pages, current page 10: shows 1, ellipsis, then 9, 10, 11
      const pages10 = templateLoader.generatePageNumbers(10, 11);
      expect(pages10.join(" ")).toBe("1 ... 9 10 11");

      // With 11 pages, current page 11: shows 1, ellipsis, then 10, 11
      const pages11 = templateLoader.generatePageNumbers(11, 11);
      expect(pages11.join(" ")).toBe("1 ... 10 11");

      // With 11 pages, current page 6: shows 1, ellipsis, 5, 6, 7, ellipsis, 11
      const pages6 = templateLoader.generatePageNumbers(6, 11);
      expect(pages6.join(" ")).toBe("1 ... 5 6 7 ... 11");
    });

    it("should show current page with neighbors", () => {
      // Current page 5 out of 15
      const pages = templateLoader.generatePageNumbers(5, 15);
      const pagesStr = pages.join(" ");
      expect(pagesStr).toBe("1 ... 4 5 6 ... 15");

      // Current page 10 out of 20
      const pages2 = templateLoader.generatePageNumbers(10, 20);
      const pagesStr2 = pages2.join(" ");
      expect(pagesStr2).toBe("1 ... 9 10 11 ... 20");
    });

    it("should show left ellipsis when there is a gap", () => {
      // Current page 3 out of 15 - no left ellipsis (current <= 3)
      const pages3 = templateLoader.generatePageNumbers(3, 15);
      const pagesStr3 = pages3.join(" ");
      expect(pagesStr3).toBe("1 2 3 4 ... 15");

      // Current page 4 out of 15 - should have left ellipsis (current > 3)
      const pages4 = templateLoader.generatePageNumbers(4, 15);
      const pagesStr4 = pages4.join(" ");
      expect(pagesStr4).toBe("1 ... 3 4 5 ... 15");

      // Current page 5 out of 15 - should have left ellipsis
      const pages5 = templateLoader.generatePageNumbers(5, 15);
      const pagesStr5 = pages5.join(" ");
      expect(pagesStr5).toBe("1 ... 4 5 6 ... 15");
    });

    it("should show right ellipsis when there is a gap", () => {
      // Current page 13 out of 15 - no right ellipsis (current >= total - 2)
      const pages13 = templateLoader.generatePageNumbers(13, 15);
      const pagesStr13 = pages13.join(" ");
      expect(pagesStr13).toBe("1 ... 12 13 14 15");

      // Current page 12 out of 15 - should have right ellipsis (current < total - 2)
      const pages12 = templateLoader.generatePageNumbers(12, 15);
      const pagesStr12 = pages12.join(" ");
      expect(pagesStr12).toBe("1 ... 11 12 13 ... 15");

      // Current page 11 out of 15 - should have right ellipsis
      const pages11 = templateLoader.generatePageNumbers(11, 15);
      const pagesStr11 = pages11.join(" ");
      expect(pagesStr11).toBe("1 ... 10 11 12 ... 15");
    });

    it("should handle edge cases at the beginning", () => {
      // Current page 1 out of 15 - show 1, 2, ellipsis, last page
      const pages = templateLoader.generatePageNumbers(1, 15);
      const pagesStr = pages.join(" ");
      expect(pagesStr).toBe("1 2 ... 15");

      // Current page 2 out of 15 - show 1, 2, 3, ellipsis, last page
      const pages2 = templateLoader.generatePageNumbers(2, 15);
      const pagesStr2 = pages2.join(" ");
      expect(pagesStr2).toBe("1 2 3 ... 15");
    });

    it("should handle edge cases at the end", () => {
      // Current page 15 out of 15 - show first page, ellipsis, 14, 15
      const pages = templateLoader.generatePageNumbers(15, 15);
      const pagesStr = pages.join(" ");
      expect(pagesStr).toBe("1 ... 14 15");

      // Current page 14 out of 15 - show first page, ellipsis, 13, 14, 15
      const pages2 = templateLoader.generatePageNumbers(14, 15);
      const pagesStr2 = pages2.join(" ");
      expect(pagesStr2).toBe("1 ... 13 14 15");
    });

    it("should handle very large page counts", () => {
      // Current page 50 out of 100 - middle position
      const pages = templateLoader.generatePageNumbers(50, 100);
      const pagesStr = pages.join(" ");
      expect(pagesStr).toBe("1 ... 49 50 51 ... 100");

      // Current page 1 out of 100 - show 1, 2, ellipsis, last page
      const pages1 = templateLoader.generatePageNumbers(1, 100);
      const pagesStr1 = pages1.join(" ");
      expect(pagesStr1).toBe("1 2 ... 100");

      // Current page 100 out of 100 - show first page, ellipsis, 99, 100
      const pages100 = templateLoader.generatePageNumbers(100, 100);
      const pagesStr100 = pages100.join(" ");
      expect(pagesStr100).toBe("1 ... 99 100");
    });

    it("should never have duplicate page numbers", () => {
      // Test various scenarios to ensure no duplicates
      const testCases = [
        { current: 3, total: 15 },
        { current: 4, total: 15 },
        { current: 12, total: 15 },
        { current: 13, total: 15 },
        { current: 1, total: 20 },
        { current: 20, total: 20 },
      ];

      testCases.forEach(({ current, total }) => {
        const pages = templateLoader.generatePageNumbers(current, total);
        const numbers = pages.filter((p) => p !== "...");
        const uniqueNumbers = [...new Set(numbers)];

        expect(numbers.length).toBe(uniqueNumbers.length);

        // Also check that numbers are in ascending order
        for (let i = 1; i < numbers.length; i++) {
          expect(numbers[i]).toBeGreaterThan(numbers[i - 1]);
        }
      });
    });
  });

  describe("renderNavigationButton", () => {
    let templateLoader;

    beforeEach(() => {
      templateLoader = new TemplateLoader();
    });

    it("should render enabled navigation button correctly", () => {
      const html = templateLoader.renderNavigationButton({
        page: 5,
        title: "Next page",
        iconPath: "M9 5l7 7-7 7",
        disabled: false,
      });

      expect(html).toContain('data-page="5"');
      expect(html).toContain('title="Next page"');
      expect(html).toContain('d="M9 5l7 7-7 7"');
      expect(html).toContain("pagination-btn");
      expect(html).not.toContain("disabled");
      expect(html).toContain("hover:bg-gray-700");
    });

    it("should render disabled navigation button correctly", () => {
      const html = templateLoader.renderNavigationButton({
        page: null,
        title: "Previous page",
        iconPath: "M15 19l-7-7 7-7",
        disabled: true,
      });

      expect(html).toContain("disabled");
      expect(html).toContain('title="Previous page"');
      expect(html).toContain('d="M15 19l-7-7 7-7"');
      expect(html).toContain("cursor-not-allowed");
      expect(html).toContain("opacity-50");
      expect(html).not.toContain("data-page");
    });
  });

  describe("renderPagination", () => {
    let templateLoader;

    beforeEach(() => {
      templateLoader = new TemplateLoader();
    });

    it("should always show navigation arrows even with single page", () => {
      const pagination = {
        page: 1,
        totalPages: 1,
        total: 5,
        limit: 10,
        pageSizes: [10, 20, 50, 100],
      };

      const html = templateLoader.renderPagination(pagination);

      // Check that all navigation buttons are present
      expect(html).toContain('title="First page"');
      expect(html).toContain('title="Previous page"');
      expect(html).toContain('title="Next page"');
      expect(html).toContain('title="Last page"');

      // Check that page size selector is present
      expect(html).toContain('id="page-size-selector"');

      // Verify the disabled state for navigation at first page
      expect(html).toMatch(/disabled[^>]*title="First page"/);
      expect(html).toMatch(/disabled[^>]*title="Previous page"/);
      expect(html).toMatch(/disabled[^>]*title="Next page"/);
      expect(html).toMatch(/disabled[^>]*title="Last page"/);
    });

    it("should show navigation arrows with multiple pages", () => {
      const pagination = {
        page: 3,
        totalPages: 10,
        total: 100,
        limit: 10,
        pageSizes: [10, 20, 50, 100],
      };

      const html = templateLoader.renderPagination(pagination);

      // Check that all navigation buttons are present
      expect(html).toContain('title="First page"');
      expect(html).toContain('title="Previous page"');
      expect(html).toContain('title="Next page"');
      expect(html).toContain('title="Last page"');

      // Verify enabled/disabled states for middle page
      expect(html).not.toMatch(/disabled[^>]*title="First page"/);
      expect(html).not.toMatch(/disabled[^>]*title="Previous page"/);
      expect(html).not.toMatch(/disabled[^>]*title="Next page"/);
      expect(html).not.toMatch(/disabled[^>]*title="Last page"/);

      // Check for page buttons with data attributes
      expect(html).toContain('data-page="1"');
      expect(html).toContain('data-page="2"');
    });

    it("should return empty string when there are no results", () => {
      const pagination = {
        page: 1,
        totalPages: 0,
        total: 0,
        limit: 10,
        pageSizes: [10, 20, 50, 100],
      };

      const html = templateLoader.renderPagination(pagination);
      expect(html).toBe("");
    });
  });

  describe("renderPageNumberButton", () => {
    let templateLoader;

    beforeEach(() => {
      templateLoader = new TemplateLoader();
    });

    it("should render active page number button", () => {
      const html = templateLoader.renderPageNumberButton(5, true);

      expect(html).toContain('data-page="5"');
      // Check for the number with flexible whitespace
      expect(html).toMatch(/>\s*5\s*</);
      expect(html).toContain("bg-blue-600");
      expect(html).toContain("text-white");
      expect(html).not.toContain("hover:bg-gray-700");
    });

    it("should render inactive page number button", () => {
      const html = templateLoader.renderPageNumberButton(3, false);

      expect(html).toContain('data-page="3"');
      // Check for the number with flexible whitespace
      expect(html).toMatch(/>\s*3\s*</);
      expect(html).toContain("bg-dark-bg");
      expect(html).toContain("border-dark-border");
      expect(html).toContain("hover:bg-gray-700");
      expect(html).not.toContain("bg-blue-600");
    });
  });
});
