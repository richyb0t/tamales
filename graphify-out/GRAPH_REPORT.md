# Graph Report - tamales  (2026-11-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 451 nodes · 664 edges · 43 communities (27 shown, 16 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- adminView
- inventory.js
- cash-cut.js
- requests.js
- package.json
- reservations.js
- utils.js
- data.js
- auth.js
- branch-claim.js
- manifest.json
- inventory-admin.js
- sales.js
- flavors.js
- reservations-admin.js
- firebase.js
- nav-settings.js
- transfers.js
- history.js
- analysis.js
- layout.js
- stats.js
- voice-fill.js
- charts.js
- .prettierrc.json
- constants.js
- sw.js
- alerts.js
- audit-log.js
- state.js

## God Nodes (most connected - your core abstractions)
1. `adminView()` - 10 edges
2. `renderNow()` - 8 edges
3. `curIb()` - 8 edges
4. `err()` - 8 edges
5. `rpS()` - 7 edges
6. `nd()` - 7 edges
7. `chLeft()` - 6 edges
8. `left()` - 6 edges
9. `invView()` - 6 edges
10. `flList()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `renderNow()` --indirect_call--> `encView()`  [INFERRED]
  public/js/core/render.js → public/js/ui/views.js
- `renderNow()` --indirect_call--> `vendView()`  [INFERRED]
  public/js/core/render.js → public/js/ui/views.js
- `adminView()` --indirect_call--> `ajView()`  [INFERRED]
  public/js/ui/views.js → public/js/features/settings.js
- `adminView()` --indirect_call--> `usView()`  [INFERRED]
  public/js/ui/views.js → public/js/features/users.js
- `adminView()` --indirect_call--> `cortesView()`  [INFERRED]
  public/js/ui/views.js → public/js/features/cash-cut.js

## Import Cycles
- None detected.

## Communities (43 total, 16 thin omitted)

### Community 0 - "adminView"
Cohesion: 0.07
Nodes (13): labelControls(), render(), renderNow(), priceCard(), resView(), ajView(), usView(), rpBody() (+5 more)

### Community 1 - "inventory.js"
Cohesion: 0.11
Nodes (22): BI(), brs(), chLeft(), chLoad(), chUsed(), CL, cst(), encBlk() (+14 more)

### Community 2 - "cash-cut.js"
Cohesion: 0.11
Nodes (21): onUser(), restoreView(), startSubs(), stopSubs(), subs, corteBanner(), corteBlk(), corteCard() (+13 more)

### Community 3 - "requests.js"
Cohesion: 0.14
Nodes (19): acceptReq(), cancelHold(), cancelReq(), deliverReq(), inBanner(), lastSt, onReqs(), pin() (+11 more)

### Community 4 - "package.json"
Cohesion: 0.10
Nodes (20): shared, walk(), description, devDependencies, eslint@^9.0.0, espree@^10.0.0, globals@^15.0.0, prettier@^3.0.0 (+12 more)

### Community 5 - "reservations.js"
Cohesion: 0.19
Nodes (20): apForm(), apView(), cancelPre(), deliverPre(), nd(), pdAdd(), pdBr(), pdDate() (+12 more)

### Community 6 - "utils.js"
Cohesion: 0.14
Nodes (12): AVC, avI(), D, day(), dayAdd(), dayList(), dstr(), esc() (+4 more)

### Community 7 - "data.js"
Cohesion: 0.17
Nodes (16): RC, rcClear(), rcFetch(), rcGet(), rcSave(), rpCatOk(), rpEst(), rpF() (+8 more)

### Community 8 - "auth.js"
Cohesion: 0.17
Nodes (11): backProf(), fe(), login(), loginForm(), loginView(), mail(), pick(), pickRole() (+3 more)

### Community 9 - "branch-claim.js"
Cohesion: 0.20
Nodes (13): brTaken(), chBr(), claimOf(), clearBr(), freeBr(), lastBr(), _lastDay, pickBr() (+5 more)

### Community 10 - "manifest.json"
Cohesion: 0.12
Nodes (15): background_color, categories, description, dir, display, icons, id, lang (+7 more)

### Community 11 - "inventory-admin.js"
Cohesion: 0.33
Nodes (13): copyDay(), curIb(), drs(), dv(), invChips(), invStp(), invTot(), invTxt() (+5 more)

### Community 12 - "sales.js"
Cohesion: 0.26
Nodes (11): cartBar(), chg(), ctot(), deliver(), note(), order(), pay(), payAsk() (+3 more)

### Community 13 - "flavors.js"
Cohesion: 0.33
Nodes (11): chHead(), flav(), flList(), fsq(), grid(), gridT(), inCat(), isD() (+3 more)

### Community 14 - "reservations-admin.js"
Cohesion: 0.26
Nodes (6): admBtn(), admCard(), admFrm(), admLater(), admToday(), apViewAdm()

### Community 15 - "firebase.js"
Cohesion: 0.18
Nodes (8): app, auth, C(), cfg, db, fs, pb(), W()

### Community 16 - "nav-settings.js"
Cohesion: 0.33
Nodes (10): NAVALL, navCard(), NAVDEF, navDrag(), navOff(), navOn(), navReset(), navSel() (+2 more)

### Community 17 - "transfers.js"
Cohesion: 0.30
Nodes (8): trEl(), trForm(), trIn(), trList(), trStp(), trTxt(), trUp(), trView()

### Community 18 - "history.js"
Cohesion: 0.24
Nodes (5): anularMany(), anularR(), grpHtml(), histView(), reg()

### Community 19 - "analysis.js"
Cohesion: 0.25
Nodes (7): cpk(), dlt(), gpk(), lpk(), rpCmp(), rpControl(), rpMerma()

### Community 20 - "layout.js"
Cohesion: 0.31
Nodes (6): adNav(), go(), menu(), setTab(), setVt(), vNav()

### Community 21 - "stats.js"
Cohesion: 0.44
Nodes (9): bars(), okey(), rpAgg(), rpBrief(), rpCharts(), rpKpi(), rpMore(), rpS() (+1 more)

### Community 22 - "voice-fill.js"
Cohesion: 0.39
Nodes (8): eqw(), frac(), lev(), mic(), micUi(), NU, parseVoice(), voiceFill()

### Community 23 - "charts.js"
Cohesion: 0.50
Nodes (8): gCols(), gDonut(), gLine(), mk(), PAL, rpGraf(), svgW(), ta()

### Community 24 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): arrowParens, endOfLine, printWidth, singleQuote, tabWidth, trailingComma

### Community 25 - "constants.js"
Cohesion: 0.29
Nodes (5): CH, F, ROLE, SEC, TL

### Community 27 - "alerts.js"
Cohesion: 0.83
Nodes (3): alertCard(), chkAlerts(), lowList()

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `adminView()` connect `adminView` to `transfers.js`, `cash-cut.js`, `inventory-admin.js`, `reservations-admin.js`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `adminView()` (e.g. with `renderNow()` and `cortesView()`) actually correct?**
  _`adminView()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Should `adminView` be split into smaller, more focused modules?**
  _Cohesion score 0.07130124777183601 - nodes in this community are weakly interconnected._
- **Why does `cortesView()` connect `cash-cut.js` to `adminView`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `renderNow()` (e.g. with `adminView()` and `encView()`) actually correct?**
  _`renderNow()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `inventory.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10752688172043011 - nodes in this community are weakly interconnected._
- **Why does `err()` connect `cash-cut.js` to `requests.js`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._