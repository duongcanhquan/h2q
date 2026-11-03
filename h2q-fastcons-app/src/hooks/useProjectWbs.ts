"use client";

import { useCallback, useEffect, useState } from "react";
import { getProjectWbs } from "@/lib/api/client";
import { cacheProjectWbs, readCachedProjectWbs } from "@/lib/offline/wbs-cache";
import type { TaskRow } from "@/lib/domain/types";
import { ApiError } from "@/lib/api/errors";
import { drainLocalMeasurementQueue } from "@/lib/supabase/measurements";

export function useProjectWbs(projectId: string) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projectName, setProjectName] = useState(projectId);
  const [geofence, setGeofence] = useState<Array<[number, number]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    setOffline(false);
    try {
      const data = await getProjectWbs(projectId);
      cacheProjectWbs(projectId, data);
      setProjectName(data.project_name || projectId);
      setTasks((data.tasks || []).filter((t) => !t.is_group));
      setGeofence(data.site_geofence?.ring?.length ? data.site_geofence.ring : null);
      void drainLocalMeasurementQueue();
    } catch (err) {
      const cached = readCachedProjectWbs(projectId);
      if (cached) {
        setOffline(true);
        setProjectName(cached.project_name || projectId);
        setTasks((cached.tasks || []).filter((t) => !t.is_group));
        setGeofence(cached.site_geofence?.ring?.length ? cached.site_geofence.ring : null);
      } else {
        setError(err instanceof ApiError || err instanceof Error ? err.message : "Không tải được hạng mục");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // Defer so the effect itself does not synchronously setState (React Compiler lint).
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
