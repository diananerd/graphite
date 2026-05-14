# Gestalt rendering engine — requirement

Goal: replace AnimML's manual `at(x,y)` placement with a **deterministic auto-layout
engine** whose output always satisfies Gestalt principles, so authors describe
*intent* (nodes, edges, groups, semantics) and never coordinates. Every diagram
type — DAG, FSM, flowchart, hypergraph, event loop, schedule, concept map, block
diagram, table, geometric — must look balanced, aligned, grouped, and clipped to
the viewport without manual tweaking.

## 1. Scope

**In scope (v1):**
- Pure-CSS/SMIL animated SVG, no client JS runtime.
- Deterministic output: same input → byte-identical SVG.
- Author writes a declarative spec (DSL); engine resolves layout.
- Eleven diagram archetypes; one unified emitter.
- Virtual viewport + projection (centering, margin, no clipping).
- Auto-fit shape geometry to its label.

**Out of scope (v1):**
- Interactive editing (drag, pan, zoom).
- Live data binding.
- Non-deterministic optimizers (simulated annealing, force-directed with random seed).
- Theme switcher at render time — themes are compile-time tokens.

**Compatibility:** AnimML v1 specs with explicit `at(x,y)` continue to parse via a
`legacy:` mode flag; new specs omit coordinates and the Gestalt engine places them.

## 2. Primitive inventory

### 2.1 Shapes

Every shape is **auto-sized** to contain its label plus padding. The size table
below is the *minimum* — the engine grows the shape until the label fits.

| Shape       | Use                          | Min (w×h) | Notes |
|-------------|------------------------------|-----------|-------|
| `rect`      | generic block, service       | 96 × 56   | square corners |
| `round`     | soft block, friendly node    | 96 × 56   | radius 8 |
| `pill`      | sidecar, tag, badge          | 80 × 32   | radius = h/2 |
| `circle`    | event, FSM state, point      | 56 × 56   | label below if too small |
| `ellipse`   | start/end, terminus          | 96 × 48   | |
| `diamond`   | decision                     | 96 × 64   | label horizontally centered |
| `hexagon`   | data service, mesh           | 96 × 80   | |
| `parallelogram` | input/output (flowchart) | 96 × 56   | skew 12° |
| `trapezoid` | manual op, queue head        | 96 × 56   | |
| `cylinder`  | store, database              | 80 × 96   | |
| `cloud`     | external system, network     | 112 × 72  | |
| `note`      | annotation                   | 112 × 56  | folded corner |
| `actor`     | user, person                 | 56 × 88   | stick figure |
| `swimlane`  | row/column in process diagram| n/a (band) | spans diagram axis |
| `port`      | typed connection point       | 12 × 12   | docks on shape edge |
| `junction`  | router, no semantic body     | 12 × 12   | edge-only node |

### 2.2 Shape variants (orthogonal)

Each shape can be styled via a **variant tuple**:

- **Fill**: `outlined` · `filled` · `tinted` (8% bg of stroke color) · `glass` (translucent)
- **Border**: `solid` · `double` · `dashed` · `dotted` · `thick`
- **Corners** (rects only): `square` · `round-sm` (4px) · `round` (8px) · `round-lg` (16px)
- **Size hint**: `xs` · `sm` · `md` (default) · `lg` · `xl` — multiplies min size
- **Emphasis**: `none` · `accent` (single stroke pop) · `critical` (red stroke + glow)
- **Drop shadow**: `none` · `subtle` · `lifted`

A given shape's appearance is `{shape} × {fill} × {border} × {corners} × {size} × {emphasis} × {shadow}`.
The engine validates that incompatible combos (e.g. `circle` + `corners:square`) are
silently coerced or rejected with a clear error.

### 2.3 Groups

Groups are containers that participate in layout. Variants:

- **Boundary**: `none` · `outlined` · `tinted` · `dashed`
- **Label position**: `top-left` (default) · `top-center` · `bottom-left` · `inside-top`
- **Stacking**: `row` · `column` · `grid(NxM)` · `cluster` (auto-cluster by graph weight)
- **Padding**: `tight` (8) · `normal` (16) · `loose` (32)
- **Nesting**: groups may contain groups (depth ≤ 4)

A `swimlane` is a special group: a horizontal or vertical band that spans the
diagram and pins its members to its track.

### 2.4 Arrows

| Style       | Geometry                | Use                                   |
|-------------|-------------------------|---------------------------------------|
| `straight`  | line                    | simple A→B                            |
| `orthogonal` | manhattan (L-shape)    | block diagrams, schedulers            |
| `curved`    | quadratic Bezier        | parallel edges, return paths          |
| `cubic`     | cubic Bezier            | flowing, organic data flow            |
| `arc`       | circular arc            | event loop, cyclic                    |
| `step`      | stepped (multiple L)    | timing diagrams                       |
| `self-loop` | tear-drop loop          | recursion, retry                      |
| `hyper`     | n-ary fan (1 → many)    | hypergraph edges                      |

Each arrow has independent variants:

- **Line**: `solid` · `dashed` · `dotted` · `double` · `thick`
- **Head**: `arrow` (default) · `arrow-open` · `dot` · `diamond` · `none`
- **Tail**: same set as head, `none` default
- **Color**: any semantic token
- **Routing**: `auto` (engine picks) · `route:above` · `route:below` · `route:left` · `route:right`
- **Label position**: `mid` · `start` · `end` · `above` · `below`

### 2.5 Decorators

- **Badge**: small pill on a shape's corner (counts, status)
- **Glyph**: icon set (lock, clock, warning, check) for inline semantics
- **Annotation**: `note` shape tethered to a target via dashed line

## 3. Semantic color palette

Authors never name hex codes. They pick **semantic roles** that map to theme tokens:

| Role         | Light intent                          | Token (graphite-neon) |
|--------------|---------------------------------------|-----------------------|
| `primary`    | the subject of the diagram            | `--accent` (purple)   |
| `secondary`  | supporting actor                      | `--cyan`              |
| `success`    | OK path, ack, completed               | `--green`             |
| `warning`    | caution, retry, soft failure          | `--yellow`            |
| `danger`     | error, hard failure                   | `--red`               |
| `info`       | neutral info, metadata                | `--accent`            |
| `data`       | persistence, state                    | `--purple` (dimmer)   |
| `external`   | third party, network                  | `--pink`              |
| `muted`      | inactive, background                  | `--dim`               |

Each role has paired derivations: `*-fill` (8% tint), `*-glow` (filter), `*-dim` (28%).
A diagram never mixes more than **5 roles** at once (Gestalt: similarity / good
continuation requires limited variety).

## 4. Animation subset

Animations describe **diagram semantics**, not motion physics. The full verb set:

| Verb        | What it conveys                                |
|-------------|------------------------------------------------|
| `enter`     | element appears (reveal)                       |
| `exit`      | element disappears (fade out)                  |
| `activate`  | element becomes the focus                      |
| `deactivate`| element returns to baseline                    |
| `pulse`     | momentary attention, no state change           |
| `flow`      | packet travels along an edge                   |
| `pump`      | rhythmic flow (n packets, evenly spaced)       |
| `route`     | path lights up sequentially                    |
| `highlight` | brighten without filter                        |
| `dim`       | lower opacity                                  |
| `morph`     | shape A becomes shape B (same node id)         |
| `swap`      | two nodes exchange labels/roles                |
| `count`     | numeric badge increments                       |
| `shake`     | error indication                               |
| `progress`  | progress bar fill (0→100)                      |

States compose these verbs. A state is a **set of simultaneous verbs**. Transitions
are pure time edges (`duration`, `easing`). No conditional logic; sequencing is
explicit.

## 5. Gestalt principles → engine rules

Each principle maps to a concrete deterministic rule.

| Principle           | Engine enforcement                                                                 |
|---------------------|------------------------------------------------------------------------------------|
| **Proximity**       | Same group → tighter spacing; cross-group → 2× spacing; no group → 1.5× spacing.    |
| **Similarity**      | Same role/color = same fill/border; deviation requires explicit `emphasis:`.        |
| **Continuity**      | Edges follow a single flow axis where possible (left→right or top→bottom).          |
| **Closure**         | Group boundaries close visually (rounded corners on groups; no half-bounded sets).  |
| **Common fate**     | Nodes that animate together (same state) share an alignment axis.                   |
| **Figure / ground** | Active elements lifted (shadow `subtle`); background dimmed to ≤ 30% opacity.       |
| **Prägnanz**        | Layout prefers minimum bounding area + maximum symmetry score (see §7).             |
| **Symmetry**        | Mirror axis enforced when ≥ 60% of nodes share a parallel structure.                |
| **Focal point**     | At most one node per state has `emphasis:critical`; engine warns otherwise.         |
| **Uniform density** | No quadrant of the viewport may have > 2× the node density of the sparsest one.     |

## 6. Auto-layout algorithm

The layout is a **5-stage pipeline**, each stage deterministic and cacheable.

```
spec → classify → measure → place → route → project
```

### 6.1 Classify (diagram archetype)

The engine inspects the graph and picks a layout algorithm:

| Signal                                              | Layout                    |
|-----------------------------------------------------|---------------------------|
| DAG (acyclic, max in-degree per layer)              | **Sugiyama** (layered LR/TB) |
| Cycle present + ≤ 12 nodes + uniform role           | **Radial** (clock face)   |
| Strongly connected, FSM-shaped (state transitions)  | **State-machine radial**  |
| Tree (one root, no cross edges)                     | **Tidy tree** (Reingold–Tilford) |
| Bipartite                                           | **Two-column**            |
| Linear chain                                        | **Single row**            |
| Swimlanes declared                                  | **Lane-constrained Sugiyama** |
| Grid declared (`grid(NxM)`)                         | **Grid**                  |
| Hyperedges present                                  | **Hypergraph (Galois lattice)** |
| Geometric coordinates declared (legacy)             | **Pass-through**          |

Authors may override with `layout: sugiyama-lr` etc.

### 6.2 Measure (auto-fit)

For each node:
1. Lay out its label in its declared font/size; compute text bounding box.
2. Pad by role-specific inset (rects: 12px H, 8px V; pills: 16/4; circles: 8 each).
3. Snap to the nearest 4px multiple (grid alignment).
4. Apply size-hint multiplier (`sm` = ×0.85, `lg` = ×1.2, `xl` = ×1.45).
5. Result: each node has an exact `(w, h)` independent of position.

Sub-labels and badges expand the bounding box on their respective sides.

### 6.3 Place

Run the chosen layout algorithm on the measured graph. Output: virtual coordinates
in **layout units** (no pixels yet). Constraints honored:

- Group containment: nodes in group G are placed before non-group nodes interact.
- Swimlanes: members locked to their track axis.
- Anchors: explicit `anchor:left` / `anchor:right` etc. (rare; for labels-only nodes).
- Min-separation: each edge of one node ≥ `gap-min` from every neighbor's edge.

### 6.4 Route

For each edge:
1. Pick port on source/target (closest face by angle).
2. Choose arrow geometry from §2.4 based on layout type:
   - Sugiyama → `orthogonal` by default
   - Radial → `arc`
   - Linear → `straight`
   - Mixed graph → `cubic` for parallel edges, `straight` otherwise
3. Curve bend = constant for parallel edges (anti-overlap), 0 otherwise.
4. Label placed via §2.4 rules with collision-free offset.

### 6.5 Project (virtual viewport → real canvas)

This is the new piece the user called out.

```
       ┌──────────────── real canvas (viewBox) ─────────────────┐
       │                                                        │
       │   ┌─── margin ───┐   ┌──── content bbox ────┐         │
       │   │              │   │   (virtual viewport)  │         │
       │   │              │   │                       │         │
       │   │              │   │                       │         │
       │   └──────────────┘   └───────────────────────┘         │
       │                                                        │
       └────────────────────────────────────────────────────────┘
```

Steps:
1. Compute global bounding box of all placed elements + labels + badges.
2. Add margins: `margin: { top, right, bottom, left }` (default 48 px each).
3. Compute the resulting virtual viewport `W × H`.
4. Snap aspect ratio to a declared `ratio:` if given (16:9, 4:3, …). Two
   subpolicies:
   - `fit: contain` (default) — letterbox the content within the declared ratio.
   - `fit: cover` — content fills ratio; permitted to crop margins (never content).
5. Compute the projection scale = `min(canvasW/virtualW, canvasH/virtualH)`.
6. Translate so the *content* bbox center coincides with the canvas center.
7. Emit final `viewBox="0 0 canvasW canvasH"` and a single `<g transform="translate(tx,ty) scale(s)">` wrapper.

Invariants the projector guarantees:
- No node, label, badge, or arrow may cross any canvas edge.
- The visible composition is centered on the canvas center to within ±1 px.
- The minimum margin specified is never violated.
- If the content cannot fit at the declared ratio without violating margins, the
  engine *grows the canvas* (not the projection scale) and warns.

### 6.6 Determinism

Every stage is deterministic given the spec:
- Layout algorithms use stable IDs as tie-breakers.
- Edge routing prefers the rotation `right < down < left < up` when ports are
  equidistant.
- No PRNGs anywhere in the pipeline.

## 7. Optimization function

For layouts that admit multiple valid solutions (Sugiyama crossings, radial start
angle), the engine picks the one minimizing a deterministic objective:

```
score = 1.0 * edge_crossings
      + 0.5 * total_edge_length / sqrt(node_count)
      + 0.3 * (1 - symmetry_axis_alignment)
      + 0.2 * (1 - quadrant_density_uniformity)
      + 0.1 * label_overlap_area
```

Lower is better. Each term is computable in linear or near-linear time on the
final placement; we evaluate a small candidate set (≤ 8) and pick the minimum.

## 8. Input DSL (Gestalt-AnimML v2)

Backward-compatible syntactic extension of AnimML. Differences:

- `at(...)` is **optional**. If omitted, engine places.
- New `style:` clause per node/edge for variant tuples.
- New `layout:` meta directive.
- New `role:` shorthand replaces `color:` (still accepted).
- New `lane:` clause assigns a node to a swimlane.
- New `as group { ... }` block for inline grouping.

```anim-v2
[16:9 graphite-neon "Request flow"]
layout: auto
margin: 48

node browser:client      role:primary    label:"Browser"
node server:api          role:secondary  label:"Worker"
node cylinder:store      role:data       label:"R2"

edge client -> api  label:"GET /post"      style:cubic
edge api -> store   label:"read"           role:secondary
edge store -> api   label:"data"           role:data style:cubic return

state idle:
  dim *
state requesting:
  activate client
  flow client->api

idle --[800ms]--> requesting
```

Notes:
- `node SHAPE:ID …` replaces `use SHAPE as ID at(x,y) …`.
- `edge FROM -> TO …` replaces `-> FROM -> TO as ID …`.
- `client->api` is the auto-generated edge id (deterministic from endpoints).
- `style:cubic` and `return` are arrow variants per §2.4.

## 9. Diagram archetypes (must support)

| # | Archetype          | Layout chosen        | Notes                                       |
|---|--------------------|----------------------|---------------------------------------------|
| 1 | DAG / pipeline     | Sugiyama LR          | Multi-rank, edge bundling                   |
| 2 | Tree               | Tidy tree            | Reingold–Tilford                            |
| 3 | FSM                | State-machine radial | Loops on outside, self-loops above          |
| 4 | Flowchart          | Sugiyama TB          | Decision diamonds branch L/R                |
| 5 | Sequence           | Lifelines + lanes    | Vertical time axis                          |
| 6 | Event loop         | Arc                  | Nodes on circle, sequenced by arc length    |
| 7 | Scheduling         | Gantt grid           | Lanes are tracks, x-axis is time            |
| 8 | Block diagram      | Orthogonal grid      | Rectilinear edges, optional ports           |
| 9 | Concept map        | Force-balanced radial| Deterministic via spectral layout           |
| 10| Hypergraph         | Galois lattice       | n-ary edges drawn as Steiner trees          |
| 11| Geometric          | Pass-through         | Author specifies coords; engine validates   |
| 12| Table / matrix     | Strict grid          | Cell auto-fit; row/column headers as groups |

## 10. Verification rules

Each rule is a boolean predicate on the final placement; CI fails if any returns
false. Rules apply to *every* generated diagram.

| ID  | Rule                                                                        |
|-----|-----------------------------------------------------------------------------|
| V1  | No element crosses the canvas edge.                                         |
| V2  | Margin invariants honored (≥ declared value).                               |
| V3  | No two unrelated nodes overlap (bbox intersection = 0).                     |
| V4  | No edge crosses through a non-incident node's bbox.                         |
| V5  | All labels fit within their host shape (or beside, when explicit).          |
| V6  | At most 1 `emphasis:critical` per state.                                    |
| V7  | At most 5 distinct semantic roles per diagram.                              |
| V8  | Content bbox center within ±1 px of canvas center.                          |
| V9  | Every animation verb targets an existing element id (or `*`).               |
| V10 | All edge endpoints reference defined nodes.                                 |
| V11 | Group nesting depth ≤ 4.                                                    |
| V12 | All transitions form a connected timeline graph (no orphan states).         |
| V13 | Quadrant density uniformity score ≥ 0.5.                                    |
| V14 | Edge crossings count ≤ heuristic bound for diagram size (3√n for n nodes).  |
| V15 | Symmetry score ≥ 0.6 when graph admits a mirror axis.                       |
| V16 | Identical input produces byte-identical SVG (determinism).                  |

## 11. Testbench dimensions

The combinatorial testbench is a product over these axes. The runner enumerates
the matrix, renders each cell, and asserts §10.

**Axis A — diagram archetype:** 12 (see §9).

**Axis B — node count:** {1, 3, 7, 15, 30, 60}.

**Axis C — shape mix:**
- Single (all same shape)
- Mixed-2 (two shapes alternating)
- Mixed-5 (max diversity)

**Axis D — variant orthogonals:**
- Fill: {outlined, filled, tinted, glass}
- Border: {solid, double, dashed, dotted, thick}
- Corners: {square, round-sm, round, round-lg}
- Size hint: {xs, sm, md, lg, xl}
- Emphasis: {none, accent, critical}
- Shadow: {none, subtle, lifted}

(Full Cartesian = 4×5×4×5×3×3 = 3,600; we sample 60 vectors via balanced LHS.)

**Axis E — arrow style:** {straight, orthogonal, curved, cubic, arc, step, self-loop, hyper}.

**Axis F — group nesting depth:** {0, 1, 2, 3, 4}.

**Axis G — animation pattern:** {none, single-flow, parallel-flow, sequence, fsm}.

**Axis H — ratio / projection:** {16:9, 4:3, 9:16, 3:2, 1:1, custom:1280×720}.

**Axis I — role mix:** {1, 3, 5} distinct semantic roles.

The matrix is **multi-dimensional**: each test fixture picks one value per axis,
plus a name. We generate ~250 fixtures (covering arrays + targeted edge cases),
not the full cross-product.

**Edge cases (must include):**
- 1 node, 0 edges
- 2 nodes, 1 edge, both auto-positioned
- Self-loop
- Parallel edges (3 between same pair)
- Disconnected components (2 islands)
- Hyperedge spanning 4 nodes
- Nested group at depth 4
- Maximum label (80 chars) on smallest shape
- Empty label
- Ratio 1:1 with 30 nodes
- Ratio 9:16 portrait with sequence
- Single critical emphasis among muted neighbors
- All shapes from §2.1 in one diagram
- All arrow styles from §2.4 in one diagram

## 12. Verification harness

A new script `scripts/gestalt-validate.mjs`:

```
gestalt-validate FIXTURE.json
  → compiles to SVG
  → parses SVG back into AST
  → runs each V-rule predicate
  → emits per-fixture report + aggregate
  → fails CI if any V-rule fails
```

CI matrix runs this over the full testbench. PR review surfaces a visual gallery
(grid of fixture renderings) for human approval.

## 13. Implementation phases

| Phase | Deliverable                                                          |
|-------|----------------------------------------------------------------------|
| P1    | Measurement + projection + virtual viewport (§6.2, §6.5)             |
| P2    | Single-row + grid layouts; auto-fit shapes; new DSL parser           |
| P3    | Sugiyama (LR / TB); orthogonal + cubic arrows                        |
| P4    | Radial + FSM + sequence layouts; arc + self-loop arrows              |
| P5    | Variants (fill / border / corners / shadow); roles; effect verbs     |
| P6    | Swimlanes + grid layout; tree (tidy)                                 |
| P7    | Hypergraph (Galois lattice); event loop; scheduling Gantt            |
| P8    | Testbench generator; verification harness; CI integration            |
| P9    | Migration of existing AnimML posts to v2 syntax                      |
| P10   | Docs + author guide + cookbook                                       |

Phase ordering preserves the build at every checkpoint. Each phase ends with the
full testbench passing for the features delivered so far.

## 15. Legibility budget

Hard minimums measured **in rendered CSS pixels** on the user's screen — not in
SVG units. The engine resolves these against the current effective scale factor
(see §16) and refuses to ship a diagram that breaches them at the default
container width.

| Element                | Min rendered size | Rationale                                     |
|------------------------|-------------------|-----------------------------------------------|
| Body label             | **11px**          | WCAG-adjacent; Monaspace at 11px stays crisp  |
| Sublabel               | **9px**           | Allowed only when paired with a body label    |
| Edge label             | **10px**          | Must remain legible mid-edge                  |
| Badge / count          | **10px**          | Single glyph; 1ch wide minimum                |
| Stroke (shape border)  | **1.0px**         | Below 1px → sub-pixel hairline → blur on HiDPI|
| Stroke (edge line)     | **1.25px**        | Edges read as lines, not borders              |
| Stroke (emphasis)      | **2.0px**         | `accent` and `critical` must be visibly heavier|
| Stroke (dashed gap)    | **2.0px**         | Dashes shorter than this read as solid         |
| Shape inner width      | **40px**          | Below this no label can fit at 11px           |
| Shape inner height     | **24px**          | Single-line label clearance                   |
| Inter-node gap         | **16px**          | Proximity rule lower bound (§5)               |
| Margin (viewport edge) | **24px**          | Above any V2 declared margin                  |
| Group inner padding    | **12px**          | Closure rule lower bound                      |

The whole table is one constant `LEGIBILITY` in the compiler; tests in §11
cover every entry.

A budget failure is a **hard error** (CI fails) unless the spec opts into an
adaptation strategy (§17).

## 16. Adaptive sizing (vector-stable vs screen-stable)

Every visual element belongs to one of two sizing classes:

- **vector-stable** — scales with the SVG content. The element grows when you
  zoom in, shrinks when you zoom out. SVG default. Used for: shape geometry,
  group boundaries, axes, anything spatial.
- **screen-stable** — keeps a constant rendered size regardless of SVG scale.
  Used for: text, edge stroke widths, dash patterns, focal-emphasis glow radius,
  badges. This is the "map label" behavior.

Why both: in a complex diagram zoomed out to fit a small thumbnail, vector-stable
labels would shrink below the legibility budget. Screen-stable labels stay
readable; shapes still scale spatially. When the user zooms in, shapes get
bigger but labels stay the same size — which is exactly the expected behavior
for technical diagrams (think AutoCAD, Figma, OmniGraffle).

### 16.1 Implementation

Two techniques composed:

1. **Non-scaling strokes** — every line/border uses `vector-effect="non-scaling-stroke"`.
   This is a pure SVG attribute, supported everywhere, no JS. Strokes keep their
   declared `stroke-width` in screen pixels at any zoom level.
2. **Counter-scaled text** — each `<text>` is wrapped in a `<g>` that applies
   the inverse of the current viewport scale. When the diagram is static (no
   zoom controls), this collapses to identity. When zoom is enabled (§18),
   a tiny JS controller updates the inverse-scale on the wrapper as the user
   zooms.

```xml
<g class="screen-stable" transform="scale(1)">
  <text>Browser</text>
</g>
```

The JS controller (when present) updates `transform="scale(1/zoom)"`. Without
JS, the wrapper is identity and the text is vector-stable — same as today.

### 16.2 Per-element opt-out

Authors may override either class on a specific element:

```anim-v2
node browser:client role:primary label:"Browser" sizing:vector
edge client -> api  label:"GET" sizing:screen
```

Defaults:
- All text → screen-stable
- All strokes → screen-stable
- All shape fills / geometry → vector-stable
- Badges → screen-stable
- Group boundaries → vector-stable (geometry) with screen-stable strokes

### 16.3 Implications for the legibility budget

The budget (§15) is evaluated **at the smallest expected rendered scale**. When
the container is responsive (§17), the engine uses the smallest container width
in the responsiveness contract. Screen-stable text always satisfies its row of
the budget by construction; vector-stable text is checked at every breakpoint.

## 17. Container responsiveness (aspect-ratio-aware)

A diagram is shipped with a contract describing how it adapts to its container.

### 17.1 Sizing modes

| Mode             | Behavior                                                                |
|------------------|-------------------------------------------------------------------------|
| `fixed`          | SVG rendered at declared canvas size; no resize.                        |
| `responsive` (default) | SVG fills container width; aspect ratio preserved (`xMidYMid meet`). |
| `letterbox`      | Aspect ratio preserved, bars top/bottom if container is wider.          |
| `crop-safe`      | Engine reserves a "safe zone" inside; content never enters bars.        |

In `responsive` mode the SVG's `width="100%"` and `height` follows the
container via `aspect-ratio` CSS or the SVG's intrinsic ratio.

### 17.2 Aspect-ratio matching

If the container's measured aspect ratio at runtime differs significantly from
the SVG's declared ratio, the engine has three options (declared per spec):

| Strategy        | Effect                                                                  |
|-----------------|-------------------------------------------------------------------------|
| `preserve`      | Letterbox with bars; never reflow.                                      |
| `relayout`      | At build time, generate **2 or 3 ratio variants** and pick at runtime via container queries. |
| `degrade`       | Render at declared ratio; if container is too narrow/short, hide secondary labels (smaller font tier first). |

Default: `preserve`. `relayout` is opt-in because it ships ≥ 2× the SVG bytes.

### 17.3 Breakpoints

The container-query system uses a fixed three-tier grid:

| Tier | Container width | Layout adjustments                                         |
|------|-----------------|------------------------------------------------------------|
| `sm` | < 480px         | Hide sublabels; shrink badges to glyph only; tighten gaps. |
| `md` | 480–960px       | Full labels; standard density.                             |
| `lg` | > 960px         | Increase inter-node gap by 1.25×; relax routing.           |

`sm` is what makes complex diagrams readable on phones. The engine evaluates the
legibility budget at every active tier.

### 17.4 Minimum container

If the container drops below the SVG's **minimum legible width** (computed from
node count + smallest shape + budget), the SVG renders a fallback:

- A static, simplified version with fewer labels (top-level nodes only).
- A "Open full diagram" link/button (just an `<a>` with `href="#diagramId"` —
  opens a dedicated full-screen view, see §18).

## 18. Viewport controls (opt-in JS)

When a diagram has enough nodes to risk a budget violation at its smallest
expected scale, the spec may opt in to viewport controls. This is the only place
in graphite where JS is permitted at runtime, and only when explicitly enabled.

### 18.1 Controls

| Control     | Behavior                                                            |
|-------------|---------------------------------------------------------------------|
| `zoom`      | Mouse wheel / pinch / `+`/`−` keys → scale around cursor.           |
| `pan`       | Click-drag / arrow keys → translate.                                |
| `auto-fit`  | Double-click / `0` key → reset to fit-to-container.                 |
| `fullscreen`| `f` key → fullscreen takeover via `requestFullscreen()`.            |

### 18.2 Spec declaration

```anim-v2
controls: zoom pan auto-fit
zoom-range: 0.5 4
zoom-step: 0.1
```

Absent → no controls (legacy default, zero JS).

### 18.3 JS payload

A single inline `<script>` per page (deduplicated when ≥ 2 controlled diagrams):

- Module IIFE, no external deps.
- Budget: **≤ 2.5 KB minified**, `defer` attribute.
- Listens for: `wheel`, `pointerdown/move/up`, `keydown`, `dblclick`,
  `fullscreenchange`.
- Touches only the `transform` attribute on a single `<g class="zoom-root">`
  and the counter-scale of screen-stable wrappers (§16.1).
- Disabled in `prefers-reduced-motion` — wheel/pinch still works but no
  inertial animation.

The script is generated at build time per page (tree-shaken when no diagram
on the page enables controls). When enabled, the page's HTML budget rises by
≤ 2.5KB; everything else stays static.

### 18.4 Accessibility

- All controls keyboard-reachable.
- Visible focus ring on the SVG when focused.
- Live region announces current zoom level on change ("Zoom 150%").
- `role="application"` on the SVG when controls are present (lets AT users
  know arrow keys are intercepted).
- `prefers-reduced-motion` disables smooth tweening; transitions become
  instantaneous.

### 18.5 URL state

When `controls` is enabled, the current pan/zoom are encoded into the URL hash
on debounce (`#zoom=1.8,x=240,y=-120`). Reload restores. Shareable links keep
the reader's view.

### 18.6 Visual chrome

A minimal control bar in the bottom-right corner of the SVG (or container),
inline SVG buttons:

```
[+]   [−]   [⛶]   [0]
```

Hidden until pointer enters the diagram (debounced 200ms). Fades out 1.5s after
last interaction. Always visible on touch devices.

## 19. Adaptation cascade

When the engine detects a budget violation at the current (or declared minimum)
scale, it applies these strategies **in order** until the budget passes:

1. **Tighten margins** — to declared minimum (not below §15 floor).
2. **Densify routing** — switch curved/cubic edges to orthogonal where the gain
   is ≥ 8% bbox reduction.
3. **Drop sublabels** — at tier `sm` (§17.3) or on hyperdense diagrams.
4. **Increase canvas** — grow the declared ratio's longest dimension; warn.
5. **Switch layout** — Sugiyama TB → Sugiyama LR if the result reduces aspect
   mismatch by ≥ 30%.
6. **Auto-enable controls** — emit `controls: zoom pan auto-fit` and the JS
   payload, with a build-time warning. Authors can suppress with
   `legibility: strict` (forces strategies 1–5 only).
7. **Hard fail** — if `strict` and nothing else works, build errors out with the
   list of strategies tried and the budget violations remaining.

Every strategy is logged into the build report so authors see exactly what was
applied.

## 20. Updated DSL directives

```anim-v2
[16:9 graphite-neon "Title"]
layout: auto
margin: 48
sizing: responsive
fit: preserve
legibility: standard          # standard | strict | lax
min-label: 11                 # override §15 default (in screen px)
min-stroke: 1.0
controls: zoom pan auto-fit
zoom-range: 0.5 4
```

Per-element overrides:

```
node rect:api role:secondary label:"Worker" sizing:vector
edge a -> b style:cubic label:"GET" sizing:screen min-label:9
group payment contains(a, b, c) sizing:vector padding:loose
```

`sizing:` accepts `vector`, `screen`, or omitted (defaults per element kind).

## 21. Verification additions

Add to §10:

| ID  | Rule                                                                        |
|-----|-----------------------------------------------------------------------------|
| V17 | At default container width, all screen-stable text ≥ `min-label`.           |
| V18 | At tier `sm` (§17.3), all body labels ≥ 11px rendered.                      |
| V19 | All strokes ≥ `min-stroke` at every tier in the contract.                   |
| V20 | When `controls:` is set, the JS payload is ≤ 2.5KB minified.                |
| V21 | When `controls:` is set, every control is keyboard-reachable.               |
| V22 | When `controls:` is absent, zero JS shipped for the diagram.                |
| V23 | Container at minimum width never causes element clipping (V1 holds at sm).  |
| V24 | Adaptation cascade applied = report logs match diagram output.              |

## 22. Updated implementation phases

Revised P1–P12 to include legibility, sizing, responsiveness, controls:

| Phase | Deliverable                                                              |
|-------|--------------------------------------------------------------------------|
| P1    | Measurement + projection + virtual viewport (§6.2, §6.5)                 |
| P2    | Legibility budget engine + adaptation cascade strategies 1–5 (§15, §19)  |
| P3    | Single-row + grid layouts; auto-fit shapes; new DSL parser               |
| P4    | Sugiyama (LR / TB); orthogonal + cubic arrows                            |
| P5    | Adaptive sizing: non-scaling strokes + counter-scaled text (§16)         |
| P6    | Container responsiveness: 3 tiers, container queries, fallback (§17)     |
| P7    | Radial + FSM + sequence layouts; arc + self-loop arrows                  |
| P8    | Variants (fill / border / corners / shadow); roles; effect verbs         |
| P9    | Viewport controls + ≤2.5KB JS payload + URL state (§18)                  |
| P10   | Swimlanes + tree (tidy); hypergraph; event loop; Gantt                   |
| P11   | Testbench generator + verification harness (§11, §12, §21) + CI matrix   |
| P12   | Migration of existing posts + docs + cookbook                            |

## 14. Open questions

1. **Label measurement at build time.** Current AnimML doesn't measure text. We
   need either `satori` (already a dep) or a custom Monaspace metric table for
   per-glyph advance widths. Proposal: ship a static table for Monaspace Neon
   (computed once via `@capsizecss/unpack`); fall back to satori for arbitrary
   strings.
2. **Edge bundling on dense DAGs.** Optional optimization — defer to P3.5 unless
   needed for testbench V14.
3. **Theme variants.** Only `graphite-neon` ships; `graphite-pastel`, `glass`,
   `transparent` are token swaps. Engine treats theme as orthogonal to layout.
4. **Backwards compat.** Existing AnimML posts (`feature-tour.md`, `animation-gallery.md`)
   must continue to render. We support both via the parser version flag in the
   header (`v1` implicit; `v2` explicit).

---

Next step on this branch: enumerate the **testbench fixtures** (§11) as JSON,
then build the verification harness (§12), then begin Phase 1.
