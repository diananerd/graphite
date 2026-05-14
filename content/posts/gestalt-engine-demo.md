---
title: "Gestalt engine demo"
date: 2026-05-16
description: "Six diagrams written in the Gestalt DSL — autolayout, autofit, semantic roles, and viewport controls — rendered with zero JS by default."
tags: [gestalt, engine, reference]
---

The Gestalt engine ships in this repo at `scripts/gestalt-engine/`. Authors
write a short declarative DSL; the engine chooses a layout, measures every
shape against its label, projects the result onto the declared aspect ratio,
and emits a self-contained SVG. The same pipeline backs every diagram below.

The DSL has six primitives: `node`, `edge`, `group`, and the meta directives
`layout:`, `margin:`, `controls:`. Coordinates are never authored. Variants
like `.filled`, `.double`, `.critical`, `.lifted` change how a shape renders
without changing how it lays out.

## Linear request flow

A simple chain — the engine classifies it as `linear-row` and spaces the
nodes evenly along a horizontal axis, sharing one y-axis (Gestalt continuity).

```gestalt
[16:9 graphite-neon "Request flow"]

node round:client   role:primary   label:"Browser"
node rect:api       role:secondary label:"Worker"
node cylinder:store role:data      label:"R2"

edge client -> api  label:"GET /post"
edge api    -> store role:data
```

## DAG with branching → Sugiyama

Once the graph has branching, the engine switches to layered Sugiyama. The
orthogonal edges follow manhattan routing through right→left ports.

```gestalt
[16:9 graphite-neon "Service mesh"]

node round:gw       role:primary   label:"Gateway"
node hexagon:auth   role:data      label:"Auth"
node hexagon:users  role:data      label:"Users"
node rect:api1      role:secondary label:"API-1"
node rect:api2      role:secondary label:"API-2"
node cylinder:store role:success   label:"Store"

edge gw    -> auth   style:orthogonal
edge gw    -> users  style:orthogonal
edge auth  -> api1   style:orthogonal
edge users -> api2   style:orthogonal
edge api1  -> store  style:orthogonal role:success
edge api2  -> store  style:orthogonal role:success
```

## Tree

A single-rooted tree where every node has at most one parent → the engine
picks tidy tree layout, parents centred above their children.

```gestalt
[16:9 graphite-neon "File system"]

node round:root     role:primary   label:"root"
node rect:src       role:secondary label:"src"
node rect:tests     role:secondary label:"tests"
node round:index    role:data      label:"index.ts"
node round:utils    role:data      label:"utils.ts"
node round:spec     role:data      label:"spec.ts"

edge root  -> src
edge root  -> tests
edge src   -> index
edge src   -> utils
edge tests -> spec
```

## Cycle → radial layout

When the engine detects a cycle, it places nodes on a circle. State machines
and event loops fall into this archetype.

```gestalt
[1:1 graphite-neon "Lifecycle"]
margin: 64

node circle:idle    role:muted   label:"idle"
node circle:fetch   role:primary label:"fetch"
node circle:render  role:success label:"render"
node circle:settle  role:info    label:"settle"

edge idle   -> fetch
edge fetch  -> render
edge render -> settle
edge settle -> idle
```

## Decision flowchart with variants

`.filled`, `.double`, `.dashed`, `.critical`, `.lifted` change the look of a
shape without changing where it sits.

```gestalt
[16:9 graphite-neon "Payment validation"]

node actor:user     role:external  label:"Buyer"
node round:checkout role:primary   label:"Checkout"
node diamond:valid  role:warning   label:"valid?" .dashed
node cylinder:ledger role:success  label:"Ledger" .filled
node round:fail     role:danger    label:"Error" .critical .lifted

edge user     -> checkout
edge checkout -> valid    label:"check"
edge valid    -> ledger   label:"yes" role:success
edge valid    -> fail     label:"no"  role:danger
```

## With viewport controls

Adding `controls: zoom pan auto-fit` opts the diagram into a 2.5KB JS
controller. Wheel zooms toward the cursor, drag pans, `0` resets, `f`
fullscreens. Strokes and text stay at constant rendered size thanks to
`vector-effect="non-scaling-stroke"` + a counter-scale on text wrappers.

```gestalt
[16:9 graphite-neon "Inspectable system"]
controls: zoom pan auto-fit
zoom-range: 0.5 4

node round:lb      role:info      label:"Load balancer"
node rect:gw       role:primary   label:"Gateway"
node hexagon:auth  role:data      label:"Auth"
node rect:api1     role:secondary label:"API shard 1"
node rect:api2     role:secondary label:"API shard 2"
node rect:api3     role:secondary label:"API shard 3"
node round:queue   role:info      label:"Queue"
node round:worker  role:success   label:"Worker pool"
node cylinder:db   role:data      label:"Replicated DB"

edge lb   -> gw     style:orthogonal
edge gw   -> auth   style:orthogonal role:data
edge gw   -> api1   style:orthogonal
edge gw   -> api2   style:orthogonal
edge gw   -> api3   style:orthogonal
edge api1 -> queue  style:orthogonal
edge api2 -> queue  style:orthogonal
edge api3 -> queue  style:orthogonal
edge queue -> worker style:orthogonal
edge worker -> db   style:orthogonal role:data
```

That's the entire surface area of the engine today. The same source on this
page would render byte-identically on a fresh checkout — no PRNG, no
timestamps, deterministic layout, deterministic projection, deterministic
SVG output.
