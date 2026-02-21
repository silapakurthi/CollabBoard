# CollabBoard — AI Cost Analysis

## 1. Development & Testing Costs

> **Note:** Development is ongoing. The costs below reflect usage through February 20, 2026 and are expected to increase as additional testing, debugging, and feature refinement continue through the end of the sprint.

### LLM API Costs (Anthropic)

| Metric | Value |
|--------|-------|
| Provider | Anthropic |
| Model | claude-sonnet-4-20250514 |
| Total tokens consumed | ~4.3M |
| Total API calls (Langfuse traces) | 667 |
| Input token cost | $12.33 |
| Output token cost | $2.87 |
| **Total LLM API cost (to date)** | **$15.20** |
| Tracking period | Feb 18–20, 2026 |
| Observability | Langfuse (all 667 traces tracked) |

### AI Development Tooling Costs

| Tool | Cost | Notes |
|------|------|-------|
| Claude Code (Max plan) | $200/month | Primary AI development tool |
| Claude Code prorated (7 days / 30 days) | ~$47 | Prorated for project duration |
| Langfuse | $0 | Free tier — used for LLM observability and trace tracking |
| Firebase (Firestore, Auth, Hosting, Functions) | $0 | Within free tier / Blaze pay-as-you-go with minimal usage |

### Total Development Cost Summary

| Category | Cost |
|----------|------|
| LLM API (AI agent — to date) | $15.20 |
| Claude Code (prorated) | ~$47.00 |
| Infrastructure & observability | $0 |
| **Total (to date)** | **~$62.20** |
| **Estimated total at project completion** | **~$70–80** |

The LLM API cost is expected to increase by $5–15 as remaining work includes additional AI agent testing, concurrent command validation, and edge case debugging.

---

## 2. Usage Patterns Observed

Data sourced from Langfuse dashboard (667 traced API calls):

| Metric | Value |
|--------|-------|
| Total traces | 667 |
| Average tokens per command | ~6,447 (~4.3M / 667) |
| Peak usage period | Feb 19–20 (bulk of AI agent development and testing) |
| Trace type | board-agent (all 667 traces) |

### Token Breakdown Per Command (Estimated Averages)

| Component | Estimated Tokens | Notes |
|-----------|-----------------|-------|
| System prompt + tool definitions | ~1,500 | Fixed per request |
| Board state context | ~2,500–4,000 | Varies with board complexity |
| User command | ~50–100 | Short natural language input |
| LLM output (tool calls + reasoning) | ~800–1,500 | More for complex/template commands |
| **Average total per command** | **~6,447** | Observed from development data |

Board state context is the largest variable. A board with 5 objects sends significantly fewer tokens than a board with 50+ objects. Production optimization should focus here.

---

## 3. Production Cost Projections

### Assumptions

| Parameter | Value | Basis |
|-----------|-------|-------|
| Average AI commands per user per session | 5 | Estimated typical whiteboard session |
| Average sessions per user per month | 10 | Moderate active usage |
| AI commands per user per month | 50 | 5 × 10 |
| Average input tokens per command | ~5,000 | Based on observed ~6,447 avg, reduced with optimization |
| Average output tokens per command | ~1,400 | Based on observed data |
| Model | Claude Sonnet 4 | |
| Input token price | $3.00 / 1M tokens | Anthropic pricing |
| Output token price | $15.00 / 1M tokens | Anthropic pricing |

### Per-Command Cost

| Component | Calculation | Cost |
|-----------|------------|------|
| Input tokens | 5,000 × $3.00 / 1M | $0.0150 |
| Output tokens | 1,400 × $15.00 / 1M | $0.0210 |
| **Total per command** | | **$0.036** |

### Monthly Cost Per User

- 50 commands/month × $0.036/command = **$1.80/user/month** (AI API only)

### Cost at Scale

| Scale | AI API Cost | Firebase Costs | Total Estimated | Per-User |
|-------|------------|----------------|-----------------|----------|
| 100 users | $180/month | ~$0 (free tier) | **~$180/month** | $1.80 |
| 1,000 users | $1,800/month | ~$50/month | **~$1,850/month** | $1.85 |
| 10,000 users | $18,000/month | ~$500/month | **~$18,500/month** | $1.85 |
| 100,000 users | $180,000/month | ~$5,000/month | **~$185,000/month** | $1.85 |

#### Firebase Cost Breakdown at Scale

| Component | 1K Users | 10K Users | 100K Users |
|-----------|----------|-----------|------------|
| Firestore reads (real-time sync) | ~$10 | ~$100 | ~$1,000 |
| Firestore writes (objects + cursors) | ~$20 | ~$200 | ~$2,000 |
| Cloud Functions invocations | ~$5 | ~$50 | ~$500 |
| Auth (MAU) | $0 | ~$50 | ~$500 |
| Hosting + bandwidth | ~$15 | ~$100 | ~$1,000 |

---

## 4. Cost Optimization Strategies

### High Impact

| Strategy | Potential Savings | Implementation Effort |
|----------|-------------------|----------------------|
| **Board state compression** | 30–50% reduction in input tokens | Medium — send only objects near viewport or relevant to the command instead of full board state |
| **Model tiering** | 50–70% for simple commands | Medium — route simple commands (create single object) to Claude Haiku ($0.25/1M input, $1.25/1M output), reserve Sonnet for complex templates |
| **Prompt caching** | 20–30% on repeated context | Low — Anthropic supports prompt caching; system prompt + tool definitions are identical across calls |

### Medium Impact

| Strategy | Potential Savings | Implementation Effort |
|----------|-------------------|----------------------|
| **Rate limiting** | Prevents abuse; caps cost exposure | Low — limit AI commands to N per user per session |
| **Command batching** | Reduces per-call overhead | Medium — combine rapid sequential commands into one API call |
| **Response streaming** | No cost savings but better UX | Low — stream tool calls as they arrive rather than waiting for full response |

### Projected Cost with Optimizations (at 10K users)

| Scenario | Monthly Cost |
|----------|-------------|
| No optimization (current) | ~$18,500 |
| With board state compression | ~$12,000 |
| With model tiering (Haiku for 60% of commands) | ~$8,500 |
| With all optimizations | ~$5,000–6,000 |

---

## 5. Key Takeaways

1. **Board state context dominates cost.** At ~5,000 tokens per request, the board state sent for AI context is 3–4× larger than the actual command and response combined. This is the highest-leverage optimization target.

2. **AI API cost scales linearly with users.** There are no economies of scale on per-token pricing. Cost control must come from reducing tokens per call or routing to cheaper models.

3. **Firebase costs are negligible at small scale** but Firestore read/write costs grow meaningfully above 10K users due to real-time cursor sync writes.

4. **Development cost was modest.** ~$62 total (prorated tooling + API) for a full-featured collaborative whiteboard with AI agent — demonstrating that AI-first development is cost-effective for rapid prototyping.

5. **Langfuse observability was critical** for understanding cost drivers. Without per-trace token tracking, the board state cost issue would not have been identified during development.