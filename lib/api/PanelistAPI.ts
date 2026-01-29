import { API_BASE_URL } from './LoginApi'

export interface Panelist {
    id: string
    age: number
    gender: string
    creator_email: string
    created_at?: string
}

export interface PanelistPayload {
    id: string
    age: number
    gender: string
    creator_email: string
}

/**
 * Fetch panelists by creator_email
 * @param creatorEmail - The email of the study creator
 * @param limit - Number of panelists to fetch (default 10)
 */
export async function getPanelists(creatorEmail: string, limit: number = 10): Promise<Panelist[]> {
    const response = await fetch(`${API_BASE_URL}/panelist/?creator_email=${encodeURIComponent(creatorEmail)}&number=${limit}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to fetch panelists: ${response.status} ${JSON.stringify(errorData)}`)
    }

    return response.json()
}

/**
 * Add a new panelist
 * @param payload - Panelist data (name, age, gender, creator_email)
 */
export async function addPanelist(payload: PanelistPayload): Promise<Panelist> {
    const response = await fetch(`${API_BASE_URL}/panelist/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to add panelist: ${response.status} ${JSON.stringify(errorData)}`)
    }

    return response.json()
}

/**
 * Search panelists by name or ID
 * @param creatorEmail - The email of the study creator
 * @param query - Search term (name or ID)
 */
export async function searchPanelists(creatorEmail: string, query: string): Promise<Panelist[]> {
    const response = await fetch(`${API_BASE_URL}/panelist/search?creator_email=${encodeURIComponent(creatorEmail)}&query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to search panelists: ${response.status} ${JSON.stringify(errorData)}`)
    }

    return response.json()
}

/**
 * Assign a panelist to a session
 * @param sessionId - The session ID
 * @param panelistId - The panelist ID
 */
export async function assignPanelistToSession(sessionId: string, panelistId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/responses/session/${sessionId}/panelist`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ panelist_id: panelistId }),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to assign panelist to session: ${response.status} ${JSON.stringify(errorData)}`)
    }

    return response.json()
}
