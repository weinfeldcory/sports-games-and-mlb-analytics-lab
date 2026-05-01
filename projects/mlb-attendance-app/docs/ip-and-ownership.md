# IP And Ownership

Date: 2026-05-01

## Project owner

Project owner: Cory Weinfeld  
Current product: Ballpark Ledger / MLB attendance tracking app

## Repo visibility recommendation

Keep the repo private during beta unless there is a deliberate reason to open-source part of the codebase.

Reasons:

- easier control over unfinished product IP
- lower accidental disclosure risk for roadmap, experiments, and beta-only logic
- cleaner future licensing decisions

## Contributor rules

- Do not commit secrets, private credentials, or service-role keys.
- Do not add third-party code, data, or assets without recording the source and license.
- Do not add MLB, team, or stadium logos, official marks, or proprietary brand assets without permission.
- Keep beta product copy and legal placeholders clearly marked as draft material until reviewed.

## Written IP assignment requirement

Any contractor, collaborator, or contributor who is not the owner should assign intellectual property to the project owner or future company in writing.

This should happen before meaningful product or code contribution, not after.

## Data source and license discipline

Before ingesting a new data source:

- document the source
- document the usage rights or license
- document any attribution requirement
- confirm the data can be stored and redistributed the way the product intends to use it

## Future LLC / assignment checklist

- form the intended company entity
- assign repo and product IP into that entity in writing
- confirm contributor assignment language points to the entity
- inventory any third-party code/data/assets already in the product
- verify domain names, hosting accounts, and Supabase ownership align with the intended entity

