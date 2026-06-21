"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente do CRM no browser (mantém a sessão em cookies via @supabase/ssr). */
export const crmBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_CRM_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_CRM_KEY!
);
