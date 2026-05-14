---
title: "Work in progress draft"
date: 2026-12-31
description: "A draft post used to verify that drafts are excluded from the build but still pass validation."
tags: [meta, draft]
draft: true
---

This post is a draft. The frontmatter sets `draft: true`, so the renderer
should skip it from the index, RSS and sitemap.

The validators still run against drafts — they just relax a few rules:
short word counts and placeholder words are warnings instead of errors for
drafts in progress.

## Future content goes here

TODO: this is intentionally a placeholder line. It would normally fail the
placeholder check, but for drafts the rule is suppressed.
