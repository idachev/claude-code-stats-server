import helmet from "helmet";

/**
 * Helmet security configuration with Content Security Policy
 * Configured to allow necessary external resources for the dashboard
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline scripts and Chart.js
        "'unsafe-eval'", // Required for Tailwind CSS runtime
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net",
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline styles from Tailwind
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // Other helmet options can be configured here
  crossOriginEmbedderPolicy: false, // May be needed for some CDN resources
});

export default helmetConfig;
