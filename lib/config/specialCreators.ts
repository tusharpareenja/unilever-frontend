/** Reserved classification question_id for "Do you like this fragrance?" (special creator / Unilever). Shown on its own page before classification; exclude from main classification list. */
export const FRAGRANCE_QUESTION_ID = "Q0"
export const FRAGRANCE_QUESTION_TEXT = "Do you like this fragrance?"

export const SPECIAL_CREATOR_EMAILS = [
    
    'dlovej009@gmail.com'
]

/** Domains where every user is treated as a special creator (e.g. xyz@unilever.com). */
export const SPECIAL_CREATOR_DOMAINS = ['unilever.com']

/**
 * Helper to check if a creator email belongs to a special account.
 * Returns true if the email is in SPECIAL_CREATOR_EMAILS or its domain is in SPECIAL_CREATOR_DOMAINS.
 * @param email The creator's email address
 * @returns boolean
 */
export function checkIsSpecialCreator(email?: string | null): boolean {
    if (!email) return false
    const normalized = email.toLowerCase().trim()
    if (SPECIAL_CREATOR_EMAILS.includes(normalized)) return true
    const domain = normalized.split('@')[1]
    return domain != null && SPECIAL_CREATOR_DOMAINS.includes(domain)
}
