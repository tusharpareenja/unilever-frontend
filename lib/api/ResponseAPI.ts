/* eslint-disable @typescript-eslint/no-explicit-any */
// No authentication required for study participation

import { API_BASE_URL } from './LoginApi'

// Import fetchWithAuth from StudyAPI for authenticated requests
import { fetchWithAuth } from './StudyAPI'

export interface StudyInfo {
	id: string
	title: string
	study_type: "grid" | "layer" | "text"
	main_question: string
	orientation_text: string
	rating_scale: {
		max_label: string
		max_value: number
		min_label: string
		min_value: number
		middle_label: string
	}
}

export interface StartStudyResponse {
	session_id: string
	respondent_id: number
	total_tasks_assigned: number
	study_info: StudyInfo
	done_by_id?: string | null
}

export interface TaskResponse {
	task_id: string
	rating: number
	response_time_seconds: number
}

export interface SubmitResponsePayload {
	session_id: string
	respondent_id: number
	study_id: string
	responses: TaskResponse[]
	personal_info?: {
		date_of_birth?: string
		gender?: string
	}
	classification_answers?: Record<string, string>
}

export interface SubmitResponseResult {
	success: boolean
	response_id: string
	message: string
}

export interface PersonalInfoPayload {
	user_details: {
		date_of_birth?: string
		gender?: string
	}
}

export interface ClassificationAnswerItem {
	question_id: string
	question_text: string
	answer: string
	answer_timestamp: string // ISO string
	time_spent_seconds: number
}

export interface SubmitClassificationAnswersPayload {
	answers: ClassificationAnswerItem[]
}

export interface SubmitTaskPayload {
	task_id: string
	rating_given: number
	task_duration_seconds: number
	element_interactions: Array<{
		element_id: string
		view_time_seconds: number
		hover_count: number
		click_count: number
		first_view_time: string
		last_view_time: string
	}>
	/** Optional: echo what was shown to the participant (grid/layer) */
	elements_shown_in_task?: Record<string, any>
	elements_shown_content?: Record<string, any>
}

/** Bulk submit multiple task responses at once (participant, no auth) */
export async function submitTasksBulk(sessionId: string, tasks: SubmitTaskPayload[]): Promise<any> {
	// Chunking logic to avoid payload size limits (keepalive limit is ~64KB)
	const CHUNK_SIZE = 15
	if (tasks.length > CHUNK_SIZE) {
		const chunks: SubmitTaskPayload[][] = []
		for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
			chunks.push(tasks.slice(i, i + CHUNK_SIZE))
		}

		// Send chunks in parallel
		return Promise.all(chunks.map(chunk => submitTasksBulk(sessionId, chunk)))
			.then(results => ({ ok: results.every((r: any) => r?.ok !== false) }))
			.catch(() => ({ ok: false }))
	}

	const q = encodeURIComponent(sessionId)
	const body = { tasks }

	// Use fallback URL if API_BASE_URL is undefined
	const baseUrl = API_BASE_URL
	const url = `${baseUrl}/responses/submit-tasks-bulk?session_id=${q}`

	// Measure payload size to conditionally enable keepalive (64KB browser limit)
	const bodyString = JSON.stringify(body)
	const bodySize = new Blob([bodyString]).size
	const KEEPALIVE_THRESHOLD = 60 * 1024 // 60KB safe threshold

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: bodyString,
			keepalive: bodySize < KEEPALIVE_THRESHOLD,
		})

		if (!res.ok) {
			const text = await res.text().catch(() => '')
			console.error('submitTasksBulk failed:', res.status, text)
			return { ok: false, status: res.status, error: text }
		}

		const result = await res.json().catch(() => ({}))
		return result
	} catch (error) {
		// Swallow network errors to avoid UI disruption; backend will still have prior tasks
		return { ok: false }
	}
}

/** Lightweight status check - returns completion state for a session */
export async function getSessionStatus(sessionId: string): Promise<{ is_completed: boolean; completed_tasks_count: number; total_tasks_assigned: number }> {
	const q = encodeURIComponent(sessionId)
	const url = `${API_BASE_URL}/responses/session/${q}/status`

	try {
		const res = await fetch(url, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		})

		if (!res.ok) {
			return { is_completed: false, completed_tasks_count: 0, total_tasks_assigned: 0 }
		}

		const data = await res.json().catch(() => ({}))
		return {
			is_completed: !!data.is_completed,
			completed_tasks_count: data.completed_tasks_count || 0,
			total_tasks_assigned: data.total_tasks_assigned || 0,
		}
	} catch {
		return { is_completed: false, completed_tasks_count: 0, total_tasks_assigned: 0 }
	}
}

export interface TaskSessionPayload {
	session_id: string
	task_id: string
	classification_page_time: number
	orientation_page_time: number
	individual_task_page_times: number[]
	page_transitions?: Array<Record<string, any>>
	is_completed: boolean
	abandonment_timestamp?: string | null
	abandonment_reason?: string | null
	recovery_attempts?: number
	browser_performance?: Record<string, any>
	page_load_times?: number[]
	device_info?: Record<string, any>
	screen_resolution?: string
}

/**
 * Start a study session for a participant
 * @param studyId - The study ID from URL params
 * @returns Promise with session details and study info
 */
export async function startStudy(studyId: string): Promise<StartStudyResponse> {
	const payload = {
		study_id: studyId,
		personal_info: {}
	}

	const response = await fetch(`${API_BASE_URL}/responses/start-study`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to start study: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	// console.log('Study started:', data)
	return data
}

/**
 * Start a merged study session.
 * Used when transitioning from first study to second study in a merge pair.
 * @param studyId - The second study ID
 * @param doneById - Shared Done By ID inherited from the first study
 * @param personalInfo - Personal info from the first study, copied into the second session
 * @returns Promise with session details and study info
 */
export async function startMergedStudy(
	studyId: string,
	doneById: string,
	personalInfo?: Record<string, any>
): Promise<StartStudyResponse> {
	const payload = {
		study_id: studyId,
		done_by_id: doneById.trim(),
		personal_info: personalInfo || {},
		is_merged_study: true,
	}

	const response = await fetch(`${API_BASE_URL}/responses/start-study`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to start merged study: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	return data
}

/** Response from check-panelist-participation API */
export interface CheckPanelistParticipationResponse {
	ok: boolean
	participated: boolean
	message?: string | null
}

/**
 * Check if a panelist has already participated in this study (main participate only).
 * Call when user selects a panelist ID on the panelist page; if participated, show message and block continue.
 */
export async function checkPanelistParticipation(
	studyId: string,
	panelistId: string
): Promise<CheckPanelistParticipationResponse> {
	const params = new URLSearchParams({
		study_id: studyId,
		panelist_id: panelistId.trim(),
	})
	const response = await fetch(
		`${API_BASE_URL}/responses/check-panelist-participation?${params}`,
		{ method: 'GET', headers: { 'Content-Type': 'application/json' } }
	)
	if (!response.ok) {
		const err = await response.json().catch(() => ({}))
		throw new Error(err?.detail || `Check failed: ${response.status}`)
	}
	return response.json()
}

/**
 * Get respondent-specific study details
 * @param respondentId - The respondent ID
 * @param studyId - The study ID
 * @returns Promise with study details, tasks, and classification questions for the specific respondent
 */
export async function getRespondentStudyDetails(respondentId: string, studyId: string): Promise<any> {
	const response = await fetch(`${API_BASE_URL}/responses/respondent/${respondentId}/study/${studyId}/info?limit=1000`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to get respondent study details: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	// console.log('Respondent study details:', data)
	return data
}

/**
 * Submit study responses
 * @param payload - Response data including session info and task responses
 * @returns Promise with submission result
 */
export async function submitStudyResponses(payload: SubmitResponsePayload): Promise<SubmitResponseResult> {
	const response = await fetch(`${API_BASE_URL}/studies/responses`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to submit responses: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	// console.log('Responses submitted:', data)
	return data
}

/**
 * Update user personal information for a study session
 * @param sessionId - The session ID
 * @param personalInfo - Personal information data (DOB, gender)
 * @returns Promise with update result
 */
export async function updateUserPersonalInfo(sessionId: string, personalInfo: PersonalInfoPayload): Promise<any> {
	const response = await fetch(`${API_BASE_URL}/responses/session/${sessionId}/user-details`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(personalInfo),
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to update personal info: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	// console.log('Personal info updated:', data)
	return data
}

/** Submit classification answers (per-click or batched) with session_id in query */
export async function submitClassificationAnswers(sessionId: string, payload: SubmitClassificationAnswersPayload): Promise<any> {
	const q = encodeURIComponent(sessionId)
	const response = await fetch(`${API_BASE_URL}/responses/submit-classification?session_id=${q}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	})
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to submit classification: ${response.status} ${JSON.stringify(errorData)}`)
	}
	return response.json().catch(() => ({}))
}

/** Submit a single task response with interactions */
export async function submitTaskResponse(sessionId: string, payload: SubmitTaskPayload): Promise<any> {
	const q = encodeURIComponent(sessionId)
	const res = await fetch(`${API_BASE_URL}/responses/submit-task?session_id=${q}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	})
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}))
		throw new Error(`Failed to submit task: ${res.status} ${JSON.stringify(errorData)}`)
	}
	return res.json().catch(() => ({}))
}

/** Submit task session analytics */
export async function submitTaskSession(payload: TaskSessionPayload): Promise<any> {
	const res = await fetch(`${API_BASE_URL}/responses/task-sessions/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		keepalive: true,
	})
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}))
		throw new Error(`Failed to submit task session: ${res.status} ${JSON.stringify(errorData)}`)
	}
	return res.json().catch(() => ({}))
}

/**
 * Get study tasks for a session
 * @param sessionId - The session ID from startStudy
 * @returns Promise with task data
 */
export async function getStudyTasks(sessionId: string): Promise<any> {
	const response = await fetch(`${API_BASE_URL}/studies/sessions/${sessionId}/tasks`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to get tasks: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	// console.log('Study tasks:', data)
	return data
}

/**
 * Submit Product ID for a session
 * @param sessionId - The session ID
 * @param productId - The Product ID entered by the user
 * @returns Promise with submission result
 */
export async function submitProductId(sessionId: string, productId: string): Promise<any> {
	const response = await fetch(`${API_BASE_URL}/responses/session/${sessionId}/product-id`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ product_id: productId }),
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to submit Product ID: ${response.status} ${JSON.stringify(errorData)}`)
	}

	return response.json().catch(() => ({}))
}

/**
 * Abort an in-progress study session for a given study/session pair.
 * Endpoint: /responses/study/{study_id}/session/{session_id}
 */
export async function abortStudySession(studyId: string, sessionId: string): Promise<any> {
	const sid = encodeURIComponent(String(studyId).trim())
	const sess = encodeURIComponent(String(sessionId).trim())
	const url = `${API_BASE_URL}/responses/study/${sid}/session/${sess}`

	// Prefer DELETE semantics; fall back to POST if backend expects it.
	let response = await fetch(url, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
	})

	if (response.status === 405) {
		response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		})
	}

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to abort study session: ${response.status} ${JSON.stringify(errorData)}`)
	}

	return response.json().catch(() => ({}))
}

// Analytics response interface
export interface StudyAnalytics {
	total_responses: number
	completed_responses: number
	abandoned_responses: number
	in_progress_responses?: number
	completion_rate: number
	average_duration: number
	abandonment_rate: number
	element_heatmap: Record<string, any>
	timing_distributions: Record<string, any>
}

/**
 * Get study analytics data
 * @param studyId - The study ID
 * @returns Promise with analytics data
 */
export async function getStudyAnalytics(studyId: string): Promise<StudyAnalytics> {
	const response = await fetchWithAuth(`${API_BASE_URL}/responses/analytics/study/${studyId}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(`Failed to get study analytics: ${response.status} ${JSON.stringify(errorData)}`)
	}

	const data = await response.json()
	return data
}

/**
 * Get study analysis JSON (same shape as analysis.json for grid/text/hybrid studies).
 * Used by the analytics page for KPIs, heatmaps, tables, etc.
 * @param studyId - The study ID from route params
 * @returns Promise with analysis JSON (Information Block, RawData, (T) Overall, etc.)
 */
export async function getStudyAnalysisJson(studyId: string): Promise<any> {
	const cleanId = studyId?.trim?.()
	if (!cleanId) throw new Error('Study ID is required')
	const response = await fetchWithAuth(
		`${API_BASE_URL}/responses/study/${encodeURIComponent(cleanId)}/analysis-json`,
		{ method: 'GET', headers: { 'Content-Type': 'application/json' } }
	)
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		throw new Error(
			`Failed to load analysis: ${response.status} ${typeof errorData?.detail === 'string' ? errorData.detail : JSON.stringify(errorData)}`
		)
	}
	return response.json()
}

// ---------------- Filter Analysis ----------------
export interface StudyFilterPayload {
	filters?: {
		age_groups?: string[]
		genders?: string[]
		classification_filters?: Record<string, string[]>
	}
	include_per_panelist?: boolean
}

export interface FilterElementDetail {
	column: string
	category_name: string
	element_name: string
	content: string
}

export interface FilterByCategoryElement {
	element_name: string
	content: string
	top: number
	bottom: number
	response: number
}

export interface FilterByCategory {
	category_name: string
	elements: FilterByCategoryElement[]
}

export interface StudyFilterResponse {
	meta?: Record<string, any>
	top?: any
	bottom?: any
	response?: any
	per_panelist?: any
	element_details?: FilterElementDetail[]
	by_category?: FilterByCategory[]
}

/**
 * POST /responses/study/{study_id}/filter
 * Returns filtered analysis: meta, top, bottom, response (TBR), optionally per_panelist.
 */
export async function postStudyFilter(
	studyId: string,
	payload: StudyFilterPayload
): Promise<StudyFilterResponse> {
	const cleanId = studyId?.trim?.()
	if (!cleanId) throw new Error('Study ID is required')

	const body: StudyFilterPayload = {
		filters: payload.filters ?? {},
		include_per_panelist: payload.include_per_panelist ?? false,
	}

	const res = await fetchWithAuth(
		`${API_BASE_URL}/responses/study/${encodeURIComponent(cleanId)}/filter`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}
	)
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}))
		throw new Error(
			`Failed to filter: ${res.status} ${typeof errorData?.detail === 'string' ? errorData.detail : JSON.stringify(errorData)}`
		)
	}
	return res.json()
}

/**
 * Get WebSocket URL from API base URL.
 * Converts https:// to wss:// and http:// to ws://
 */
function getWebSocketUrl(): string | null {
	if (!API_BASE_URL) return null
	try {
		const url = new URL(API_BASE_URL)
		const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
		return `${wsProtocol}//${url.host}${url.pathname}`
	} catch {
		return null
	}
}

/**
 * Get access token from localStorage for WebSocket auth.
 */
function getAccessToken(): string | null {
	try {
		if (typeof window === 'undefined') return null
		const raw = localStorage.getItem('tokens')
		if (!raw) return null
		const tokens = JSON.parse(raw)
		return tokens?.access_token || null
	} catch {
		return null
	}
}

/** Subscribe to live analytics via WebSocket with graceful fallback to SSE, then polling. Returns an unsubscribe function. */
export function subscribeStudyAnalytics(
	studyId: string,
	onData: (data: StudyAnalytics) => void,
	onError?: (err: any) => void,
	intervalSeconds: number = 5
): () => void {
	let stopped = false
	let ws: WebSocket | null = null
	let es: EventSource | null = null
	let pollTimer: number | null = null
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null
	let reconnectAttempts = 0
	const MAX_RECONNECT_ATTEMPTS = 3

	const cleanup = () => {
		stopped = true
		if (ws) { try { ws.close() } catch { /* ignore */ } ws = null }
		if (es) { try { es.close() } catch { /* ignore */ } es = null }
		if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null }
		if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
	}

	const startPolling = () => {
		if (stopped || pollTimer) return
		const tick = async () => {
			if (stopped) return
			try {
				const data = await getStudyAnalytics(studyId)
				if (!stopped && data) onData(data)
			} catch (e) {
				onError?.(e)
			}
		}
		tick()
		pollTimer = window.setInterval(tick, Math.max(1000, intervalSeconds * 1000))
	}

	const startSSE = () => {
		if (stopped) return
		try {
			const url = `${API_BASE_URL}/responses/analytics/study/${encodeURIComponent(studyId)}/stream?interval_seconds=${encodeURIComponent(String(intervalSeconds))}`
			es = new EventSource(url)
			es.onmessage = (ev) => {
				try {
					const data = JSON.parse(ev.data)
					if (!stopped) onData(data)
				} catch {
					// ignore parse errors
				}
			}
			es.onerror = () => {
				try { es?.close() } catch { /* ignore */ }
				es = null
				if (!stopped) startPolling()
			}
		} catch {
			if (!stopped) startPolling()
		}
	}

	const startWebSocket = () => {
		if (stopped) return

		const wsBaseUrl = getWebSocketUrl()
		const token = getAccessToken()

		if (!wsBaseUrl || !token) {
			startSSE()
			return
		}

		try {
			const wsUrl = `${wsBaseUrl}/ws/analytics/${encodeURIComponent(studyId)}?token=${encodeURIComponent(token)}&interval_seconds=${intervalSeconds}`
			ws = new WebSocket(wsUrl)

			ws.onopen = () => {
				reconnectAttempts = 0
			}

			ws.onmessage = (ev) => {
				try {
					const message = JSON.parse(ev.data)
					if (message.type === 'data' && message.payload && !stopped) {
						onData(message.payload as StudyAnalytics)
					}
					// Ignore ping messages
				} catch {
					// ignore parse errors
				}
			}

			ws.onerror = () => {
				// Will trigger onclose
			}

			ws.onclose = (event) => {
				ws = null
				if (stopped) return

				// If connection was rejected (auth error), fall back to SSE immediately
				if (event.code === 4001 || event.code === 4003) {
					startSSE()
					return
				}

				// Try to reconnect with exponential backoff
				if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
					reconnectAttempts++
					const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000)
					reconnectTimer = setTimeout(() => {
						if (!stopped) startWebSocket()
					}, delay)
				} else {
					// Max reconnect attempts reached, fall back to SSE
					startSSE()
				}
			}
		} catch {
			startSSE()
		}
	}

	// Start with WebSocket (preferred), will fall back automatically
	startWebSocket()

	return cleanup
}

// ---------------- Responses Listing (owner) ----------------
export interface StudyResponseItem {
	id: string
	session_id: string
	respondent_id: number
	personal_info?: {
		gender?: string
		date_of_birth?: string
		age?: number
	}
	is_completed: boolean
	is_abandoned: boolean
	completion_percentage?: number
	total_study_duration?: number
	session_start_time?: string
	session_end_time?: string
	last_activity?: string
}

export interface ResponsesListResult {
	results: StudyResponseItem[]
	count?: number
	next?: string | null
	previous?: string | null
}

/** Fetch responses for a given study (owner/admin). Defaults to limit=100 for fast single fetch. */
export async function getStudyResponses(
	studyId: string,
	limit: number = 100,
	offset: number = 0
): Promise<ResponsesListResult> {
	const url = `${API_BASE_URL}/responses/?study_id=${encodeURIComponent(studyId)}&limit=${limit}&offset=${offset}`
	const res = await fetchWithAuth(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`Failed to fetch responses (${res.status}): ${text}`)
	}
	const data = await res.json().catch(() => ([] as any))
	if (Array.isArray(data)) {
		return { results: data as StudyResponseItem[], count: data.length }
	}
	if (data && Array.isArray(data.results)) {
		return {
			results: data.results as StudyResponseItem[],
			count: typeof data.count === 'number' ? data.count : data.results.length,
			next: data.next ?? null,
			previous: data.previous ?? null,
		}
	}
	// best-effort fallback
	return { results: [], count: 0 }
}

// ---------------- Response Session Details ----------------
export interface SessionTaskItem {
	task_id: string
	respondent_id: number
	task_index: number
	task_type: 'grid' | 'layer' | 'text'
	task_context?: any
	elements_shown_in_task?: Record<string, number>
	elements_shown_content?: Record<string, any>
	/** Some backends send a combined map including *_content URLs */
	elements_shown?: Record<string, any>
	task_start_time?: string
	task_completion_time?: string
	task_duration_seconds?: number
	rating_given?: number
	rating_timestamp?: string
}

export interface ResponseSessionDetails {
	session_id: string
	respondent_id: number
	current_task_index: number
	completed_tasks_count: number
	total_tasks_assigned: number
	session_start_time?: string
	session_end_time?: string
	is_completed: boolean
	background_image_url?: string
	personal_info?: { gender?: string; date_of_birth?: string; age?: number }
	ip_address?: string
	user_agent?: string
	browser_info?: any
	completion_percentage?: number
	total_study_duration?: number
	last_activity?: string
	is_abandoned?: boolean
	abandonment_timestamp?: string | null
	abandonment_reason?: string | null
	id?: string
	study_id?: string
	created_at?: string
	updated_at?: string
	completed_tasks?: SessionTaskItem[]
	classification_answers?: Array<{
		question_id: string
		question_text: string
		answer: string
		answer_timestamp?: string
		time_spent_seconds?: number
		id?: string
		study_response_id?: string
	}>
}

export async function getResponseSessionDetails(sessionId: string): Promise<ResponseSessionDetails> {
	const url = `${API_BASE_URL}/responses/session/${encodeURIComponent(sessionId)}`
	const res = await fetchWithAuth(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`Failed to fetch session details (${res.status}): ${text}`)
	}
	return res.json()
}

/** Download flattened CSV for a study (owner-only) */
export async function downloadStudyResponsesCsv(studyId: string): Promise<Blob> {
	const res = await fetchWithAuth(`${API_BASE_URL}/responses/export/study/${studyId}/flattened-csv`, {
		method: 'GET',
		headers: {
			'Accept': 'text/csv',
		},
	})
	if (!res.ok) {
		const errorText = await res.text().catch(() => '')
		throw new Error(`Failed to export CSV: ${res.status} ${errorText}`)
	}
	return await res.blob()
}
