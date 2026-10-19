#!/usr/bin/env node
/**
 * Seed Orderlo Auth users + profiles via Supabase Admin API.
 *
 * Requires (not Vite — server-side only):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-supabase-users.mjs
 *
 * Email alias: 852XXXXXXXX@orderlo.local
 * Passwords: admin `orderlo`, seed users `000000` (Supabase min length 6).
 */

import { createClient } from "@supabase/supabase-js";

const ADMIN_PHONE = "+85266169905";
const ADMIN_PASSWORD = "orderlo";
const SEED_PASSWORD = "000000";
const SEED_PHONES = [
  "+85292209785",
  "+85264630346",
  "+85290307995",
  "+85263349863",
  "+85253770765",
  "+85264035685",
  "+85262799780",
  "+85266791504",
  "+85298842619",
  "+85290158244",
];

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function phoneToEmail(phoneE164) {
  return `${phoneE164.replace(/\D/g, "")}@orderlo.local`;
}

async function upsertUser({ phone, password, status }) {
  const email = phoneToEmail(phone);
  const isAdmin = phone === ADMIN_PHONE;

  const { data: listed, error: listErr } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;

  const existing = listed.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId;
  if (existing) {
    userId = existing.id;
    const { error } = await sb.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        phone_e164: phone,
        status: isAdmin ? "enabled" : status,
      },
    });
    if (error) throw error;
    console.log(`updated auth user ${phone}`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        phone_e164: phone,
        status: isAdmin ? "enabled" : status,
      },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`created auth user ${phone}`);
  }

  const { error: profileErr } = await sb.from("profiles").upsert(
    {
      id: userId,
      phone_e164: phone,
      status: isAdmin ? "enabled" : status,
      is_admin: isAdmin,
    },
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;
  console.log(`upserted profile ${phone} (${isAdmin ? "admin" : status})`);
}

async function main() {
  await upsertUser({
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
    status: "enabled",
  });
  for (const phone of SEED_PHONES) {
    await upsertUser({
      phone,
      password: SEED_PASSWORD,
      status: "enabled",
    });
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
