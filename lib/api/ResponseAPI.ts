// No authentication required for study participation

const BASE_URL = "http://127.0.0.1:8000/api/v1"

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
