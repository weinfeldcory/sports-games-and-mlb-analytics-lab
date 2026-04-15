---
name: doc-writer
description: "Use when the user wants to draft structured product documentation, especially a problem brief. This skill currently supports one document type: a problem brief that matches the Google Docs template at https://docs.google.com/document/d/1RRlmLmSUKcmvOjxxvVvnreWBStUdBCFrB4bD7yhxEKc/edit. Use it to turn notes, project context, or repo work into a concise brief with the exact section order and metadata shape of that template."
---

# Doc Writer

## Overview

Use this skill for structured product-writing tasks. Right now the skill is intentionally narrow: it writes a `problem brief` in the exact format of the shared Google Docs template.

If the user asks for another document type, say that the skill currently supports `problem briefs` only, then either:

- draft the closest reasonable output without claiming it is a supported format, or
- extend the skill if the user wants that format to become part of the workflow

## Supported Document Type

### Problem Brief

The canonical structure lives in `references/problem-brief-template.md`.

Replicate this section order:

1. Title
2. `Date:`
3. `Author:`
4. `Supporting Documentation:`
5. `Background`
6. `Problem Statement`
7. `Method/Approach`
8. `Defining Success`

Keep the section names exact unless the user explicitly asks to rename them.

Formatting fidelity matters for this document type. When producing a Google Doc, do not stop at matching section order only. Recreate the template's font, spacing, and table structure as closely as the toolset allows.

## Workflow

### 1. Build context

Before drafting, gather enough context to write something decision-useful:

- what work has already happened
- what problem actually needs to be solved
- why now
- what supporting links or docs should be cited
- what success should look like

Use local repo context when available. If the user references a specific Google Doc, read it with Google Drive tools instead of guessing.

### 2. Draft the brief

Use the exact template order from `references/problem-brief-template.md`.

Writing rules:

- be concrete and product-oriented
- keep the writing concise
- avoid fluff, slogans, and vague strategy language
- make the problem statement specific and grounded
- make the method/approach action-oriented
- make success measurable where possible

### 3. Match the template style

The template is simple and restrained, but it is not plain text. Follow these formatting rules:

- title in `Proxima Nova`, bold, `16pt`
- metadata as separate lines:
  - `Date:`
  - `Author:`
  - `Supporting Documentation:`
- metadata text in `Proxima Nova`
- line spacing set to roughly `115`
- a horizontal divider between metadata and the main brief
- the main sections rendered as a one-column table with alternating header/content rows
- section header rows with a teal background and bold white text
- section body rows with standard white background and normal dark text
- short paragraphs over long blocks
