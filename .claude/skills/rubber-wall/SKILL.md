---
name: rubber-wall
description: When you need to bounce ideas off of someone or get a general review of an idea before you work on it. The idea is to mimic what you would get by talking through something with an experienced co-worker before starting on the actual work.
---

# Bouncing ideas off the rubber wall

## Overview

The goal is to get meaningful feedback before moving forward with a proposal to change architecture, patterns, API contracts, etc. An agent should lean towards spawning a subagent to be the "rubber wall" to add another perspective to a conversation. If subagents are not available, the agent should switch to a different persona during the review as not to overly agree with everything that's being proposed. The user should provide a clear dynamic, meaning: whether they are simply asking the agent to be the rubber wall for their idea, if the agent an human are discussing pros and cons of a particular change and need another opinion to identify any gaps, flaws, or open questions. The rubber wall is not meant to be an echo chamber that just agrees with everything, nor is it meant to be contentious. It should be an unbias, deep assessment of the change being discussed.

## When to Use

- If the user says something similar to "I need you to be my rubber wall", "Let me bounce an idea off of you".
- If the user says something similar to "Ask a subagent to be the rubber wall for this", "Ask a subagent to review this idea and see what they think".
- When there seems to be sizeable disagreement between the user and the main agent, and a third perspective would be valuable.
- When the user appears to be in a mode of just "thinking out loud" and would benefit from a structured review of their described change or idea.
- When the user or agent is propising a change that's considered a relatively large shift in the architecture or would introduce a breaking change or large change to the API surface.

**When NOT to use:**

- The change is very small, unless the user specifically asks for a rubber wall.
- The change touches a lot of files, but is not a significant change in functionality. (such as updating a handful of imports across dozens of files)

## Examples

### Lengthy discussion between human and agent

Situation: The user and the agent have a healthy back and forth about some new changes to the framework represented in the codebase they are working in. They both finally agree on the new methods and types that will be added.

What should happen: The agent recognizes the effort to get to agreement that the scope of the change is somewhat large. Before proceeding, the agent should ask the user something along the lines of "I'm glad we have agreed on a path forward. I suggest we bounce this off a separate subagent to help identify if we have overlooked anything. Would you like me to do that now?"

Possible outcome: User says "yes" and the primary agent spawns a subagent to be the "rubber wall". The subagent reviews the proposed changes, asks a couple clarifying questions back to the primary agent, then gives their final assessment. A simplified version of the actual response might resemble something like: "Overall, the change makes sense and I believe it's the right way to address the identified issue. However, your additional utility methods make the API more cumbersome and can be simplified into fewer methods that accept some simple arguments. For example, `modifyName(name: string)`, `modifyColor(color: string)` could be rolled into `modify({ name?: string; color?: string })` There are also the following edge cases that might be getting overlooked based on the information you provided me: ..."
