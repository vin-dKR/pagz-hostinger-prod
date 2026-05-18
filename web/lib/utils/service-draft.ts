/**
 * Service Draft Persistence Utility
 *
 * Persists in-progress service configuration (paper size, copies, addons,
 * uploaded file URLs, page count, etc.) to `sessionStorage` so a page
 * refresh does NOT wipe the user's selections.
 *
 * Storage shape: one entry per category slug, keyed `serviceDraft:${slug}`.
 *
 * Design notes:
 *   - Only durable references are persisted. `File` blobs are NEVER stored;
 *     we keep the FTP URL (`url`) + filename / size / pageCount so the UI
 *     can render the "already uploaded" state without re-prompting.
 *   - TTL: 24h. A draft older than 24h is treated as missing and is
 *     self-cleared on read so stale state can't bleed into a new session.
 *   - SSR-safe — every entry point guards `typeof window`.
 *   - Corrupt JSON is swallowed and self-clears (returns null) so a bad
 *     payload from a previous deploy doesn't crash the page.
 *
 * Coexists with — but is distinct from — `templateDraftData:${slug}` and
 * the `selectedTemplateData` / `uploadedFileData` session keys used by the
 * template-selection flow.
 */

const KEY_PREFIX = 'serviceDraft:';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface ServiceDraftFile {
    /** Durable FTP path / URL returned by the upload endpoint. */
    url: string;
    name: string;
    size: number;
    pageCount?: number;
}

export interface ServiceDraft {
    selectedSpecifications: Record<string, string>;
    copies: number;
    selectedAddons: string[];
    uploadedFiles: ServiceDraftFile[];
    pageCount: number;
    /** Map of spec slug → user-chosen half-page flag. Optional — only some
     *  categories expose half-page UI. */
    halfPageAdjustments?: Record<string, boolean>;
    /** Map of filename → password the user entered for a protected PDF. */
    pdfPasswords?: Record<string, string>;
    savedAt: number;
}

const storageKey = (slug: string): string => `${KEY_PREFIX}${slug}`;

const getStorage = (): Storage | null => {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage;
    } catch {
        // Browsers can throw on sessionStorage access in private/locked-down modes.
        return null;
    }
};

/**
 * Persist an in-progress service draft for the given category slug.
 *
 * `savedAt` is stamped here so callers don't have to track time.
 * No-op on the server / when storage is unavailable / when serialization
 * fails (e.g. quota exceeded) — failure to persist must never break the
 * configurator flow.
 */
export function saveDraftServiceConfig(
    slug: string,
    draft: Omit<ServiceDraft, 'savedAt'>,
): void {
    if (!slug) return;
    const storage = getStorage();
    if (!storage) return;
    try {
        const payload: ServiceDraft = { ...draft, savedAt: Date.now() };
        storage.setItem(storageKey(slug), JSON.stringify(payload));
    } catch {
        // Best-effort: ignore quota / serialization errors silently.
    }
}

/**
 * Load the draft for the given slug. Returns null when:
 *   - running on the server,
 *   - no draft is stored,
 *   - the stored payload is older than the TTL (auto-cleared), or
 *   - the JSON is corrupt (auto-cleared).
 */
export function getDraftServiceConfig(slug: string): ServiceDraft | null {
    if (!slug) return null;
    const storage = getStorage();
    if (!storage) return null;

    const key = storageKey(slug);
    let raw: string | null;
    try {
        raw = storage.getItem(key);
    } catch {
        return null;
    }
    if (!raw) return null;

    let parsed: ServiceDraft;
    try {
        parsed = JSON.parse(raw) as ServiceDraft;
    } catch {
        // Corrupt — self-clear so we don't keep returning null with a stale key occupying space.
        try {
            storage.removeItem(key);
        } catch {
            /* ignore */
        }
        return null;
    }

    if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.savedAt !== 'number'
    ) {
        try {
            storage.removeItem(key);
        } catch {
            /* ignore */
        }
        return null;
    }

    if (Date.now() - parsed.savedAt > TTL_MS) {
        try {
            storage.removeItem(key);
        } catch {
            /* ignore */
        }
        return null;
    }

    return parsed;
}

/** Clear the stored draft for the given slug. No-op when absent / SSR. */
export function clearDraftServiceConfig(slug: string): void {
    if (!slug) return;
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.removeItem(storageKey(slug));
    } catch {
        /* ignore */
    }
}
