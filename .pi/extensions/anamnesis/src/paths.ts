// ---------------------------------------------------------------------------
// Anamnesis — Centralized path constants
// ---------------------------------------------------------------------------
// All .agents/ paths in one place. Respects LUCY_AGENTS_DIR env var.
// ---------------------------------------------------------------------------

import { join } from "node:path";

const AGENTS_DIR = process.env.LUCY_AGENTS_DIR || ".agents";

// Root directories
export const EXPERIENCE_DIR = join(AGENTS_DIR, "experience");
export const KNOWLEDGE_DIR = join(AGENTS_DIR, "knowledge");

// Memory
export const MEMORY_DIR = join(EXPERIENCE_DIR, "memory");
export const MEMORY_PATH = join(MEMORY_DIR, "MEMORY.md");
export const QUESTIONS_PATH = join(MEMORY_DIR, "questions.md");
export const PREDICTIONS_PATH = join(MEMORY_DIR, "predictions.md");
export const RELEASE_LOG_PATH = join(MEMORY_DIR, "releases", "log.md");

// Narrative
export const NARRATIVE_DIR = join(EXPERIENCE_DIR, "narrative");
export const IDENTITY_PATH = join(NARRATIVE_DIR, "identity.md");
export const JOURNAL_PATH = join(NARRATIVE_DIR, "journal.md");
export const JOURNAL_ARCHIVE_PREFIX = join(NARRATIVE_DIR, "journal-archive-");
export const ARCS_PATH = join(NARRATIVE_DIR, "arcs.md");
export const TENSIONS_PATH = join(NARRATIVE_DIR, "tensions", "active.md");
export const RELATIONS_DIR = join(NARRATIVE_DIR, "relations");

// Dispositions
export const DISPOSITIONS_DIR = join(EXPERIENCE_DIR, "dispositions");
export const DISPOSITION_PROFILE_PATH = join(DISPOSITIONS_DIR, "profile.md");

// Entity (top-level)
export const ENTITY_PATH = join(AGENTS_DIR, "entity.md");
