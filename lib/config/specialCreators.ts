
export const SPECIAL_CREATOR_EMAILS = [
    'tusharpareenja@gmail.com',
    'dlovej009@gmail.com'
]

/**
 * Helper to check if a creator email belongs to a special account.
 * @param email The creator's email address
 * @returns boolean
 */
export function checkIsSpecialCreator(email?: string | null): boolean {
    if (!email) return false
    return SPECIAL_CREATOR_EMAILS.includes(email.toLowerCase().trim())
}
