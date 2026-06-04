import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseStorageStatus {
  configured: boolean;
  urlPresent: boolean;
  urlValid: boolean;
  serviceRolePresent: boolean;
  anonKeyPresent: boolean;
  mode: "supabase" | "local-json";
  host: string;
}

let cachedAdminClient: SupabaseClient | null | undefined;

function readSupabaseUrl() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function readServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

function readAnonKey() {
  return process.env.SUPABASE_ANON_KEY?.trim() ?? "";
}

function parseUrl(value: string) {
  if (!value) return { valid: false, host: "Not configured" };
  try {
    return { valid: true, host: new URL(value).host };
  } catch {
    return { valid: false, host: "Invalid URL" };
  }
}

export function getSupabaseStorageStatus(): SupabaseStorageStatus {
  const url = readSupabaseUrl();
  const serviceRoleKey = readServiceRoleKey();
  const { valid, host } = parseUrl(url);
  const configured = Boolean(url && valid && serviceRoleKey);
  return {
    configured,
    urlPresent: Boolean(url),
    urlValid: valid,
    serviceRolePresent: Boolean(serviceRoleKey),
    anonKeyPresent: Boolean(readAnonKey()),
    mode: configured ? "supabase" : "local-json",
    host,
  };
}

export function getSupabaseAdminClient() {
  const status = getSupabaseStorageStatus();
  if (!status.configured) return null;
  if (cachedAdminClient !== undefined) return cachedAdminClient;

  try {
    cachedAdminClient = createClient(readSupabaseUrl(), readServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          "x-application-name": "agent-blackbox",
        },
      },
    });
  } catch {
    cachedAdminClient = null;
  }

  return cachedAdminClient;
}
