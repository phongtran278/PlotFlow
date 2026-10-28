import { createContext, useContext, useMemo } from "react";
import { createProjectStorage } from "./ProjectStorage.js";

const ProjectContext = createContext(null);

export function ProjectProvider({ project, children }) {
  const projectId = project?.id || "default";
  const allowLegacyFallback = Boolean(project?.profile?.legacyStorage);
  const storage = useMemo(
    () => createProjectStorage(projectId, { allowLegacyFallback }),
    [projectId, allowLegacyFallback],
  );
  const value = useMemo(
    () => ({ project, projectId, profile: project?.profile || null, storage }),
    [project, projectId, storage],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext() {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProjectContext must be used inside ProjectProvider.");
  return value;
}
