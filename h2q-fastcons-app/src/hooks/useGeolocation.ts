"use client";

import { useCallback, useState } from "react";

export type GeoFix = {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
};

export function useGeolocation() {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const capture = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Thiết bị không hỗ trợ GPS");
      return;
    }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: Date.now(),
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Không lấy được GPS");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
    );
  }, []);

  return { fix, loading, error, capture, setFix };
}
