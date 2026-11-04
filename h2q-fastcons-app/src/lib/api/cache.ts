type Hit = { at: number; status: number; body: unknown };

const memory = new Map<string, Hit>();
const flights = new Map<string, { id: number; promise: Promise<{ ok: boolean; status: number; body: unknown }> }>();
let flightSeq = 0;

/** Keep list screens warm across navigation; field forms still force-refresh when needed. */
const FRESH_MS = 90_000;

export function peek(url: string) {
  return memory.get(url) || null;
}

export function invalidate(url?: string) {
  if (!url) {
    memory.clear();
    return;
  }
  for (const key of memory.keys()) {
    if (key === url || key.startsWith(`${url}?`) || key.startsWith(`${url}/`)) memory.delete(key);
  }
}

/** Invalidate only the families touched by a mutation — avoid wiping unrelated caches. */
export function invalidateAfterMutation(path: string) {
  const base = path.split("?")[0];
  if (base.startsWith("/api/auth/login") || base.startsWith("/api/auth/logout")) {
    memory.clear();
    return;
  }
  if (base.startsWith("/api/measurements") || base.startsWith("/api/approvals")) {
    invalidate("/api/approvals");
    invalidate("/api/projects");
    return;
  }
  if (base.startsWith("/api/diaries")) {
    invalidate("/api/diaries");
    return;
  }
  if (base.startsWith("/api/documents")) {
    invalidate("/api/documents");
    return;
  }
  if (base.startsWith("/api/photos")) return;
  if (base.startsWith("/api/admin")) {
    invalidate("/api/admin");
    invalidate("/api/auth/session");
    return;
  }
  if (base.startsWith("/api/registers/")) {
    invalidate(base);
    return;
  }
  if (base.startsWith("/api/projects")) {
    invalidate("/api/projects");
    return;
  }
  for (const key of [...memory.keys()]) {
    if (key.startsWith("/api/auth/session") || key.startsWith("/api/settings")) continue;
    memory.delete(key);
  }
}

export async function getJson(url: string, force = false) {
  if (!force) {
    const hit = memory.get(url);
    if (hit && Date.now() - hit.at < FRESH_MS) {
      return { ok: hit.status >= 200 && hit.status < 300, status: hit.status, body: hit.body };
    }
    const pending = flights.get(url);
    if (pending) return pending.promise;
  }

  const id = ++flightSeq;
  const job = (async () => {
    const response = await fetch(url, { credentials: "include" });
    const body = (await response.json().catch(() => ({}))) as unknown;
    if (response.ok) memory.set(url, { at: Date.now(), status: response.status, body });
    return { ok: response.ok, status: response.status, body };
  })().finally(() => {
    const current = flights.get(url);
    if (current?.id === id) flights.delete(url);
  });

  flights.set(url, { id, promise: job });
  return job;
}

export function warm(url: string) {
  const hit = memory.get(url);
  if (hit && Date.now() - hit.at < FRESH_MS) return;
  if (flights.has(url)) return;
  void getJson(url).catch(() => undefined);
}

/** Prefetch common screens after login / on idle. */
export function warmShell() {
  warm("/api/projects");
  warm("/api/approvals");
  warm("/api/auth/session");
  warm("/api/settings");
}
