# CollabBoard Pre-Search Document

## Phase 1: Define Your Constraints

### 1. Scale & Load Profile

| Parameter | Decision | Rationale |
|-----------|----------|-----------|
| Users at launch | 5–10 (demo/evaluation) | This is a week-long sprint for Gauntlet evaluation. The spec tests with 5+ concurrent users. |
| Users at 6 months | N/A (project scope is 1 week) | Focus entirely on meeting the rubric, not long-term growth. |
| Traffic pattern | Spiky — bursts during demos and testing | Evaluators will test simultaneously. Must handle 5+ concurrent without degradation. |
| Real-time requirements | **Critical** — WebSockets required | Cursor sync <50ms, object sync <100ms. This is the core of the project. |
| Cold start tolerance | Low | Evaluators won't wait. App must load fast. Serverless cold starts for WebSocket connections are risky. |

### 2. Budget & Cost Ceiling

| Parameter | Decision | Rationale |
|-----------|----------|-----------|
| Monthly spend limit | ~$50/month during dev week | Flexible budget. Firebase Spark (free) covers most needs; Blaze (pay-as-you-go) if needed. LLM API is the main variable cost. |
| Pay-per-use vs fixed | Pay-per-use acceptable | Low traffic volume means pay-per-use is cheaper than fixed. |
| Money vs time tradeoff | **Spend money to save time.** | 24-hour MVP deadline means every hour of infrastructure setup you skip is an hour you get back for features. Use managed services aggressively. |

### 3. Time to Ship

| Parameter | Decision | Rationale |
|-----------|----------|-----------|
| MVP timeline | **24 hours** (hard gate) | Must have: infinite board, pan/zoom, sticky notes, shapes, real-time sync, cursors, presence, auth, deployed. |
| Speed vs maintainability | **Speed wins this week** | Clean code is nice; passing the gate is required. Refactor after MVP if time allows. |
| Iteration cadence | Continuous (days 2–7) | MVP → features → AI agent → polish → documentation. Ship daily. |

### 4. Compliance & Regulatory Needs

| Parameter | Decision |
|-----------|----------|
| HIPAA | No |
| GDPR | No (no EU user expectation) |
| SOC 2 | No |
| Data residency | No requirements |

This is a demo project. No compliance overhead needed.

### 5. Team & Skill Constraints

| Parameter | Decision | Implication |
|-----------|----------|-------------|
| Team size | Solo | Every architectural choice must minimize surface area. No one else to debug your infra. |
| Frontend experience | **New to frontend frameworks, but strong JS/TS** | Use TypeScript React — the language isn't new, just the framework. Lean on AI tools for React patterns (hooks, JSX) while leveraging existing JS/TS fluency. |
| WebSocket experience | **New to WebSockets, but experienced with document DBs (CosmosDB)** | Firestore's document model will feel familiar (collections, documents, queries). The real-time subscription layer (`onSnapshot`) is the only new concept. |
| Backend/API experience | **Strong — Python, REST APIs, Postman** | AI agent Cloud Function can be written in Python if preferred. REST API patterns are second nature. |
| Testing experience | **Professional-grade — Cypress, Pytest, automation** | Cypress e2e tests for multiplayer sync would elevate the submission. Plan for post-MVP automated testing. |
| Learning vs shipping | **Ship first, learn by doing** | Use AI tools for React/Konva boilerplate. Core logic (data modeling, API calls, test design) leverages existing skills. |

---

## Phase 2: Architecture Discovery

### 6. Hosting & Deployment

**Recommendation: Firebase Hosting + Cloud Functions (or Vercel for frontend)**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Firebase Hosting** | Zero-config, global CDN, free tier, auto-SSL, integrates with Firestore | Tied to Google ecosystem | ✅ **Best fit** — pairs naturally with Firestore for real-time |
| Vercel | Great React DX, fast deploys, edge functions | Need separate real-time backend | Good alternative if using Supabase |
| Render | Full server control | More setup, cold starts on free tier | Too much infra work for 24hr MVP |
| AWS (Lambda + API GW) | Scalable | Massive setup overhead, WebSocket management is complex | Overkill |

**Decision: Firebase Hosting** — deploy with one command (`firebase deploy`), free SSL, pairs with Firestore.

### 7. Authentication & Authorization

**Recommendation: Firebase Auth**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Firebase Auth** | Drop-in UI, Google/GitHub/email login, 5 min setup, free | Google lock-in | ✅ **Best fit** |
| Supabase Auth | Good, similar to Firebase | Smaller ecosystem | Good if using Supabase |
| Auth0 | Feature-rich | Overkill, separate service to manage | Too complex |
| Custom JWT | Full control | Days of work for auth alone | Absolutely not in 24 hours |

**Decision: Firebase Auth with Google Sign-In** — one provider is enough for MVP. Add email/password if time permits.

RBAC is not needed. All users on a board have equal permissions (create, edit, delete objects). Multi-tenancy is handled via board IDs in Firestore paths.

### 8. Database & Data Layer ⭐ (Most Critical Decision)

**Recommendation: Cloud Firestore**

This is the make-or-break decision. Your real-time sync layer IS your database.

| Option | Real-time built-in? | Conflict handling | Offline support | Verdict |
|--------|---------------------|-------------------|-----------------|---------|
| **Cloud Firestore** | ✅ Yes — `onSnapshot()` | Last-write-wins per field | ✅ Built-in | ✅ **Best fit** |
| Firebase Realtime DB | ✅ Yes | Last-write-wins | ✅ Built-in | Viable but less structured |
| Supabase (Postgres + Realtime) | ✅ Yes — Realtime channels | Row-level | Limited | Strong alternative |
| Custom WS + PostgreSQL | ❌ Build it yourself | Build it yourself | Build it yourself | Not viable in 24 hours |
| Liveblocks / Yjs | ✅ Purpose-built for this | CRDTs | ✅ | Excellent but adds dependency complexity |

**Decision: Cloud Firestore** for these reasons:

1. **`onSnapshot()` gives you real-time sync for free.** Every client subscribes to the board's collection. When any client writes, all others get the update instantly. No WebSocket server to build or manage.
2. **Conflict resolution is handled.** Firestore uses last-write-wins at the field level. For a whiteboard (where conflicts are "two people moved the same sticky note"), this is perfectly acceptable and explicitly allowed by the spec.
3. **Persistence is automatic.** Board state is just Firestore documents. Users leave, come back, data is there.
4. **Offline support is free.** Firestore caches locally and syncs when reconnected. This handles the "disconnect/reconnect" test scenario.
5. **Auth integration is seamless.** Firestore security rules use Firebase Auth tokens directly.

#### Data Model

```
boards/{boardId}
  ├── name: string
  ├── createdBy: string (userId)
  ├── createdAt: timestamp
  └── objects/{objectId}
        ├── type: "sticky" | "rectangle" | "circle" | "line" | "text" | "frame" | "connector"
        ├── x: number
        ├── y: number
        ├── width: number
        ├── height: number
        ├── rotation: number
        ├── text: string
        ├── color: string
        ├── style: object (stroke, fill, fontSize, etc.)
        ├── connectedTo: string[] (for connectors)
        ├── zIndex: number
        ├── lastEditedBy: string (userId)
        └── updatedAt: timestamp

boards/{boardId}/presence/{userId}
  ├── name: string
  ├── cursor: { x, y }
  ├── color: string (assigned cursor color)
  └── lastSeen: timestamp
```

**Why subcollection for objects?** Firestore charges per document read. With objects as a subcollection, you can subscribe to just the objects collection and get granular updates (only changed objects trigger callbacks), rather than reading the entire board document on every change.

**Why separate presence collection?** Cursor updates happen at ~60Hz. Mixing them with object data would cause unnecessary re-renders. Keeping presence separate lets you subscribe to it independently with different update throttling.

### 9. Backend/API Architecture

**Recommendation: Mostly serverless / client-direct-to-Firestore**

| Component | Approach |
|-----------|----------|
| Object CRUD | **Client → Firestore directly** (no backend needed) |
| Cursor sync | **Client → Firestore presence subcollection** (throttled to ~10-20 updates/sec) |
| Auth | **Client → Firebase Auth** (no backend needed) |
| AI Agent | **Client → Cloud Function → LLM API → Firestore writes** |
| Board management | **Client → Firestore** (create/join boards) |

The only backend code you need is a Cloud Function (or serverless endpoint) for the AI agent, because you shouldn't expose your LLM API key to the client.

```
[Browser] → Firebase Auth → Firestore (real-time reads/writes)
[Browser] → Cloud Function → Anthropic/OpenAI API → Firestore writes
```

This is intentionally simple. No Express server, no WebSocket server, no message queue. The less backend code you write, the more time you have for the whiteboard itself.

### 10. Frontend Framework & Rendering

**Recommendation: React + HTML5 Canvas (via Konva.js/react-konva)**

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **React** (Create React App or Vite) | Closest to your experience. Massive ecosystem. AI tools generate React best. |
| Canvas library | **react-konva** (Konva.js React bindings) | Handles canvas rendering, hit detection, drag/drop, transforms. You don't want to write raw Canvas 2D context code. |
| State management | **React useState + useReducer** | No Redux. Board state comes from Firestore subscriptions. Local UI state (selected object, tool mode) lives in React state. |
| Styling | **Tailwind CSS** | Utility-first, fast to iterate, AI tools know it well |

**Why React over other frameworks (given no frontend experience)?**

The decision hinges on react-konva, not React itself. Here's the full comparison:

| Framework | Canvas Integration | AI Code Quality | Learning Curve | Verdict |
|-----------|-------------------|-----------------|----------------|---------|
| **React + react-konva** | Declarative JSX (`<Rect draggable />`) | Excellent — most training data | Medium (JSX, hooks) | ✅ **Best overall** |
| Svelte + Konva.js (raw) | Imperative API (more manual code) | Decent but fewer examples | Low (framework) + High (raw canvas) | Good framework, worse canvas DX |
| Vue + vue-konva | Declarative but smaller ecosystem | Good but less than React | Medium | Viable but fewer resources |
| Vanilla JS + Konva.js | Imperative API | N/A | No framework overhead, but manual state management | Becomes unmanageable at this app's complexity |

The deciding factors: (1) react-konva turns canvas work into component composition, which is dramatically easier for a canvas beginner, and (2) AI coding tools generate significantly better React code than any alternative, which matters when AI-first development is the methodology.

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **Konva.js / react-konva** | React integration, built-in transforms (resize/rotate handles), drag/drop, event system, good docs | Slightly heavier | ✅ **Best for React beginners** — most features out of the box |
| Fabric.js | Feature-rich, SVG support | jQuery-era API, poor React integration | React wrapper is clunky |
| PixiJS | WebGL, best performance | Game-engine API, steeper learning curve | Overkill for whiteboard |
| Raw Canvas | No dependencies | You'd build everything from scratch | Not viable in 24 hours |

**react-konva gives you for free:**
- Infinite canvas with pan/zoom (Stage + drag + scale)
- Object selection with transform handles (Transformer component)
- Hit detection (click on shapes, drag to select)
- Layering (Group, Layer components)
- Event handling that feels like React (onClick, onDragEnd, etc.)

### 11. Third-Party Integrations

| Service | Choice | Free Tier | Cost Risk |
|---------|--------|-----------|-----------|
| Real-time DB | Firebase Firestore | 50K reads/day, 20K writes/day | Low for demo scale |
| Auth | Firebase Auth | 10K MAU free | Zero risk |
| AI LLM | **Anthropic Claude API** (or OpenAI GPT-4) | Pay per token | ~$5-20 during dev week depending on usage |
| Hosting | Firebase Hosting | 10GB/month, 360MB/day | Zero risk |
| Cloud Functions | Firebase Functions | 2M invocations/month | Zero risk |

**Vendor lock-in assessment:** Firebase lock-in is real but irrelevant for a 1-week project. If this were a production SaaS, you'd abstract the database layer. Here, embrace the lock-in for speed.

---

## Phase 3: Post-Stack Refinement

### 12. Security Vulnerabilities

| Risk | Mitigation |
|------|------------|
| Firestore rules too permissive | Write rules that scope reads/writes to authenticated users and board membership |
| LLM API key exposure | Never put it in client code. Use Cloud Functions as a proxy. |
| XSS in sticky note text | Konva renders to canvas (not DOM), so XSS is largely mitigated. Sanitize any text that goes to HTML overlays. |
| Firestore injection | Firestore is schemaless — validate object types and fields in security rules |
| Rate limiting AI commands | Add rate limiting in Cloud Function to prevent abuse |

**Minimum Firestore security rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId} {
      allow read, write: if request.auth != null;
      match /objects/{objectId} {
        allow read, write: if request.auth != null;
      }
      match /presence/{userId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### 13. File Structure & Project Organization

```
collabboard/
├── public/
├── src/
│   ├── components/
│   │   ├── Board/
│   │   │   ├── Canvas.jsx          # Main Konva Stage + Layer
│   │   │   ├── StickyNote.jsx      # Sticky note component
│   │   │   ├── Shape.jsx           # Rectangle, circle, line
│   │   │   ├── Connector.jsx       # Lines/arrows between objects
│   │   │   ├── Frame.jsx           # Grouping frames
│   │   │   ├── TextElement.jsx     # Standalone text
│   │   │   ├── SelectionBox.jsx    # Drag-to-select overlay
│   │   │   └── TransformHandler.jsx # Resize/rotate controls
│   │   ├── Toolbar/
│   │   │   ├── Toolbar.jsx         # Tool selection (select, sticky, shape, etc.)
│   │   │   └── ColorPicker.jsx
│   │   ├── Presence/
│   │   │   ├── Cursors.jsx         # Multiplayer cursor overlay
│   │   │   └── UserList.jsx        # Who's online sidebar
│   │   ├── AI/
│   │   │   ├── CommandInput.jsx    # Natural language input bar
│   │   │   └── CommandHistory.jsx  # Previous AI commands
│   │   └── Auth/
│   │       └── LoginPage.jsx
│   ├── hooks/
│   │   ├── useFirestore.js         # Board object CRUD + subscriptions
│   │   ├── usePresence.js          # Cursor + presence management
│   │   ├── useBoard.js             # Pan, zoom, viewport state
│   │   └── useAI.js                # AI command submission
│   ├── services/
│   │   ├── firebase.js             # Firebase init + config
│   │   └── ai.js                   # Cloud Function calls for AI
│   ├── utils/
│   │   ├── colors.js               # Color palettes
│   │   ├── geometry.js             # Position/size calculations
│   │   └── throttle.js             # Cursor update throttling
│   ├── App.jsx
│   └── index.js
├── functions/
│   └── index.js                    # Cloud Functions (AI agent endpoint)
├── firestore.rules
├── firebase.json
├── package.json
└── README.md
```

### 14. Naming Conventions & Code Style

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `StickyNote.jsx` |
| Hooks | camelCase with `use` prefix | `useFirestore.js` |
| Utils | camelCase | `throttle.js` |
| Firestore collections | camelCase | `boards`, `objects`, `presence` |
| Firestore fields | camelCase | `lastEditedBy`, `createdAt` |
| CSS classes | Tailwind utilities | `className="bg-yellow-200 p-4 rounded-lg"` |
| Constants | UPPER_SNAKE_CASE | `MAX_OBJECTS`, `CURSOR_THROTTLE_MS` |

Linter: ESLint with React config. Formatter: Prettier with defaults.

### 15. Testing Strategy

| Type | Tool | MVP Target |
|------|------|------------|
| Manual multi-user | 2+ browser windows | **Primary testing method for MVP** |
| Network resilience | Chrome DevTools → Network → Throttle | Required by spec |
| Performance | Chrome DevTools → Performance tab | 60 FPS, 500+ objects |
| Integration | Manually test each AI command | 6+ command types |
| **E2E (post-MVP)** | **Cypress** | Automated multiplayer sync tests — open 2 browser contexts, verify object creation/movement syncs across both. This leverages existing Cypress expertise and would strongly differentiate the submission. |
| API testing | **Postman/Newman** | Test AI agent Cloud Function endpoint independently |
| Unit tests | Jest (if time) | Nice-to-have post-MVP |

**For MVP (24 hours): manual testing only.** Open 2+ browser windows, test everything by hand. The spec's testing scenarios are all manual. Post-MVP, invest in Cypress e2e tests that mirror the spec's 5 test scenarios — this is a high-value use of your existing skills that most submissions won't have.

### 16. Recommended Tooling & DX

| Tool | Purpose |
|------|---------|
| **Claude Code** (required) | Primary AI coding tool — scaffold components, debug, generate boilerplate, run commands |
| **MCP integrations** (required) | Firestore MCP and/or filesystem MCP for Claude Code to interact with project resources |
| VS Code + ESLint + Prettier | Editor with linting (for manual review/edits alongside Claude Code) |
| Firebase Emulator Suite | Test Firestore rules and functions locally |
| Chrome DevTools | Performance profiling, network throttling |
| Multiple browser profiles | Test multiplayer without separate devices |

**Note:** Claude Code + MCP integrations satisfy the "at least two AI coding tools" requirement. Cursor is not needed — Claude Code handles scaffolding, debugging, and iterating from the terminal, while MCPs extend its capabilities to interact with Firebase, filesystem, and other services.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (React)                     │
│                                                       │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Toolbar   │  │  Canvas   │  │  AI Command Bar  │  │
│  │  (tools,   │  │  (Konva)  │  │  (natural lang)  │  │
│  │  colors)   │  │          │  │                  │  │
│  └───────────┘  └──────────┘  └──────────────────┘  │
│         │              │               │              │
│  ┌──────┴──────────────┴───────────────┴──────────┐  │
│  │           React Hooks Layer                     │  │
│  │  useBoard | useFirestore | usePresence | useAI  │  │
│  └─────────────────────┬───────────────────────────┘  │
└────────────────────────┼──────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
    ┌──────────┐  ┌───────────┐  ┌──────────────┐
    │ Firebase  │  │ Firestore │  │   Cloud       │
    │   Auth    │  │ (objects, │  │  Functions    │
    │          │  │ presence) │  │  (AI agent)   │
    └──────────┘  └───────────┘  └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Anthropic /   │
                                 │ OpenAI API    │
                                 └──────────────┘
```

---

## Build Plan (Priority Order)

### Day 1 — MVP (24 hours) 🚨 Hard Gate

| Hour Block | Task | Details |
|------------|------|---------|
| 0–1 | Pre-Search | ✅ This document |
| 1–3 | Project setup + Firebase | `create-react-app`, Firebase project, Firestore, Auth, deploy pipeline |
| 3–5 | Infinite canvas | Konva Stage with pan (drag) and zoom (scroll wheel). No objects yet. |
| 5–8 | Sticky notes + shapes | Create, render, edit text, move. Single-player first. |
| 8–12 | **Real-time sync** | `onSnapshot` subscriptions. Objects appear across browsers. This is the hardest part. |
| 12–15 | Multiplayer cursors + presence | Presence subcollection, throttled cursor updates, name labels |
| 15–18 | Auth + board management | Login page, create/join boards, security rules |
| 18–20 | Deploy + test | Firebase deploy, test with 2+ browsers, fix sync bugs |
| 20–24 | Buffer | Fix bugs, handle edge cases, ensure all MVP checkboxes pass |

### Days 2–5 — Full Feature Set

| Day | Focus |
|-----|-------|
| Day 2 | Connectors, frames, text elements, transforms (resize/rotate), multi-select |
| Day 3 | AI Agent — Cloud Function + LLM integration, 6+ commands (create, move, layout, templates) |
| Day 4 | AI complex commands (SWOT template, journey maps), polish sync edge cases, performance optimization |
| Day 5 | Testing all scenarios, documentation, demo video script |

### Days 6–7 — Polish & Submit

| Task | Details |
|------|---------|
| Performance testing | 500+ objects, 5+ users, 60 FPS target |
| Demo video | 3–5 min covering collaboration + AI commands + architecture |
| AI Dev Log | 1-page doc on tools, prompts, code analysis |
| AI Cost Analysis | Dev spend + projections at 100/1K/10K/100K users |
| README | Setup guide, architecture, deployed link |
| Social post | X/LinkedIn with screenshots and demo |

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firestore read/write limits on free tier | Could block testing | Upgrade to Blaze (pay-as-you-go) immediately if needed. 50K reads/day is generous for dev. |
| Cursor sync too slow via Firestore | >50ms latency | Throttle cursor writes to 10–20/sec. Consider Firebase Realtime DB just for cursors if Firestore is too slow. |
| react-konva learning curve | Slows MVP | Use AI tools to generate Konva boilerplate. The library has good examples. |
| AI agent commands conflict with manual edits | Broken state | AI writes go through the same Firestore path as user writes. Same conflict resolution (last-write-wins). |
| Text editing on canvas is tricky | Poor UX | Use HTML overlay (textarea) positioned over the Konva shape for editing. Don't try to do text input inside Canvas. |

---

## Decision Summary

| Decision | Choice | Confidence |
|----------|--------|------------|
| Database + Real-time | **Cloud Firestore** | High — built for this exact use case |
| Auth | **Firebase Auth (Google sign-in)** | High — 5 min setup |
| Frontend | **React + react-konva** | High — best balance of features and AI tool support |
| Hosting | **Firebase Hosting** | High — pairs with Firestore |
| AI Backend | **Cloud Functions → Claude/GPT-4 API** | High — simple, secure |
| Conflict resolution | **Last-write-wins (Firestore default)** | High — spec explicitly allows it |
| State management | **Firestore subscriptions + React hooks** | High — no extra state library needed |
| Cursor sync approach | **Firestore presence subcollection, throttled** | Medium — may need to switch to Realtime DB if latency is too high |