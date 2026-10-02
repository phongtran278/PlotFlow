function safeProjectId(value = "") {
  return String(value || "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}

function scopedKey(projectId, domain, version = 1) {
  return `plotflow:${safeProjectId(projectId)}:${domain}:v${version}`;
}

function cloneFallback(value) {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
}

export function createProjectStorage(projectId, { allowLegacyFallback = false } = {}) {
  const id = safeProjectId(projectId);

  function readJson(domain, { version = 1, fallback = null, legacyKey = null } = {}) {
    const key = scopedKey(id, domain, version);
    try {
      const scoped = window.localStorage?.getItem(key);
      if (scoped !== null && scoped !== undefined) return JSON.parse(scoped);

      if (allowLegacyFallback && legacyKey) {
        const legacy = window.localStorage?.getItem(legacyKey);
        if (legacy !== null && legacy !== undefined) {
          window.localStorage?.setItem(key, legacy);
          return JSON.parse(legacy);
        }
      }
    } catch {}
    return cloneFallback(fallback);
  }

  function writeJson(domain, value, { version = 1 } = {}) {
    try {
      window.localStorage?.setItem(scopedKey(id, domain, version), JSON.stringify(value));
    } catch {}
    return value;
  }

  function remove(domain, { version = 1 } = {}) {
    try { window.localStorage?.removeItem(scopedKey(id, domain, version)); } catch {}
  }

  return {
    projectId: id,
    key: (domain, version = 1) => scopedKey(id, domain, version),
    readJson,
    writeJson,
    remove,
  };
}

export { scopedKey as projectStorageKey };
