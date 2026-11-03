/** Same rules as h2q_core/geo.py. Ring points are [lat, lng]. */

export type GeofenceVerdict = {
  action: "ok" | "warn" | "block";
  outside: 0 | 1;
  reason: string;
  message: string;
};

export function pointInRing(lat: number, lng: number, ring: Array<[number, number]>): boolean {
  if (ring.length < 3) return false;
  if (onBoundary(lat, lng, ring)) return true;
  let inside = false;
  let j = ring.length - 1;
  for (let i = 0; i < ring.length; i += 1) {
    const [latI, lngI] = ring[i]!;
    const [latJ, lngJ] = ring[j]!;
    const intersects = lngI > lng !== lngJ > lng;
    if (intersects) {
      const latAt = ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;
      if (lat < latAt) inside = !inside;
    }
    j = i;
  }
  return inside;
}

export function evaluateGeofence(
  policy: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
  ring: Array<[number, number]> | null | undefined,
): GeofenceVerdict {
  const mode = policy === "Warn" || policy === "Block" ? policy : "Off";
  if (mode === "Off") return { action: "ok", outside: 0, reason: "off", message: "" };
  if (!ring || ring.length < 3) {
    return { action: "ok", outside: 0, reason: "no_fence", message: "" };
  }
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    const message = "Công trường đã có vùng GPS nhưng phiếu chưa có toạ độ.";
    return {
      action: mode === "Block" ? "block" : "warn",
      outside: 1,
      reason: "missing_gps",
      message,
    };
  }
  if (pointInRing(lat, lng, ring)) {
    return { action: "ok", outside: 0, reason: "inside", message: "" };
  }
  const message = "Vị trí gửi phiếu nằm ngoài vùng công trường.";
  return {
    action: mode === "Block" ? "block" : "warn",
    outside: 1,
    reason: "outside",
    message,
  };
}

function onBoundary(lat: number, lng: number, ring: Array<[number, number]>): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i += 1) {
    const [latA, lngA] = ring[i]!;
    const [latB, lngB] = ring[(i + 1) % n]!;
    const cross = (lng - lngA) * (latB - latA) - (lat - latA) * (lngB - lngA);
    if (Math.abs(cross) > 1e-12) continue;
    if (
      lat >= Math.min(latA, latB) - 1e-12 &&
      lat <= Math.max(latA, latB) + 1e-12 &&
      lng >= Math.min(lngA, lngB) - 1e-12 &&
      lng <= Math.max(lngA, lngB) + 1e-12
    ) {
      return true;
    }
  }
  return false;
}
