import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/** The signed-in user for the current request, or null. */
export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Only allow same-site redirect targets so `?next=` cannot be used as an open
 * redirect.
 */
export function safeNextPath(value: string | string[] | undefined, fallback = "/dashboard"): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  return candidate;
}
