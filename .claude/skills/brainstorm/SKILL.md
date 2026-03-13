---
description: Interactive brainstorming sessions for ideas, features, and tasks. Use when the user says "brainstorm", wants to think through an idea, explore options for a task, flesh out a vague concept, or plan an approach to something in ./tasks. Also trigger when the user says things like "help me think through", "what are my options for", or "let's explore" — anything that signals open-ended ideation rather than direct execution.
---

# Brainstorm

Run an interactive brainstorming session. The user brings a seed — a vague idea, a half-formed feature concept, or a task from `./tasks/` — and you help them think it through by asking probing questions and surfacing options.

## How it works

This is a conversation, not a monologue. Your job is to draw out the user's thinking, not to dump a list of suggestions. Ask one or two focused questions at a time using AskUserQuestion, offer concrete options when helpful, and let the user steer.

## Step 1: Understand the seed

Figure out what the user wants to brainstorm.

- If they reference a task file (e.g., `/brainstorm the list view task`), read it from `./tasks/`.
- If they pass a description inline (e.g., `/brainstorm adding a dark mode`), use that.
- If they just say `/brainstorm` with nothing else, ask what they'd like to brainstorm.

Once you have the seed, read any relevant code or files to ground yourself in the current state of things. Don't brainstorm in a vacuum — understand what exists.

## Step 2: Interview

Ask questions to narrow scope and surface constraints. Use AskUserQuestion for each round so the user gets a clean prompt. Good questions to weave in (not all at once — pick what's relevant):

- **Goal**: "What's the main thing you want this to achieve?"
- **Users**: "Who is this for? Just you, or other people too?"
- **Constraints**: "Any technical constraints or things you want to avoid?"
- **Scope**: "Are you thinking quick-and-dirty or polished?"
- **Priority**: "What matters most — speed, UX, simplicity?"
- **Inspiration**: "Have you seen this done well somewhere else?"

When you ask a question, provide 2-4 concrete options where it makes sense. Options help the user react rather than generate from scratch, which is faster and often sparks better ideas. Format options clearly:

```
A) Minimal — just add X to the existing Y
B) Moderate — build a new Z component with W
C) Full — redesign the whole flow around Q
```

Don't be afraid to suggest bold or unexpected options alongside safe ones. The point of brainstorming is to expand the space before narrowing it.

## Step 3: Synthesize

After 3-5 rounds of questions (or when the user signals they've got enough clarity), summarize what you've landed on:

1. **The approach** — a short description of what they're going to build/do
2. **Key decisions** — the choices they made during the conversation
3. **Open questions** — anything still unresolved
4. **Suggested next steps** — concrete actions (create a task, start coding, sketch a design, etc.)

Ask the user if they want to capture this as a task in `./tasks/` or if they're ready to start working on it directly.

## Tone

Be a thinking partner, not a lecturer. Keep it conversational. It's fine to push back, suggest alternatives, or play devil's advocate — that's what makes brainstorming useful. But always defer to the user's judgment on what direction to go.
