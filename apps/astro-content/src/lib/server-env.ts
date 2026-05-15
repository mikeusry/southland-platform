/**
 * Server-side env access for Cloudflare Pages + Astro.
 *
 * Cloudflare Pages secrets (set via `wrangler pages secret put`) are exposed
 * to server routes via `Astro.locals.runtime.env` at request time, NOT
 * via `import.meta.env` — which Vite resolves at build time and inlines as
 * undefined for any var not passed to the build environment.
 *
 * This helper reads runtime env first, falls back to import.meta.env for
 * local dev where `.env` is honored by Vite's build.
 *
 * Usage in an Astro page or endpoint:
 *
 *   const apiKey = getServerEnv(Astro.locals, 'KLAVIYO_API_KEY')
 *
 * Usage in an APIRoute (POST/GET handler):
 *
 *   export const POST: APIRoute = async ({ locals }) => {
 *     const apiKey = getServerEnv(locals, 'SENDGRID_API_KEY')
 *   }
 */

type RuntimeLocals = {
  runtime?: { env?: Record<string, string | undefined> }
}

export function getServerEnv(locals: unknown, name: string): string | undefined {
  const runtimeEnv = (locals as RuntimeLocals)?.runtime?.env
  return runtimeEnv?.[name] || (import.meta.env as Record<string, string | undefined>)[name]
}
