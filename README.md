# Orderlo

Mobile-first multi-vendor ordering for kitchenware and cooking ingredients.

## Buyer flow

1. Log in with Hong Kong phone + password (new signups await admin approval)
2. Start from **product type** or **vendor**
3. Add items — each vendor keeps a **separate cart**
4. Meet that vendor’s **MOQ** (amount or quantity)
5. Add shops (name + delivery address) under **個人資料**
6. **Copy WhatsApp message** from the cart (pick a shop first) and paste into WhatsApp yourself

## Admin flow

1. Only **+852 66169905** sees Admin; unlock with Admin PIN (default `1234`)
2. Approve / enable / disable users
3. With Supabase configured: open **Sessions** per user to see devices and revoke logins
4. Set the sales WhatsApp number and upload vendor quotations (Excel/CSV preferred)
5. Upload **overwrites** that vendor’s previous product list and bumps the quotation version

## Cloud auth (multi-device sessions)

Copy `.env.example` → `.env.local` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Apply `supabase/migrations/20261019180000_profiles_sessions.sql` in the Supabase SQL Editor.  
Disable **Confirm email** under Auth settings (phone UX uses email aliases `852XXXXXXXX@orderlo.local`).

Optional seed (service role, local only — never put the service role key on Vercel):

```bash
SUPABASE_URL=https://ovftzpdjkcsrmeyynrzf.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run seed:supabase
```

Seed passwords: admin `+85266169905` / `orderlo`; other seed phones / `000000` (6 zeros; Supabase Auth min length).

Without these env vars the app stays local-first (cart/catalog/login still work). Admin shows “cloud auth not configured” in the Sessions area.

## Run

```bash
npm install
npm run dev -- --host
```
