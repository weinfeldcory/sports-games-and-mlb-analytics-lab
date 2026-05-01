# RFC 003: Local User Data Isolation

Status: Proposed  
Date: 2026-05-01  
Owner: Cory

---

## Summary

Ensure that each authenticated user interacts only with their own local dataset, even before cloud sync is introduced.

---

## Problem

Currently, all attendance data is stored in a shared local store (AsyncStorage).

This results in:
- multiple users on the same device seeing the same data
- no separation between accounts
- loss of trust in the product

---

## Requirements

- each user must have isolated access to:
  - attendance logs
  - suggestions (future)
  - preferences
- switching users must switch datasets
- no data leakage between users
- no backend dependency required

---

## Proposed Solution

### Storage Namespacing

All persisted data must be scoped by `userId`.

Example:

attendance_logs → attendance_logs_{userId}  
profile → profile_{userId}

---

### Active User Context

The app must track:

currentUserId

This determines which dataset is read/written.

---

### Repository Contract

All repository functions must:

- accept or derive `userId`
- read/write only within that user’s namespace

---

## Non-Goals

- cloud sync
- cross-device persistence
- merging accounts

---

## Acceptance Criteria

- user A logs in → sees only their data
- user B logs in → sees only their data
- switching accounts switches datasets immediately
- no existing data is accidentally lost (migration required)

---

## Migration

If existing data exists without user scoping:

- assign it to the first logged-in user
- ensure future writes are scoped

---

## Risks

- incorrect migration could lose data
- inconsistent userId handling could cause subtle bugs

---

## Decision

Must be implemented before further user-facing features.
