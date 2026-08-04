// Optional Sentry — set SENTRY_DSN to enable in production.
// Full @sentry/nextjs wizard can replace this later.
export function initSentry() {
  if (!process.env.SENTRY_DSN) return;
  // Dynamic import avoided at build time; wire in instrumentation.ts when ready.
  console.info("[sentry] DSN present — configure @sentry/nextjs instrumentation for full capture");
}
