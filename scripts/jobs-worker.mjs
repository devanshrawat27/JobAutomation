#!/usr/bin/env node
/**
 * Background job scanner.
 *
 * Calls the app's own /api/jobs/sync endpoint on a timer so the posting store
 * keeps up without a cron daemon, then prints one line per scan. The endpoint
 * requires the server-only secret; set the same JOBS_WORKER_SECRET here and in
 * the app's environment.
 *
 * Usage: node scripts/jobs-worker.mjs [intervalMinutes]
 * Default: every 15 minutes, first scan immediately.
 */

const base = process.env.APP_URL ?? "http://localhost:3001";
const secret = (process.env.JOBS_WORKER_SECRET ?? "").trim();
const minutes = Number(process.argv[2] ?? process.env.SCAN_MINUTES ?? 15);
const interval = Math.max(1, minutes) * 60_000;

const stamp = () => new Date().toISOString().slice(11, 19);

if (!secret) {
  console.error("JOBS_WORKER_SECRET is not set — the scan endpoint will refuse the request.");
  process.exit(1);
}

async function scanOnce() {
  const started = Date.now();
  try {
    const response = await fetch(`${base}/api/jobs/sync`, {
      method: "POST",
      headers: { "x-worker-secret": secret },
    });
    const body = await response.json();

    if (!response.ok || !body.ok) {
      console.error(`[${stamp()}] scan failed: ${body.error ?? response.status}`);
      return;
    }

    const failed = body.errors?.length ? ` · errors: ${body.errors.join(" | ")}` : "";
    console.log(
      `[${stamp()}] scanned ${body.seen} postings from ${body.boards.length} boards in ${Math.round(
        (Date.now() - started) / 1000,
      )}s · new ${body.created} · changed ${body.updated} · closed ${body.closed}${failed}`,
    );
  } catch (error) {
    console.error(`[${stamp()}] scan failed: ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`job worker · ${base} · every ${Math.max(1, minutes)} min`);
await scanOnce();
setInterval(scanOnce, interval);
