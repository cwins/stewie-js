---
name: lightweight-adr
description: Document in a structured way when an important decision has been made about the codebase; related to the code itself, tooling, or any other aspect of the tech.
---

# Documenting Lightweight Architecture Decision Records (ADR)

## Overview

Over time, many specific technical choices are made within a codebase, and the reasoning for those choices eventually gets lost.
Lightweight Architecture Decisions Records (ADRs) are a great way to capture these choices and provide context to future contributors (including yourself and coding agents).
It makes it easier to revisit those choices in the future and continue with them or consider alternatives.
Doing this manually and intentionally takes a lot of discipline to keep up with it. Making this more automatic can give us the great benefits of Lightweight ADRs, but reduce the burden and tax of writing them and maintaining them.

This skill is influenced by the real world usage of [Peter Evans' lightweight-architecture-decision-records](https://github.com/peter-evans/lightweight-architecture-decision-records).

## When to Use

- When a change is decided that represents some particular shift in the technology. (for example: switching from Webpack to Vite, or adopting JWT for all REST APIs in the repo)
- When the user explicitly asks "Can you capture this decision?", "Document this decision record", "Create an ADR for this".
- When deciding not to do something for an important reason. (for example: not moving to library version x because it breaks with our version of Node)

**When NOT to use:**

- When the change is not architecturally significant.

## Format and Template

ADRs should be saved in `decision-records/` as markdown with a naming format that follows `xxxx-short-helpful-name.md` where the prefix is a four-digit number that increments in sequence (`xxxx` = `0001`, `0002`, `...`).

Below is the starting template format to follow for each document.

```markdown
# 0001 - Title Text that is More Verbose than The Filename

Date: YYYY-MM-DD

## Status

[Proposed, Accepted, Deprecated, Superseded]

## Context

Describe the situation, "set the stage", so people can understand the problem or current state. Provide links to GitHub issues or other relevant documents.

## Decision

Explain the decision. Be specific to the point of helpful, but not noisy. Include a sub-section for alternatives considered so people know why we're not doing those other things.

## Consequences

Be honest about tradeoffs and what happens if we do this and if we don't do this.
```

### How to Use

- The date near the top of the document represents the date the document was created and it does not change when the `Status` changes. 
- Do not ever delete an ADR file.
- Do not ever modify an ADR file once it is `Accepted`, unless you are fixing a typo, adding links, or changing the status to `Deprecated` or `Superseded`.
  - If an ADR is moved to `Deprecated` or `Superseded`, a link should be included in the `Status` section pointing to the new ADR that describes why it's being deprecated or superseded. Examples: `YYYY-MM-DD - Deprecated as described in [ADR 0114](./0114-some-other-thing)`, `YYYY-MM-DD - Superseded by [ADR 0089](./0089-some-newer-thing)`.

## Examples

- **Request mocking** [references/0001-request-mocking.md](references/0001-request-mocking.md)
- **Monorepo pnpm workspaces** [references/0002-request-mocking.md](references/0002-monorepo-pnpm-workspaces.md)
- **Structured logging** [references/0003-structured-logging.md](references/0003-structured-logging.md)
