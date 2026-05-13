# graphite

A fast, typography-driven blog system on **Cloudflare Workers + R2 + Images**.

- Astro SSG (zero JS runtime in the static output)
- Markdown content with frontmatter schema, RSS, sitemap
- Image pipeline: PNG originals in R2 → AVIF variants served via Worker
- OG image generation, font subsetting and font-fallback calibration
- AnimML — a small DSL for animated diagrams (compiled to SVG at build time)
- Lighthouse target: 100/100/100/100

Brand, copy and Cloudflare resource names live in [`blog.config.ts`](./blog.config.ts).
Fork the repo, edit that one file, and the rest is generic.

This repository currently powers [diananerd.com](https://diananerd.com).

---

## Quick start

```bash
git clone https://github.com/diananerd/graphite.git
cd graphite
pnpm install
pnpm fetch:font              # Monaspace Neon VF → public/fonts/
pnpm gen:font-fallback       # calibrated CSS fallback
pnpm dev                     # http://localhost:4321
```

Optional setup:

```bash
brew install oxipng          # lossless PNG optimization (or `sudo apt install oxipng`)
pnpm dlx playwright install chromium --with-deps   # Mermaid diagram rendering
```

---

## Branding it your own

Open `blog.config.ts` and edit:

```ts
export const blogConfig: BlogConfig = {
  site: {
    name: "Your Name",
    description: "Your tagline",
    domain: "yourdomain.com",
    url: "https://yourdomain.com",
    lang: "en",
    author: { name: "Your Name" },
  },
  terminal: { prompt: "you@host:~$" },
  cloudflare: {
    workerName: "your-worker",
    r2BucketName: "your-bucket",
    r2PreviewBucketName: "your-bucket-preview",
  },
  og: { tagline: "Your tagline" },
};
```

Then update [`wrangler.jsonc`](./wrangler.jsonc) so `name` and `r2_buckets[].bucket_name`
match what you put in `blog.config.ts`. All site source code reads from the config.

---

## Writing a post

```sh
cat > content/posts/hello-world.md <<'EOF'
---
title: "Hello world"
date: 2026-01-15
description: "First post. Long enough to clear the 50-char SEO floor."
tags: [meta]
---

Markdown body here.
EOF

cp some-image.png public/images/hello-world.png
git add . && git commit -m "post: hello world"
```

The pre-commit hook runs:

- `validate-frontmatter.mjs` — schema, length, uniqueness, image references
- `validate-content.mjs` — alt text, heading hierarchy, code-block languages, link health
- `validate-anim.mjs` — AnimML schema for any ` ```anim ` blocks
- `markdownlint-cli2` — Markdown style
- `optimize-png.mjs` — lossless PNG optimization (oxipng, if installed)

---

## Project layout

```
graphite/
├─ blog.config.ts            # Brand + Cloudflare resource names
├─ astro.config.mjs          # Markdown pipeline (Shiki, Mermaid, AnimML, responsive imgs)
├─ wrangler.jsonc            # Worker + R2 + Images bindings
├─ content/posts/            # Your Markdown content
├─ public/
│  ├─ fonts/                 # MonaspaceNeonVarVF.woff2 (fetched by script)
│  ├─ images/                # PNG originals (synced to R2 in CI, excluded from bundle)
│  ├─ og/home.png            # OG image (regenerated each build)
│  ├─ styles/                # global.css, font-fallback.css
│  └─ _headers, .assetsignore
├─ src/
│  ├─ content.config.ts      # Astro content collection schema
│  ├─ layouts/Base.astro     # <head>, meta, font preload, critical CSS
│  ├─ pages/                 # index.astro, [...slug].astro, rss.xml.ts
│  └─ plugins/               # remark/rehype: responsive-images, rehype-anim
├─ scripts/                  # validate-*, generate-og, font fallback, anim compiler
├─ worker/index.ts           # /images/* → R2 → Images binding pipeline
└─ .github/workflows/        # CI: validate → build → R2 sync → wrangler deploy
```

---

## Image pipeline

| Step | Where it happens |
|---|---|
| Author writes `![alt](/images/foo.png)` | local Markdown |
| Remark plugin emits `<img>` with AVIF `srcset` + `width`/`height` | `astro build` |
| Original PNG synced to `graphite-images/images/foo.png` | CI |
| Worker generates AVIF variants on first request and persists them | CF runtime |
| Subsequent requests served from R2 with `immutable` cache headers | CF edge |

The `/images/foo.png` URL is **never** served to browsers — only `@400.avif`,
`@800.avif`, `@1200.avif` variants. The original PNG lives in R2 solely as the
generation source.

---

## Available scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Astro dev server, hot reload |
| `pnpm build` | `generate-og` → `astro build` → `assert-build` (gate) |
| `pnpm check` | TypeScript check via `astro check` |
| `pnpm deploy` | `build` then `wrangler deploy` |
| `pnpm validate` | All three validators against `content/posts/*.md` |
| `pnpm lint:md` | `markdownlint-cli2` |
| `pnpm fetch:font` | Download Monaspace Neon VF from GitHub |
| `pnpm gen:font-fallback` | Generate calibrated `font-fallback.css` |
| `pnpm subset:font` | Optional — subset font to ~95KB (requires `pyftsubset`) |

---

## Deployment

### One-time setup

1. Create the R2 bucket: `pnpm exec wrangler r2 bucket create graphite-images`
2. Add the internal key: `openssl rand -hex 32 | pnpm exec wrangler secret put INTERNAL_KEY`
3. Add GitHub secrets:
   - `CF_ACCOUNT_ID` — Cloudflare Dashboard → Overview
   - `CF_API_TOKEN` — Workers:Edit, R2:Edit
   - `INTERNAL_KEY` — same value as above
4. Configure the custom domain in the CF dashboard (Workers → Triggers).

### Continuous deployment

Push to `main`. The CI workflow runs validate → build → R2 sync → `wrangler deploy`
→ pre-generate AVIF variants.

---

## License

[MIT](./LICENSE) © 2026 Diana Nerd
