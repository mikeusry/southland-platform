# Southland AI Worker

Shared search, classification, and knowledge-index worker.

## Deploy

Production deploys run from GitHub `main` through [`.github/workflows/deploy-ai-worker.yml`](../../.github/workflows/deploy-ai-worker.yml).

The workflow starts on:

- a push to `main` that changes `apps/southland-ai-worker/**`
- `workflow_dispatch` when the selected branch is `main`

A dispatch from any other ref stops before checkout. The job checks out the repo, sets up pnpm and Node.js with the same actions as the Pages workflow, installs with `pnpm install --frozen-lockfile`, runs vitest and `tsc --noEmit` in this directory, then deploys:

```sh
wrangler deploy --env production
```

`--env production` selects the `[env.production]` block in `wrangler.toml`. Bindings on that block are declared there; they are not inherited from the top of the file.

Node.js is 22 because `src/product-reindex.test.ts` imports `node:sqlite`. Node 20, used by the Pages deploy, does not include that module. Wrangler on this job is the copy in this package (`pnpm exec wrangler`).

### GitHub Actions secrets

Set these once in the repo under Settings → Secrets and variables → Actions. They are the point-dog Cloudflare account (`account_id` in `wrangler.toml`: `07f1d3224d68222be7b6f97190608b80`). They are separate from the Pages secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

| GitHub secret | Wrangler variable |
| --- | --- |
| `CLOUDFLARE_API_TOKEN_AI_WORKER` | `CLOUDFLARE_API_TOKEN` |
| `CLOUDFLARE_ACCOUNT_ID_AI_WORKER` | `CLOUDFLARE_ACCOUNT_ID` |

The API token needs to deploy this worker on that account (Workers script plus the AI, Vectorize, D1, Queues, and KV bindings in `wrangler.toml`). The workflow exits with an error before install if either secret is missing.

## Index admin secret

Every `/index/*` route, including `/index/products`, `/index/sops`, and `/index/blog`, requires this header on GET and POST:

```http
Authorization: Bearer <INDEX_ADMIN_SECRET>
```

`INDEX_ADMIN_SECRET` is a worker secret. Set it once by hand in Cloudflare, for the default worker and for `[env.production]`, before the first production deploy:

```sh
wrangler secret put INDEX_ADMIN_SECRET
wrangler secret put INDEX_ADMIN_SECRET --env production
```

Run those from this directory. The GitHub workflow deploys with `--env production` and does not pass `INDEX_ADMIN_SECRET`. A later deploy leaves the Cloudflare secret in place.

If the secret is unset or blank, those routes fail closed with HTTP 503. Do not commit the value.

`scripts/seed-products.ts` and `scripts/index-blog.ts` read `INDEX_ADMIN_SECRET` from the environment and send it as the bearer token. The product feed fetch still uses `NEXUS_API_KEY`.

These worker secrets are also set once with `wrangler secret put <NAME> --env production`, and they are not GitHub Actions secrets: `NEXUS_API_KEY`, `OPENAI_API_KEY`, `COHERE_API_KEY`, `SENDGRID_API_KEY`. See the secrets comment in `wrangler.toml`.

A product reindex skips prune and alias rebuild, and returns `status: "skipped"`, when the feed is empty, when it has fewer than half as many products as the current product manifest, or when an embed batch fails.
