---
title: "Animation gallery"
date: 2026-05-14
description: "Stress test of every AnimML feature: symbols, colors, edges, containers, states, ratios, and BDD-style scenarios."
tags: [animml, reference, stress-test]
---

This post exists to exercise every AnimML feature in one place. Each diagram
below is a real concept rendered from a single ` ```anim` block — no client
JavaScript, all CSS keyframes and SMIL motion paths emitted at build time.

The compiler is roughly six hundred lines of Node, no runtime dependencies,
and emits a self-contained SVG per block: the symbol library lives inside
`<defs>`, animations are pure CSS keyframes plus SMIL `animateMotion` for
packets along edge paths, and every glow comes from a Gaussian blur filter
that resolves on the GPU. The pages below are the same HTML you would ship
to a reader: open dev tools and search for `<svg` to find them inline.

What follows is twelve realistic concepts. The point is breadth — different
symbols, different topologies, different ratios, the full set of edge
attributes and state effects — and to confirm that a long page with many
diagrams still parses fast, stays under the HTML budget, and renders without
a single console error.

## 1. Linear request flow

A baseline: browser → worker → store, returning data with `.return`.

```anim
[16:9 graphite-neon "Request flow"]
duration: 4000

use browser as client at(18, 50) label:"Browser"
use server as api at(50, 50) label:"Worker" color:cyan
use cylinder as store at(82, 50) label:"R2" color:purple

-> client -> api as req label:"GET /post"
-> api -> store as fetch label:"read" color:cyan
-> store -> api as resp label:"data" color:purple .return

state idle:
  dim *
state requesting:
  highlight client
  flow req
state reading:
  active api
  flow fetch
state done:
  active store
  flow resp

idle --[800ms ease-out]--> requesting
requesting --[1000ms ease-in-out]--> reading
reading --[1200ms ease-in-out]--> done
done --[1000ms ease]--> idle
```

## 2. Cache decision (diamond)

Decision node with two branches, dashed refill path back to cache.

```anim
[16:9 graphite-neon "Cache miss path"]
duration: 4800

use browser as client at(10, 50) label:"Client"
use diamond as decide at(33, 50) label:"in cache?" color:yellow
use cache as edge at(33, 18) label:"Edge cache" color:green
use server as origin at(63, 50) label:"Origin" color:cyan
use cylinder as db at(88, 50) label:"DB" color:purple

-> client -> decide as req label:"GET"
-> decide -> edge as hit label:"hit" color:green bend:-15
-> decide -> origin as miss label:"miss" color:orange
-> origin -> db as fetch label:"query" color:purple
-> db -> origin as data color:purple .return
-> origin -> edge as fill label:"fill" color:green bend:18 .dashed

state idle:
  dim *
state ask:
  highlight client
  flow req
state look:
  pulse decide
state nope:
  active origin
  flow miss
state load:
  flow fetch
  flow data
  active db
state cache-fill:
  active edge
  flow fill

idle --[500ms]--> ask
ask --[700ms]--> look
look --[700ms]--> nope
nope --[800ms]--> load
load --[800ms]--> cache-fill
cache-fill --[800ms ease-out]--> idle
```

## 3. Pub/sub fan-out

One publisher, one broker (queue symbol), three subscribers — `flow` on
multiple edges in the same state runs them in parallel.

```anim
[16:9 graphite-neon "Pub/sub fan-out"]
duration: 4200

use server as pub at(12, 50) label:"Publisher" color:cyan
use queue as broker at(42, 50) label:"Broker" color:purple
use box as a at(80, 22) label:"Sub A" color:green
use box as b at(80, 50) label:"Sub B" color:yellow
use box as c at(80, 78) label:"Sub C" color:pink

-> pub -> broker as e1 label:"publish" color:cyan
-> broker -> a as e2 color:green bend:-12
-> broker -> b as e3 color:yellow
-> broker -> c as e4 color:pink bend:12

state idle:
  dim *
state publishing:
  highlight pub
  flow e1
state fanning:
  active broker
  flow e2
  flow e3
  flow e4
state consumed:
  active a
  active b
  active c

idle --[700ms]--> publishing
publishing --[900ms]--> fanning
fanning --[1100ms ease-out]--> consumed
consumed --[1000ms]--> idle
```

## 4. Service mesh

Six nodes with cross-edges, mix of solid and dashed (async) paths, and curved
edges via `bend:`.

```anim
[16:9 graphite-neon "Service mesh"]
duration: 4800

use box as gateway at(10, 50) label:"Gateway" color:cyan
use hexagon as auth at(34, 22) label:"Auth" color:purple
use hexagon as users at(34, 78) label:"Users" color:green
use hexagon as posts at(60, 22) label:"Posts" color:yellow
use hexagon as media at(60, 78) label:"Media" color:pink
use cylinder as store at(88, 50) label:"Store" color:accent

-> gateway -> auth as e1 color:purple bend:-8
-> gateway -> users as e2 color:green bend:8
-> users -> posts as e3 color:yellow .dashed
-> posts -> media as e4 color:pink .dashed
-> posts -> store as e5 color:accent
-> media -> store as e6 color:accent bend:-10

state idle:
  dim *
state arrive:
  highlight gateway
  flow e1
  flow e2
state route:
  active auth
  active users
  flow e3
state work:
  active posts
  flow e4
  flow e5
state persist:
  active media
  flow e6
  active store

idle --[600ms]--> arrive
arrive --[800ms]--> route
route --[900ms]--> work
work --[900ms]--> persist
persist --[800ms]--> idle
```

## 5. Primary and replicas

Same color across nodes (purple) plus `.return` arrows for acknowledged WAL.

```anim
[16:9 graphite-neon "Primary and replicas"]
duration: 4000

use cylinder as primary at(22, 50) label:"Primary" color:cyan sublabel:"region-a"
use cylinder as r1 at(70, 22) label:"Replica 1" color:purple sublabel:"region-b"
use cylinder as r2 at(70, 50) label:"Replica 2" color:purple sublabel:"region-c"
use cylinder as r3 at(70, 78) label:"Replica 3" color:purple sublabel:"region-d"

-> primary -> r1 as rep1 label:"WAL" color:purple bend:-12
-> primary -> r2 as rep2 label:"WAL" color:purple
-> primary -> r3 as rep3 label:"WAL" color:purple bend:12
-> r1 -> primary as ack1 color:green .return bend:-12
-> r2 -> primary as ack2 color:green .return
-> r3 -> primary as ack3 color:green .return bend:12

state idle:
  dim *
state write:
  active primary
state stream:
  flow rep1
  flow rep2
  flow rep3
state applied:
  active r1
  active r2
  active r3
state acked:
  flow ack1
  flow ack2
  flow ack3

idle --[500ms]--> write
write --[700ms]--> stream
stream --[1100ms ease-out]--> applied
applied --[800ms]--> acked
acked --[900ms]--> idle
```

## 6. CI pipeline (linear stages)

Many states in sequence — every box `active` in turn — to stress the timeline
builder.

```anim
[16:9 graphite-neon "CI pipeline"]
duration: 4500

use box as src at(8, 50) label:"Source" color:dim
use box as lint at(28, 50) label:"Lint" color:cyan
use box as test at(48, 50) label:"Test" color:yellow
use box as build at(68, 50) label:"Build" color:purple
use box as deploy at(88, 50) label:"Deploy" color:green

-> src -> lint as e1 color:cyan
-> lint -> test as e2 color:yellow
-> test -> build as e3 color:purple
-> build -> deploy as e4 color:green

state s0:
  dim *
state s1:
  active src
state s2:
  flow e1
  active lint
state s3:
  flow e2
  active test
state s4:
  flow e3
  active build
state s5:
  flow e4
  active deploy

s0 --[400ms]--> s1
s1 --[700ms]--> s2
s2 --[700ms]--> s3
s3 --[700ms]--> s4
s4 --[700ms]--> s5
s5 --[700ms]--> s0
```

## 7. OAuth code grant

User → app → auth → resource, with `.return` arrows for the inbound legs.

```anim
[16:9 graphite-neon "OAuth code grant"]
duration: 5400

use user as alice at(8, 50) label:"User" color:white
use browser as app at(32, 50) label:"App" color:cyan
use server as idp at(60, 50) label:"Identity provider" color:purple
use server as api at(88, 50) label:"Resource" color:green

-> alice -> app as e1 label:"open"
-> app -> idp as e2 label:"redirect" color:purple
-> idp -> app as e3 label:"code" color:purple .return
-> app -> idp as e4 label:"exchange" color:purple
-> idp -> app as e5 label:"token" color:purple .return
-> app -> api as e6 label:"GET /me" color:green
-> api -> app as e7 label:"profile" color:green .return

state idle:
  dim *
state visit:
  highlight alice
  flow e1
state redirect:
  flow e2
  active idp
state authcode:
  flow e3
state swap:
  flow e4
  flow e5
state call:
  flow e6
state done:
  flow e7
  active api

idle --[400ms]--> visit
visit --[500ms]--> redirect
redirect --[800ms]--> authcode
authcode --[700ms]--> swap
swap --[600ms]--> call
call --[700ms ease-out]--> done
done --[1000ms]--> idle
```

## 8. Kubernetes pod with sidecars (container group)

Uses the `group` directive to draw a dashed boundary around app + sidecars.

```anim
[16:9 graphite-neon "Pod with sidecars"]
duration: 4200

use server as ingress at(8, 50) label:"Ingress" color:green
use pill as proxy at(40, 22) label:"envoy" color:purple
use box as app at(40, 50) label:"app" color:cyan
use pill as logs at(40, 78) label:"fluent-bit" color:yellow
use cylinder as mesh at(82, 22) label:"Mesh CA" color:purple
use cylinder as logsink at(82, 78) label:"Loki" color:yellow

group pod contains(app, proxy, logs) label:"pod:web-7b" color:dim

-> ingress -> proxy as e1 color:purple
-> proxy -> app as e2 color:cyan
-> proxy -> mesh as e3 color:purple .dashed bend:-10
-> logs -> logsink as e4 color:yellow .dashed bend:10

state idle:
  dim *
  show pod
state arrive:
  highlight ingress
  flow e1
state intake:
  active proxy
  flow e2
state work:
  active app
state telemetry:
  flow e3
  flow e4

idle --[400ms]--> arrive
arrive --[800ms]--> intake
intake --[800ms]--> work
work --[800ms]--> telemetry
telemetry --[900ms ease-out]--> idle
```

## 9. CDN edge propagation (4:3 ratio)

Different aspect ratio, single origin fans out to global edges.

```anim
[4:3 graphite-neon "CDN propagation"]
duration: 4200

use cloud as origin at(50, 22) label:"Origin" color:purple
use box as us at(18, 70) label:"US edge" color:cyan
use box as eu at(50, 80) label:"EU edge" color:cyan
use box as apac at(82, 70) label:"APAC edge" color:cyan

-> origin -> us as e1 label:"push" color:cyan bend:-12
-> origin -> eu as e2 label:"push" color:cyan
-> origin -> apac as e3 label:"push" color:cyan bend:12

state idle:
  dim *
state ship:
  highlight origin
state distribute:
  flow e1
  flow e2
  flow e3
state ready:
  active us
  active eu
  active apac

idle --[500ms]--> ship
ship --[900ms]--> distribute
distribute --[1200ms ease-out]--> ready
ready --[900ms]--> idle
```

## 10. Active–standby failover

`hide` and `pulse color:` to convey a failure, then promotion.

```anim
[16:9 graphite-neon "Failover"]
duration: 5500

use browser as client at(10, 50) label:"Client" color:white
use box as lb at(30, 50) label:"LB" color:dim
use server as primary at(60, 28) label:"Primary" color:green
use server as standby at(60, 72) label:"Standby" color:dim
use cylinder as db at(88, 50) label:"DB" color:purple

-> client -> lb as req color:white
-> lb -> primary as p1 color:green
-> lb -> standby as p2 color:orange .dashed
-> primary -> db as q1 color:purple bend:-12
-> standby -> db as q2 color:purple bend:12

state normal:
  dim standby
  active primary
  flow req
  flow p1
  flow q1
state failure:
  pulse primary color:red
state promote:
  hide primary
  active standby
  flow p2
  flow q2

normal --[1500ms]--> failure
failure --[1000ms]--> promote
promote --[1700ms ease-out]--> normal
```

## 11. BDD scenario as a sequence

A Gherkin-style scenario, with each clause rendered as a node and a transition
per clause:

```gherkin
Feature: Read a published post

  Scenario: A logged-in reader fetches an existing post
    Given a reader has a valid session
    When they GET /hello-world
    Then the server responds with 200
    And the response body matches the post fixture
```

The diagram below traces those four clauses across the request path:

```anim
[3:2 graphite-neon "Given · When · Then · And"]
duration: 5000

use user as reader at(12, 50) label:"Reader" color:white sublabel:"Given session"
use browser as ua at(36, 50) label:"User agent" color:cyan sublabel:"When GET"
use server as srv at(64, 50) label:"Server" color:purple sublabel:"Then 200"
use cylinder as fix at(88, 50) label:"Fixture" color:green sublabel:"And match"

-> reader -> ua as click label:"open"
-> ua -> srv as get label:"GET /hello-world" color:cyan
-> srv -> fix as load label:"load" color:purple
-> fix -> srv as body label:"body" color:green .return
-> srv -> ua as ok label:"200" color:purple .return

state given:
  dim ua srv fix
  highlight reader
state when:
  flow click
  flow get
  active ua
state then:
  active srv
  flow load
  flow body
state and:
  flow ok
  active fix

given --[1000ms ease-out]--> when
when --[1100ms]--> then
then --[1100ms]--> and
and --[1300ms]--> given
```

## 12. Mobile portrait (9:16)

A vertical layout — same concepts, different aspect ratio, to confirm the
viewBox math holds up.

```anim
[9:16 graphite-neon "Mobile auth"]
duration: 4500

use user as user at(50, 8) label:"User" color:white
use browser as app at(50, 28) label:"App" color:cyan
use server as api at(50, 52) label:"API" color:green
use cylinder as db at(50, 80) label:"DB" color:purple

-> user -> app as e1
-> app -> api as e2 color:cyan
-> api -> db as e3 color:purple
-> db -> api as e4 color:purple .return
-> api -> app as e5 color:green .return

state idle:
  dim *
state tap:
  highlight user
  flow e1
state call:
  flow e2
state query:
  flow e3
state results:
  flow e4
  flow e5
  active api

idle --[500ms]--> tap
tap --[700ms]--> call
call --[800ms]--> query
query --[800ms]--> results
results --[1000ms ease-out]--> idle
```

---

That covers every symbol (`browser`, `server`, `cylinder`, `cloud`, `diamond`,
`queue`, `cache`, `user`, `box`, `pill`, `hexagon`), every color token, every
edge attribute (`.dashed`, `.return`, `bend:N`), the `group` container, four
ratios (16:9, 4:3, 9:16, 3:2), and the state effects `show`, `hide`, `flow`,
`active`, `pulse`, `highlight`, `dim`. If any of these breaks at build time
the page won't ship.
