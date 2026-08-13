# Execution Flow

This file documents how execution travels between files, functions, routes, controllers, models, middleware, views, and utilities.
Update it whenever a change modifies a meaningful path through the application.

## Working Rule

For each meaningful code change, document:

- Entry point: route, command, request, event, or module where execution begins.
- Flow path: files and functions called in order.
- Modified nodes: exact files/functions changed during the work.
- Data movement: important request fields, model fields, session values, or side effects.
- Failure paths: validation, authorization, error handling, redirects, or fallbacks.

## Current Change Scope

### 2026-08-11 - Documentation Governance

Entry point: project maintenance workflow.

Flow path:

1. User requests a persistent decision log and execution flow document.
2. AI updates `Decision.md` with the reasoning standard.
3. AI updates `FLOW.MD` with the traceability standard.
4. Before future major changes, AI quizzes the user on the relevant topic and waits for approval after the user passes.

Modified nodes:

- `Decision.md`
- `FLOW.MD`

Data movement:

- No application runtime data is affected.

Failure paths:

- If a future change is major and the quiz is not passed or approval is not given, the code change must not proceed.

