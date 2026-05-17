/**
 * Merged Studies Configuration
 * 
 * This module defines which general studies are merged together.
 * When a user completes the first study, they are automatically transitioned
 * to the second study with the same Done By ID but a new session.
 */

export interface MergedStudyConfig {
  firstStudyId: string
  secondStudyId: string
}

const mergeStudyA = (process.env.NEXT_PUBLIC_MERGE_STUDY_A || "").trim()
const mergeStudyB = (process.env.NEXT_PUBLIC_MERGE_STUDY_B || "").trim()

/**
 * Define merged study pairs (order matters - first -> second).
 * Only study IDs configured in env get merge behavior and Done By ID exports.
 */
export const MERGED_STUDIES: MergedStudyConfig[] =
  mergeStudyA && mergeStudyB
    ? [{ firstStudyId: mergeStudyA, secondStudyId: mergeStudyB }]
    : []

/**
 * LocalStorage keys for tracking merge state
 */
export const MERGE_STORAGE_KEYS = {
  /** Flag indicating current study is part of a merge */
  IS_MERGED: 'is_merged_study',
  /** The Done By ID to carry over to the next study */
  MERGE_DONE_BY_ID: 'merge_done_by_id',
  /** The first study ID in the merge pair */
  MERGE_FIRST_STUDY_ID: 'merge_first_study_id',
  /** Flag indicating a transition is in progress (for recovery) */
  MERGE_PENDING_TRANSITION: 'merge_pending_transition',
  /** Stores respondent details for the second study during transition */
  MERGE_SECOND_STUDY_DETAILS: 'merge_second_study_details',
} as const

/**
 * Get the merge configuration for a given study ID (if it's a first study)
 */
export function getMergedStudyConfig(studyId: string): MergedStudyConfig | null {
  return MERGED_STUDIES.find(config => config.firstStudyId === studyId) || null
}

/**
 * Check if a study is the first study in a merge pair
 */
export function isFirstStudyInMerge(studyId: string): boolean {
  return MERGED_STUDIES.some(config => config.firstStudyId === studyId)
}

/**
 * Check if a study is the second study in a merge pair
 */
export function isSecondStudyInMerge(studyId: string): boolean {
  return MERGED_STUDIES.some(config => config.secondStudyId === studyId)
}

/**
 * Get the next study ID if the current study is part of a merge
 */
export function getNextStudyId(currentStudyId: string): string | null {
  const config = getMergedStudyConfig(currentStudyId)
  return config?.secondStudyId || null
}

/**
 * Get the first study ID if the current study is the second in a merge
 */
export function getFirstStudyId(currentStudyId: string): string | null {
  const config = MERGED_STUDIES.find(c => c.secondStudyId === currentStudyId)
  return config?.firstStudyId || null
}

/**
 * Clear all merge-related localStorage entries
 */
export function clearMergeState(): void {
  try {
    localStorage.removeItem(MERGE_STORAGE_KEYS.IS_MERGED)
    localStorage.removeItem(MERGE_STORAGE_KEYS.MERGE_DONE_BY_ID)
    localStorage.removeItem(MERGE_STORAGE_KEYS.MERGE_FIRST_STUDY_ID)
    localStorage.removeItem(MERGE_STORAGE_KEYS.MERGE_PENDING_TRANSITION)
    localStorage.removeItem(MERGE_STORAGE_KEYS.MERGE_SECOND_STUDY_DETAILS)
  } catch {
    // Best effort cleanup
  }
}

/**
 * Initialize merge state when starting the first study
 */
export function initializeMergeState(studyId: string, doneById: string): void {
  try {
    localStorage.setItem(MERGE_STORAGE_KEYS.IS_MERGED, 'true')
    localStorage.setItem(MERGE_STORAGE_KEYS.MERGE_FIRST_STUDY_ID, studyId)
    localStorage.setItem(MERGE_STORAGE_KEYS.MERGE_DONE_BY_ID, doneById)
  } catch {
    console.error('Failed to initialize merge state')
  }
}

/**
 * Check if merge state is active
 */
export function isMergeStateActive(): boolean {
  try {
    return localStorage.getItem(MERGE_STORAGE_KEYS.IS_MERGED) === 'true'
  } catch {
    return false
  }
}

/**
 * Get stored Done By ID for merge
 */
export function getMergeDoneById(): string | null {
  try {
    return localStorage.getItem(MERGE_STORAGE_KEYS.MERGE_DONE_BY_ID)
  } catch {
    return null
  }
}
