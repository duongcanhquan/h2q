"use client";

import { useEffect, useState } from "react";
import { getH2qSettings } from "@/lib/api/client";
import type { H2qPublicSettings } from "@/lib/domain/types";

const CACHE_KEY = "h2q_settings_public_v1";

const FALLBACK: H2qPublicSettings = {
  enable_measurement_book: 1,
  enable_site_diary: 1,
  enable_client_ra_billing: 0,
  enable_offline_sync: 1,
  dashboard_progress_source: "BOQ Qty",
  ui_profile: "Field Gloves",
  allow_mobile_revise_rejected: 1,
  boq_over_limit_policy: "Warn",
  auto_request_approval_default: 1,
  gps_required: 0,
  geofence_enforcement: "Off",
  min_photos_on_submit: 0,
  min_photos_on_approve: 0,
  sync_retry_max: 5,
  pending_ttl_hours: 72,
  telegram_enabled: 1,
};

function readCache(): H2qPublicSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as H2qPublicSettings) : null;
  } catch {
    return null;
  }
}

export function useH2qSettings() {
  const [settings, setSettings] = useState<H2qPublicSettings>(
    () => readCache() || FALLBACK,
  );
  const [loading, setLoading] = useState(!readCache());
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getH2qSettings();
        if (cancelled) return;
        setSettings(data);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        setError("");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Không tải được H2Q Settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading, error };
}
