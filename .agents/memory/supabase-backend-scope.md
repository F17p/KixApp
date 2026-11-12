---
name: Existing Supabase backend scope
description: User's constraint for the React migration and backend changes.
---

For the React and TypeScript rebuild, preserve the currently connected Supabase project and its existing tables, policies, RPCs, Edge Functions, and other database objects. Do not delete, migrate, or modify them without explicit approval.

**Why:** The user explicitly asked to preserve the backend and avoid changing existing database objects.

**How to apply:** Build the frontend against the existing API. Request approval and inspect the backend before any schema, policy, function, or other database-object changes.
