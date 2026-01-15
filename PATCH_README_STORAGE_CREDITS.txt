Patch: Storage (Cloud Sync) + Credits

What this patch adds:
1) Cloud Sync (server-side persistence) for projects/transactions/profile/tags:
   - If user is authenticated with Clerk (real userId), app pulls/pushes state via:
     GET  /api/state/pull
     POST /api/state/push
   - Local (no-auth) mode keeps using localStorage only.

2) Credits system (server-side):
   - 1 receipt AI read = 1 credit
   - Excel export = 200 credits
   Endpoints:
     GET  /api/credits/balance
     POST /api/credits/consume
     POST /api/credits/add  (admin/dev topup protected by ADMIN_CREDITS_TOKEN)

3) Clerk userId is now used in /app when available.
   This prevents re-entering profile on every device/browser.

IMPORTANT:
- For Clerk to work you MUST set .env.local with:
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
    CLERK_SECRET_KEY=...
  Then restart (npm run dev).

- To top up credits in dev:
    set ADMIN_CREDITS_TOKEN in .env.local (any random string),
    then POST /api/credits/add with {amount, token}

Files included in this patch are safe to overwrite.

