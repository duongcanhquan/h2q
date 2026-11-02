"use client";

import { useCallback, useEffect, useState } from "react";
import { getProjectWbs } from "@/lib/frappe/client";
import { cacheProjectWbs, readCachedProjectWbs } from "@/lib/offline/wbs-cache";
import type { TaskRow } from "@/lib/frappe/types";
import { FrappeApiError } from "@/lib/frappe/errors";
import { drainLocalMeasurementQueue } from "@/lib/supabase/measurements";

export function useProjectWbs(projectId: string) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projectName, setProjectName] = useState(projectId);
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
      void drainLocalMeasurementQueue();
    } catch (err) {
      const cached = readCachedProjectWbs(projectId);
      if (cached) {
        setOffline(true);
        setProjectName(cached.project_name || projectId);
        setTasks((cached.tasks || []).filter((t) => !t.is_group));
      } else {
        setError(
          err instanceof FrappeApiError || err instanceof Error
            ? err.message
            : "Không tải được WBS từ get_project_wbs",
        );
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

  return { tasks, projectName, loading, offline, error, reload };
}
