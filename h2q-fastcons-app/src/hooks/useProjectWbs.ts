"use client";

import { useCallback, useEffect, useState } from "react";
import { getProjectWbs } from "@/lib/api/client";
import { cacheProjectWbs, readCachedProjectWbs } from "@/lib/offline/wbs-cache";
import type { TaskRow } from "@/lib/domain/types";
import { ApiError } from "@/lib/api/errors";
import { drainLocalMeasurementQueue } from "@/lib/supabase/measurements";

function applyWbs(
  projectId: string,
  data: { project_name?: string; tasks?: TaskRow[]; site_geofence?: { ring?: Array<[number, number]> } | null },
  setters: {
    setProjectName: (v: string) => void;
    setTasks: (v: TaskRow[]) => void;
    setGeofence: (v: Array<[number, number]> | null) => void;
  },
) {
  setters.setProjectName(data.project_name || projectId);
  setters.setTasks((data.tasks || []).filter((t) => !t.is_group));
  setters.setGeofence(data.site_geofence?.ring?.length ? data.site_geofence.ring : null);
}

export function useProjectWbs(projectId: string) {
  const cached = typeof window !== "undefined" ? readCachedProjectWbs(projectId) : null;
  const [tasks, setTasks] = useState<TaskRow[]>(() =>
    cached ? (cached.tasks || []).filter((t) => !t.is_group) : [],
  );
  const [projectName, setProjectName] = useState(() => cached?.project_name || projectId);
  const [geofence, setGeofence] = useState<Array<[number, number]> | null>(() =>
    cached?.site_geofence?.ring?.length ? cached.site_geofence.ring : null,
  );
  const [loading, setLoading] = useState(!cached);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const hadCache = Boolean(readCachedProjectWbs(projectId));
    if (!hadCache) setLoading(true);
    setError("");
    setOffline(false);
    try {
      const data = await getProjectWbs(projectId);
      cacheProjectWbs(projectId, data);
      applyWbs(projectId, data, { setProjectName, setTasks, setGeofence });
      void drainLocalMeasurementQueue();
    } catch (err) {
      const fallback = readCachedProjectWbs(projectId);
      if (fallback) {
        setOffline(true);
        applyWbs(projectId, fallback, { setProjectName, setTasks, setGeofence });
      } else {
        setError(err instanceof ApiError || err instanceof Error ? err.message : "Không tải được hạng mục");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void reload();
    }, 0);
    const onOnline = () => {
      void drainLocalMeasurementQueue();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", onOnline);
    };
  }, [reload]);

  return { tasks, projectName, geofence, loading, offline, error, reload };
}
