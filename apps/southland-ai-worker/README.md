# Southland AI Worker

Shared search, classification, and knowledge-index worker.

## Index admin secret

Every `/index/*` route, including `/index/products`, `/index/sops`, and `/index/blog`, requires this header on GET and POST:

```http
Authorization: Bearer <INDEX_ADMIN_SECRET>
```

`INDEX_ADMIN_SECRET` is a worker secret. Set it before deploying, for both the default worker and the production environment:

```sh
wrangler secret put INDEX_ADMIN_SECRET
wrangler secret put INDEX_ADMIN_SECRET --env production
```

If the secret is unset or blank, those routes fail closed with HTTP 503. Do not commit the value.

`scripts/seed-products.ts` and `scripts/index-blog.ts` read `INDEX_ADMIN_SECRET` from the environment and send it as the bearer token. The product feed fetch still uses `NEXUS_API_KEY`.

A product reindex skips prune and alias rebuild, and returns `status: "skipped"`, when the feed is empty, when it has fewer than half as many products as the current product manifest, or when an embed batch fails.
