// No authentication required for study participation

const BASE_URL = "http://127.0.0.1:8000/api/v1"

// Import fetchWithAuth from StudyAPI for authenticated requests
import { fetchWithAuth } from './StudyAPI'

export interface StudyInfo {
	id: string
	title: string
	study_type: "grid" | "layer"
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

	const response = await fetch(`${BASE_URL}/responses/start-study`, {
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
	console.log('Study started:', data)
	return data
}

/**
 * Submit study responses
 * @param payload - Response data including session info and task responses
 * @returns Promise with submission result
 */
export async function submitStudyResponses(payload: SubmitResponsePayload): Promise<SubmitResponseResult> {
	const response = await fetch('http://127.0.0.1:8000/api/v1/studies/responses', {
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
	console.log('Responses submitted:', data)
	return data
}

/**
 * Update user personal information for a study session
 * @param sessionId - The session ID
 * @param personalInfo - Personal information data (DOB, gender)
 * @returns Promise with update result
 */
export async function updateUserPersonalInfo(sessionId: string, personalInfo: PersonalInfoPayload): Promise<any> {
	const response = await fetch(`${BASE_URL}/responses/session/${sessionId}/user-details`, {
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
	console.log('Personal info updated:', data)
	return data
}

/** Submit classification answers (per-click or batched) with session_id in query */
export async function submitClassificationAnswers(sessionId: string, payload: SubmitClassificationAnswersPayload): Promise<any> {
	const q = encodeURIComponent(sessionId)
	const response = await fetch(`${BASE_URL}/responses/submit-classification?session_id=${q}`, {
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
	const res = await fetch(`${BASE_URL}/responses/submit-task?session_id=${q}`, {
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
	const res = await fetch(`${BASE_URL}/responses/task-sessions/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
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
	const response = await fetch(`http://127.0.0.1:8000/api/v1/studies/sessions/${sessionId}/tasks`, {
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
	console.log('Study tasks:', data)
	return data
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
	const response = await fetchWithAuth(`${BASE_URL}/responses/analytics/study/${studyId}`, {
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

// ---------------- Responses Listing (owner) ----------------
export interface StudyResponseItem {
  id: string
  session_id: string
  respondent_id: number
  personal_info?: {
    gender?: string
    date_of_birth?: string
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
  const url = `${BASE_URL}/responses/?study_id=${encodeURIComponent(studyId)}&limit=${limit}&offset=${offset}`
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
  task_type: 'grid' | 'layer'
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
  personal_info?: { gender?: string; date_of_birth?: string }
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
  const url = `${BASE_URL}/responses/session/${encodeURIComponent(sessionId)}`
  const res = await fetchWithAuth(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch session details (${res.status}): ${text}`)
  }
  return res.json()
}

/** Download flattened CSV for a study (owner-only) */
export async function downloadStudyResponsesCsv(studyId: string): Promise<Blob> {
  const res = await fetchWithAuth(`${BASE_URL}/responses/export/study/${studyId}/flattened-csv`, {
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
