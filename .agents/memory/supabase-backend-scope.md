---
name: Existing Supabase backend scope
description: User's constraint for the React migration and backend changes.
---

For the React and TypeScript rebuild, preserve the currently connected Supabase project and its existing tables, policies, RPCs, Edge Functions, and other database objects. Do not delete, migrate, or modify them without explicit approval.

Also preserve existing project files and behavior. Do not change balances or subscription records, create fake financial data, duplicate backend objects, or weaken RLS.

**Why:** The user explicitly asked for a read-only recovery audit and set these data-protection constraints.

**How to apply:** Build the frontend against the existing API. Request approval and inspect the backend before any schema, policy, function, financial-data, or other backend changes.
