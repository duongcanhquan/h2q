import type { ProjectWbsData } from "@/lib/domain/types";

const PREFIX = "h2q:wbs:";

export function cacheProjectWbs(projectId: string, data: ProjectWbsData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${PREFIX}${projectId}`,
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // quota / private mode — ignore
  }
}

export function readCachedProjectWbs(projectId: string): ProjectWbsData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: ProjectWbsData };
    return parsed.data ?? null;
  } catch {
    return null;
  }
}
