# AI Development Log

## Tools & Workflow

**Primary Tool:** Claude Code (VS Code extension)
- Used for: project scaffolding, component generation, Firebase integration, debugging, implementing real-time sync, AI agent, and testing infrastructure
- Workflow: structured prompts for each feature layer, built vertically (one layer complete before starting next)

**Secondary Tool:** MCP Integrations
- **Context7 MCP** (@upstash/context7-mcp): Fetches up-to-date, version-specific documentation for libraries directly into Claude Code prompts. Used for referencing current React-Konva, Firebase, Playwright, and Tailwind CSS docs during development without relying on stale training data.

**Supporting:** Claude.ai (claude.ai web interface)
- Used for: project planning, Pre-Search checklist, architecture decisions, PRD creation, demo planning
- Not a coding tool but integral to the AI-first methodology for planning and documentation

## MCP Usage

### Context7 MCP (@upstash/context7-mcp)
- **What it does:** Dynamically fetches current, version-specific documentation and code examples from official library sources and injects them into Claude Code prompts.
- **How it was used:** Added `use context7` to prompts when working with libraries to get accurate, up-to-date API references instead of relying on potentially stale training data.
- **Tasks it helped with:**
  - React-Konva API (Stage, Layer, Transformer props and event handlers)
  - Firebase Firestore patterns (onSnapshot, batch writes, serverTimestamp)
  - Playwright test patterns (browser contexts, page fixtures, expect assertions)
  - Tailwind CSS utility classes and responsive patterns
- **Configuration:** Project-level `.mcp.json` with `npx -y @upstash/context7-mcp@latest`

## Effective Prompts

### Prompt 1 — Project Scaffold
"Create a new project called collabboard with Vite + React + TypeScript, install react-konva, firebase, tailwindcss, react-router-dom, initialize Firebase, create project file structure with components/hooks/services/types folders..."
**Why it worked:** Comprehensive single prompt that set up the entire project foundation in one pass.

### Prompt 2 — Real-Time Sync
"Replace the local state object storage with Firestore for real-time sync. Subscribe to boards/{boardId}/objects using onSnapshot. On snapshot updates convert docs to Map<string, BoardObject>..."
**Why it worked:** Explicit data model and subscription pattern gave Claude Code enough context to wire up Firestore correctly on the first attempt.

### Prompt 3 — Multiplayer Cursors
"Implement multiplayer cursors and presence awareness. Write presence to boards/{boardId}/presence/{userId}. Throttle cursor writes to every 50-80ms..."
**Why it worked:** Specifying the throttle rate and separation of concerns (presence subcollection vs objects) prevented performance issues.


## Code Analysis
- Estimated AI-generated code: 100%
- Estimated hand-written/modified code: 0%
- AI generated all of the code including boilerplate, component structure, and Firebase integration


## Strengths & Limitations

### Where AI Excelled
- Project scaffolding and boilerplate generation
- Firebase/Firestore integration patterns
- React component structure
- Translating architecture decisions into implementation
- Generating Playwright test structures

### Where AI Struggled
- AI got the initial feature implementation of AI Agent correctly but it struggled to make it work accurately. Initially it couldn't do certain operations or would create objects that are exceeding the frame borders or would just create on top of existing objects. Needed bit of back and forth and streamlining to make things work correctly
- AI was able to get the basic tests correctly but it struggled to identify all the tests needed and making them pass. It would give up multiple times and I had give it inputs to get the tests right. 

## Key Learnings
- Structured, detailed prompts with explicit data models produce better results than vague instructions
- Building vertically (completing one layer before starting the next) works well with AI coding tools
- AI-first development is most effective when you plan the architecture thoroughly before generating any code (Pre-Search process)
