# Phase 1: Earnings persistence

This development branch prepares a shared Supabase earnings database and scheduled Finnhub ingestion, without switching existing frontend routes or deploying to production.

Before activation:
1. Apply a reviewed database migration to the correct Supabase project.
2. Configure server-only Supabase and Finnhub credentials in Vercel.
3. Configure a protected daily ingestion schedule appropriate for the Vercel plan.
4. Verify imported companies and earnings events before changing frontend reads.

Existing user_state, SEC integration, and transcript/audio routes should remain unchanged.
