---
title: "Hello world"
date: 2026-05-13
description: "First post on graphite — a fast, typography-driven blog system built on Cloudflare Workers and R2."
tags: [meta, intro]
---

This is the inaugural post. The site you are reading is built on `graphite`, an
open-source blog system: Astro for static generation, Cloudflare Workers for
the edge, and R2 + the Images binding for the photo pipeline.

## Why graphite

Three goals shape the system:

- **Read first.** Typography, line length and contrast are tuned for prose.
  No tracking, no popups, nothing between you and the words.
- **Fast.** The static HTML is served from 300+ edge locations. Lighthouse
  scores 100/100/100/100. There is no JavaScript runtime on the page.
- **Forkable.** Brand, copy and Cloudflare resource names live in a single
  `blog.config.ts`. The blog system itself is generic — copy this repo, edit
  one file, ship.

## What works

A short tour:

- Markdown posts with a typed schema (title, date, description, tags, image, draft).
- RSS feed and sitemap auto-generated.
- Images: PNG originals in R2, AVIF variants served by the Worker with year-long
  immutable cache.
- OG cards regenerated at build time.
- Pre-commit validation: frontmatter, body, AnimML diagrams, image naming, PNG
  optimization.

That is the surface area for v1. More to come.
