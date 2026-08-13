# Decision Log

This file records meaningful implementation decisions made while changing the codebase.
Each entry should explain the choice, the alternatives considered, and the tradeoff accepted.

## 2026-08-11 - Maintain Decision And Flow Documentation

### Decision
Maintain `Decision.md` for reasoning behind code changes and `FLOW.MD` for execution traceability.
Before any major change, ask the project owner a short quiz about the related topic and proceed only if they approve after passing.

### Reasoning
Code diffs show what changed, but not why a path was chosen. A durable decision log prevents future work from re-opening settled tradeoffs without context.
Flow documentation makes cross-file behavior visible, which is where many regressions hide.

### Tradeoff
This adds a small documentation cost to each meaningful change. The cost is accepted because it improves maintainability, review quality, and future debugging.

### Alternatives Considered
- Rely only on commit messages: rejected because they are harder to browse alongside code and may not exist for every local change.
- Put reasoning only in code comments: rejected because comments should explain local complexity, not project-level decision history.

