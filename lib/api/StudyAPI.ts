import { API_BASE_URL } from "./LoginApi"

// Types that mirror backend contract
export type StudyType = "grid" | "layer"

export interface RatingScalePayload {
  min_value: number
  max_value: number
  min_label: string
  max_label: string
  middle_label: string
}

export interface GenderDistributionPayload {
  [key: string]: number
}

export interface AgeDistributionPayload {
  [key: string]: number
}

export interface AudienceSegmentationPayload {
  number_of_respondents: number
  country: string
  gender_distribution: GenderDistributionPayload
  age_distribution: AgeDistributionPayload
}

export interface ElementPayload {
  element_id: string
  name: string
  description: string
  element_type: "image"
  content: string // URL to the uploaded image
  alt_text: string
  category_id: string
}

export interface CategoryPayload {
  category_id: string
  name: string
  order: number
}

export interface StudyLayerPayload {
  layer_id: string
  name: string
  description: string
  z_index: number
  order: number
  images: string[] // uploaded image URLs
}

// NEW: Classification Question Types
export interface AnswerOptionPayload {
  id: string
  text: string
  order?: number
}

export interface ClassificationQuestionPayload {
  question_id: string
  question_text: string
  question_type: string // "multiple_choice", "text", "rating", etc.
  is_required: boolean
  order: number
  answer_options?: AnswerOptionPayload[]
  config?: Record<string, any>
}

export interface CreateStudyPayload {
  title: string
  background: string
  language: string
  main_question: string
  orientation_text: string
  study_type: StudyType
  rating_scale: RatingScalePayload
  audience_segmentation: AudienceSegmentationPayload
  elements: ElementPayload[]
  study_layers: StudyLayerPayload[]
  categories?: CategoryPayload[] // NEW: Optional categories for grid studies
  classification_questions?: ClassificationQuestionPayload[] // NEW: Optional classification questions
  background_image_url?: string // NEW: Optional background image for layer studies
}

export interface UploadImageResult {
  secure_url: string
  public_id: string
  index: number
}

export interface UploadImagesResponse {
  results: UploadImageResult[]
  errors: any[]
}

// ---------------- Auth utils (centralized refresh + fetch wrapper) ----------------
function readTokens(): { access_token?: string; refresh_token?: string; token_type?: string } | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('tokens') : null
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeTokens(tokens: any) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tokens', JSON.stringify(tokens))
    }
  } catch {
    // no-op
  }
}

function clearTokensAndRedirect() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tokens')
      localStorage.removeItem('user')
      // Force navigation to login
      window.location.replace('/login')
    }
  } catch {
    // no-op
  }
}

// Return a safe no-content response to avoid UI error flashes while redirecting
function makeNoContentResponse(): Response {
  return new Response(null, { status: 204, statusText: 'No Content' })
}

async function refreshTokens(): Promise<boolean> {
  try {
    const tokens = readTokens()
    const refresh_token = tokens?.refresh_token
    if (!refresh_token) return false

    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    })
    if (!res.ok) return false
    const data = await res.json().catch(() => null)
    if (!data) return false
    // expect { access_token, refresh_token?, token_type? }
    const newTokens = {
      access_token: data.access_token || tokens?.access_token,
      refresh_token: data.refresh_token || tokens?.refresh_token,
      token_type: data.token_type || 'Bearer',
    }
    writeTokens(newTokens)
    return true
  } catch {
    return false
  }
}

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}, retry = true): Promise<Response> {
  const tokens = readTokens()
  const authHeader = tokens?.access_token ? { Authorization: `Bearer ${tokens.access_token}` } : {}
  const headers = new Headers(init.headers || {})
  Object.entries(authHeader).forEach(([k, v]) => headers.set(k, String(v)))

  const res = await fetch(input, { ...init, headers })
  if (res.status === 401 || res.status === 403) {
    if (!retry) {
      // On final 401, clear tokens and redirect client-side
      clearTokensAndRedirect()
      // Return a no-op response to prevent downstream error UI from flashing
      return makeNoContentResponse()
    }
    const ok = await refreshTokens()
    if (!ok) {
      clearTokensAndRedirect()
      // Return a no-op response to prevent downstream error UI from flashing
      return makeNoContentResponse()
    }
    const tokens2 = readTokens()
    const headers2 = new Headers(init.headers || {})
    if (tokens2?.access_token) headers2.set('Authorization', `Bearer ${tokens2.access_token}`)
    const res2 = await fetch(input, { ...init, headers: headers2 })
    if (res2.status === 401 || res2.status === 403) {
      clearTokensAndRedirect()
      // Return a no-op response to prevent downstream error UI from flashing
      return makeNoContentResponse()
    }
    return res2
  }
  return res
}

// Upload one or multiple files and get back URLs from the server
export async function uploadImages(files: File[] | FileList): Promise<UploadImageResult[]> {
  const list: File[] = Array.from(files as any)
  if (list.length === 0) return []
  const form = new FormData()
  list.forEach((file) => form.append("files", file))

  // NOTE: do not set Content-Type for multipart; browser will set boundary
  const res = await fetchWithAuth(`${API_BASE_URL}/uploads/images`, {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Image upload failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as UploadImagesResponse
  return data.results || []
}

// Create a new study using the backend API contract
export async function createStudy(payload: CreateStudyPayload): Promise<{ id: string } & any> {
  // console.log('=== HTTP REQUEST TO /studIES ===')
  // console.log('URL:', `${API_BASE_URL}/studies`)
  // console.log('Method: POST')
  // console.log('Headers:', { "Content-Type": "application/json", ...getAuthHeader() })
  // console.log('Body size:', JSON.stringify(payload).length, 'characters')

  const res = await fetchWithAuth(`${API_BASE_URL}/studies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  // console.log('Response status:', res.status, res.statusText)
  const data = await res.json().catch(() => ({}))
  // console.log('Response data:', data)
  
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Create study failed (${res.status})`
    // console.log('=== STUDY CREATION FAILED ===')
    // console.log('Error message:', msg)
    // console.log('Full error data:', data)
    // console.log('Response status:', res.status)
    // console.log('Response text:', await res.text().catch(() => 'Could not read response text'))
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  
  // console.log('=== STUDY CREATION SUCCESS ===')
  // console.log('Created study:', data)
  return data
}

// Create a new study from localStorage data (uses already uploaded images)
export async function createStudyFromLocalStorage(): Promise<{ id: string } & any> {
  const payload = buildStudyPayloadFromLocalStorage()
  // console.log('=== STUDY LAUNCH PAYLOAD ===')
  // console.log('Full payload being sent to /studies:', JSON.stringify(payload, null, 2))
  // console.log('Payload summary:', {
  //   title: payload.title,
  //   study_type: payload.study_type,
  //   elements_count: payload.elements?.length || 0,
  //   study_layers_count: payload.study_layers?.length || 0,
  //   classification_questions_count: payload.classification_questions?.length || 0, // NEW
  //   audience_respondents: payload.audience_segmentation?.number_of_respondents
  // })
  // console.log('=== END STUDY LAUNCH PAYLOAD ===')
  return createStudy(payload)
}

// Helper: Safely read JSON from localStorage
function get<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

// Build a CreateStudyPayload from data we persisted across steps
export function buildStudyPayloadFromLocalStorage(): CreateStudyPayload {
  // console.log('=== BUILDING STUDY PAYLOAD FROM LOCALSTORAGE ===')
  
  const s1 = get("cs_step1", { title: "", description: "", language: "ENGLISH", agree: false }) as any
  const s2 = get("cs_step2", { type: "grid", mainQuestion: "", orientationText: "" }) as any
  const s3 = get("cs_step3", { minValue: 1, maxValue: 5, minLabel: "", maxLabel: "", middleLabel: "" }) as any
  const grid = get<any[]>("cs_step5_grid", [])
  const layer = get<any[]>("cs_step5_layer", [])
  const layerBackground = get<any | null>("cs_step5_layer_background", null)
  const s6 = get("cs_step6", { respondents: 0, countries: [], genderMale: 0, genderFemale: 0, ageSelections: {} }) as any
  const classificationQuestions = get<any[]>("cs_step4", []) // Get classification questions from localStorage
  
  // console.log('Step 1 data:', s1)
  // console.log('Step 2 data:', s2)
  // console.log('Step 3 data:', s3)
  // console.log('Step 5 Grid data:', grid)
  // console.log('Step 5 Layer data:', layer)
  // console.log('Step 6 data:', s6)
  // console.log('Classification questions data:', classificationQuestions) // NEW

  const language = (s1.language || "en").toString().toLowerCase().startsWith("en") ? "en" : s1.language || "en"

  // Upload images and get URLs
  let elements: ElementPayload[] = []
  let study_layers: StudyLayerPayload[] = []
  let categories: CategoryPayload[] = []

  if (s2.type === "grid") {
    console.log('=== BUILDING GRID STUDY ELEMENTS ===')
    console.log('Grid data from localStorage:', JSON.stringify(grid, null, 2))
    
    // Check if using new category format or legacy format
    const isCategoryFormat = grid.length > 0 && grid[0].title && grid[0].elements
    console.log('Is category format:', isCategoryFormat)
    
    if (isCategoryFormat) {
      // New category format: flatten all elements from all categories
      console.log('Processing category format...')
      
      // Build categories array
      categories = grid.map((category: any, catIdx: number) => ({
        category_id: String(category.id || `C${catIdx + 1}`),
        name: String(category.title || `Category ${catIdx + 1}`),
        order: catIdx,
      }))
      console.log('Built categories:', categories)
      
      elements = grid
        .flatMap((category: any, catIdx: number) => {
          console.log(`Category ${catIdx} (${category.title}):`, {
            elements_count: category.elements?.length || 0,
            elements_with_secureUrl: (category.elements || []).filter((e: any) => Boolean(e?.secureUrl)).length
          })
          return (category.elements || [])
            .filter((e: any) => Boolean(e?.secureUrl))
            .map((e: any, idx: number) => ({
              element_id: String(e.id || crypto.randomUUID?.() || `E${idx + 1}`),
              name: e.name || `Element ${idx + 1}`,
              description: e.description || "",
              element_type: "image" as const,
              content: e.secureUrl,
              alt_text: e.name || `Element ${idx + 1}`,
              category_id: String(category.id || `C${catIdx + 1}`),
            }))
        })
      console.log('Final elements count:', elements.length)
      console.log('Elements:', elements.map(e => ({ id: e.element_id, name: e.name, content: e.content })))
    } else {
      // Legacy format: use elements array directly
      console.log('Processing legacy format...')
      const gridWithImages = grid.filter(e => e.secureUrl)
      console.log('Grid with images count:', gridWithImages.length)
      elements = gridWithImages.map((item, idx) => {
        // console.log(`Grid Element ${idx}:`, { id: item.id, name: item.name, secureUrl: item.secureUrl })
        return {
          element_id: String(item.id || crypto.randomUUID?.() || `E${idx + 1}`),
          name: item.name || `Element ${idx + 1}`,
          description: item.description || "",
          element_type: "image" as const,
          content: item.secureUrl,
          alt_text: item.name || `Element ${idx + 1}`,
          category_id: "default-category", // Legacy format uses default category
        }
      })
      console.log('Final elements count:', elements.length)
    }
    console.log('=== END BUILDING GRID STUDY ELEMENTS ===')
  } else {
    // For layer mode: use secure URLs directly (images already uploaded)
    // If background present, prepend a background layer at z_index 0
    const backgroundLayer = (() => {
      if (layerBackground && (layerBackground.secureUrl || layerBackground.previewUrl)) {
        const url = layerBackground.secureUrl || layerBackground.previewUrl
        return {
          layer_id: layerBackground.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          name: layerBackground.name || 'Background',
          description: 'Auto-added background layer',
          z_index: 0,
          order: 0,
          images: [
            {
              image_id: layerBackground.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
              name: layerBackground.name || 'Background',
              url,
              alt_text: layerBackground.name || 'Background',
              order: 0,
            },
          ],
        }
      }
      return null
    })()

    const userLayers = layer.map((l: any, layerIdx: number) => {
      const imageObjects = l.images?.filter((img: any) => img.secureUrl).map((img: any, imgIdx: number) => {
        // console.log(`Layer ${layerIdx} Image ${imgIdx}:`, { id: img.id, name: img.name, secureUrl: img.secureUrl })
        return {
          image_id: img.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          name: img.name || `Image ${imgIdx + 1}`,
          url: img.secureUrl,
          alt_text: img.name || `Image ${imgIdx + 1}`,
          order: imgIdx,
        }
      }) || []
      
      return {
        layer_id: l.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        name: l.name || `Layer ${layerIdx + 1}`,
        description: l.description || "",
        z_index: typeof l.z === "number" ? l.z : layerIdx + (backgroundLayer ? 1 : 0),
        order: typeof l.z === "number" ? l.z : layerIdx + (backgroundLayer ? 1 : 0),
        images: imageObjects,
      }
    })
    study_layers = backgroundLayer ? [backgroundLayer, ...userLayers] : userLayers
  }

  // Build classification questions from localStorage (Step 4 format)
  const classification_questions: ClassificationQuestionPayload[] = classificationQuestions
    .filter((q: any) => q.title && q.title.trim().length > 0) // Only include questions with titles
    .map((q: any, idx: number) => {
      const validOptions = q.options?.filter((opt: any) => opt.text && opt.text.trim().length > 0) || []
      
      return {
        question_id: String(q.id || `Q${idx + 1}`).substring(0, 10), // Truncate to 10 characters
        question_text: q.title || "",
        question_type: "multiple_choice", // Default to multiple choice
        is_required: q.required !== false, // Use the required field from Step 4
        order: idx + 1,
        answer_options: validOptions.map((option: any, optIdx: number) => ({
          id: String(option.id || String.fromCharCode(65 + optIdx)).substring(0, 10), // Truncate to 10 characters
          text: option.text || "",
          order: optIdx + 1
        })),
        config: {}
      }
    })

  const gender_distribution: GenderDistributionPayload = {
    male: Number(s6.genderMale || 0),
    female: Number(s6.genderFemale || 0),
  }

  // Convert age selections map into numeric percentages
  const age_distribution: AgeDistributionPayload = {}
  const ageSel = s6.ageSelections || {}
  Object.keys(ageSel).forEach((label) => {
    const val = ageSel[label]?.percent
    const num = typeof val === "string" ? Number(val.replace(/[^0-9.-]/g, "")) : Number(val || 0)
    age_distribution[label] = isNaN(num) ? 0 : num
  })

  const countries: string[] = Array.isArray(s6.countries) ? s6.countries : []

  const payload: CreateStudyPayload = {
    title: s1.title || "",
    background: s1.description || "",
    language,
    main_question: s2.mainQuestion || "",
    orientation_text: s2.orientationText || "",
    study_type: (s2.type as StudyType) || "grid",
    rating_scale: {
      min_value: Number(s3.minValue ?? 1),
      max_value: Number(s3.maxValue ?? 5),
      min_label: s3.minLabel || "",
      max_label: s3.maxLabel || "",
      middle_label: s3.middleLabel || "",
    },
    audience_segmentation: {
      number_of_respondents: Number(s6.respondents || 0),
      country: countries.join(", "),
      gender_distribution,
      age_distribution,
    },
    elements,
    study_layers,
    categories: categories.length > 0 ? categories : undefined, // NEW: Include categories if any
    classification_questions: classification_questions.length > 0 ? classification_questions : undefined, // NEW: Include classification questions if any
    background_image_url: (layerBackground && (layerBackground.secureUrl || layerBackground.previewUrl)) ? (layerBackground.secureUrl || layerBackground.previewUrl) : undefined,
  }

  console.log('Built elements:', elements)
  console.log('Built study_layers:', study_layers)
  console.log('Built categories:', categories)
  console.log('Built classification_questions:', classification_questions)
  console.log('Raw classification questions from localStorage:', classificationQuestions)
  console.log('Final payload structure:', {
    title: payload.title,
    study_type: payload.study_type,
    elements_count: payload.elements?.length || 0,
    study_layers_count: payload.study_layers?.length || 0,
    classification_questions_count: payload.classification_questions?.length || 0,
    has_rating_scale: !!payload.rating_scale,
    has_audience_segmentation: !!payload.audience_segmentation
  })
  console.log('=== END BUILDING STUDY PAYLOAD ===')

  return payload
}

function getAuthHeader(): Record<string, string> {
  try {
    if (typeof window === 'undefined') return {}
    // 1) Our app format { access_token, token_type }
    const raw = localStorage.getItem('tokens')
    if (raw) {
      try {
        const tokens = JSON.parse(raw)
        if (tokens?.access_token) {
          return { Authorization: `Bearer ${tokens.access_token}` }
        }
      } catch {}
    }
    // 2) Plain token strings under common keys
    const fallbacks = ['auth_token', 'token', 'healiora_access_token', 'access_token']
    for (const key of fallbacks) {
      const value = localStorage.getItem(key)
      if (value) return { Authorization: `Bearer ${value}` }
    }
    return {}
  } catch {
    return {}
  }
}

// -------- Task Generation --------
export interface TaskGenerationCategoryPayload {
  category_id: string
  name: string
  order: number
}

export interface TaskGenerationElementPayload {
  element_id: string
  name: string
  description: string
  element_type: "image"
  content: string
  alt_text: string
  category_id: string
}

export interface TaskGenerationPayload {
  study_id?: string
  title: string
  background: string
  language: string
  main_question: string
  orientation_text: string
  study_type: StudyType
  rating_scale: {
    min_value: number
    max_value: number
    min_label: string
    max_label: string
    middle_label: string
  }
  audience_segmentation: {
    number_of_respondents: number
    country: string
    gender_distribution: Record<string, number>
    age_distribution: Record<string, number>
  }
  categories?: TaskGenerationCategoryPayload[]
  elements?: TaskGenerationElementPayload[]
  study_layers?: any[]
  background_image_url?: string
  classification_questions?: Array<{
    question_id: string
    question_text: string
    question_type: string
    is_required: boolean
    order: number
    answer_options: Array<{
      id: string
      text: string
      order: number
    }>
  }>
}

export function buildTaskGenerationPayloadFromLocalStorage(): TaskGenerationPayload {
  const s2 = get("cs_step2", { type: "grid" }) as any
  const s6 = get("cs_step6", { respondents: 0, countries: [], genderMale: 0, genderFemale: 0, ageSelections: {} }) as any
  const grid = get<any[]>("cs_step5_grid", [])
  const layer = get<any[]>("cs_step5_layer", [])
  const layerBackground = get<any | null>("cs_step5_layer_background", null)
  const existingStudyId = get<string | null>("cs_study_id", null)
  
  console.log('Task generation payload builder - Step 2:', s2)
  console.log('Task generation payload builder - Grid:', grid)
  console.log('Task generation payload builder - Layer:', layer)
  console.log('Task generation payload builder - Existing Study ID:', existingStudyId)
  console.log('Task generation payload builder - Raw localStorage cs_study_id:', localStorage.getItem('cs_study_id'))

  // Build audience segmentation
  const gender_distribution: Record<string, number> = {
    male: Number(s6.genderMale || 0),
    female: Number(s6.genderFemale || 0),
  }

  // Convert age selections map into numeric percentages
  const age_distribution: Record<string, number> = {}
  const ageSel = s6.ageSelections || {}
  Object.keys(ageSel).forEach((label) => {
    const val = ageSel[label]?.percent
    const num = typeof val === "string" ? Number(val.replace(/[^0-9.-]/g, "")) : Number(val || 0)
    age_distribution[label] = isNaN(num) ? 0 : num
  })

  const countries: string[] = Array.isArray(s6.countries) ? s6.countries : []

  // Build payload based on study type
  let elements: TaskGenerationElementPayload[] = []
  let categories: TaskGenerationCategoryPayload[] = []
  let study_layers: any[] = []
  
  if ((s2.type as StudyType) === "grid") {
    // Grid mode: check if using new category format or legacy format
    const isCategoryFormat = grid.length > 0 && grid[0].title && grid[0].elements
    
    if (isCategoryFormat) {
      // New category format: build categories and elements with category_id
      console.log('=== CATEGORY FORMAT DEBUG ===')
      console.log('Grid data:', JSON.stringify(grid, null, 2))
      
      categories = grid.map((category: any, catIdx: number) => {
        const categoryId = String(category.id || `C${catIdx + 1}`).slice(0, 36)
        console.log(`Category ${catIdx}:`, {
          id: category.id,
          title: category.title,
          elements_count: category.elements?.length || 0,
          category_id: categoryId
        })
        return {
          category_id: categoryId,
          name: String(category.title || `Category ${catIdx + 1}`),
          order: catIdx,
        }
      })

      elements = grid
        .flatMap((category: any, catIdx: number) => {
          const categoryId = String(category.id || `C${catIdx + 1}`).slice(0, 36)
          console.log(`Processing category ${catIdx} (${category.title}):`, {
            category_id: categoryId,
            elements: category.elements?.length || 0
          })
          
          return (category.elements || [])
            .filter((e: any) => Boolean(e?.secureUrl))
            .map((e: any, elIdx: number) => {
              console.log(`Element ${elIdx} in category ${catIdx}:`, {
                element_id: e.id,
                name: e.name,
                category_id: categoryId
              })
              return {
                element_id: String(e.id || `E${elIdx + 1}`).slice(0, 36),
                name: String(e.name || `Element ${elIdx + 1}`),
                description: String(e.description || ""),
                element_type: "image" as const,
                content: String(e.secureUrl),
                alt_text: String(e.name || `Element ${elIdx + 1}`),
                category_id: categoryId,
              }
            })
        })
        
      console.log('=== END CATEGORY FORMAT DEBUG ===')
    } else {
      // Legacy format: create a default category and use elements array directly
      const defaultCategoryId = "default-category"
      categories = [{
        category_id: defaultCategoryId,
        name: "Default Category",
        order: 0,
      }]

      elements = grid
        .filter((e) => Boolean(e?.secureUrl))
        .map((e, idx) => ({
          element_id: String(e.id || `E${idx + 1}`).slice(0, 36),
          name: String(e.name || `Element ${idx + 1}`),
          description: String(e.description || ""),
          element_type: "image" as const,
          content: String(e.secureUrl),
          alt_text: String(e.name || `Element ${idx + 1}`),
          category_id: defaultCategoryId,
        }))
    }
  } else {
    // Layer mode: use study_layers array
    study_layers = layer.map((l: any, layerIdx: number) => {
      const imageObjects = l.images?.filter((img: any) => img.secureUrl).map((img: any, imgIdx: number) => {
        return {
          image_id: img.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          name: img.name || `Image ${imgIdx + 1}`,
          url: img.secureUrl,
          alt_text: img.name || `Image ${imgIdx + 1}`,
          order: imgIdx,
        }
      }) || []
      
      return {
        layer_id: l.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        name: l.name || `Layer ${layerIdx + 1}`,
        description: l.description || "",
        z_index: typeof l.z === "number" ? l.z : layerIdx,
        order: typeof l.z === "number" ? l.z : layerIdx,
        images: imageObjects,
      }
    })
  }

  // Get additional data from localStorage
  const s1 = get("cs_step1", { title: "", description: "", language: "ENGLISH" }) as any
  const s3 = get("cs_step3", { minValue: 1, maxValue: 5, minLabel: "", maxLabel: "", middleLabel: "" }) as any
  const s4 = get("cs_step4", []) as any[] // Classification questions
  
  const language = (s1.language || "en").toString().toLowerCase().startsWith("en") ? "en" : s1.language || "en"
  
  // Build classification questions
  const classification_questions = s4
    .filter((q: any) => q.title && q.title.trim().length > 0)
    .map((q: any, idx: number) => {
      const validOptions = q.options?.filter((opt: any) => opt.text && opt.text.trim().length > 0) || []
      
      return {
        question_id: String(q.id || `Q${idx + 1}`).substring(0, 10),
        question_text: q.title || "",
        question_type: "multiple_choice",
        is_required: q.required !== false,
        order: idx + 1,
        answer_options: validOptions.map((option: any, optIdx: number) => ({
          id: String(option.id || String.fromCharCode(65 + optIdx)).substring(0, 10),
          text: option.text || "",
          order: optIdx + 1
        }))
      }
    })

  const payload: TaskGenerationPayload = {
    ...(existingStudyId ? { study_id: String(existingStudyId) } : {}),
    title: s1.title || "",
    background: s1.description || "",
    language,
    main_question: s2.mainQuestion || "",
    orientation_text: s2.orientationText || "",
    study_type: ((s2.type as StudyType) === 'layer' ? 'layer' : 'grid') as StudyType,
    rating_scale: {
      min_value: Number(s3.minValue ?? 1),
      max_value: Number(s3.maxValue ?? 5),
      min_label: s3.minLabel || "",
      max_label: s3.maxLabel || "",
      middle_label: s3.middleLabel || "",
    },
    audience_segmentation: {
      number_of_respondents: Math.max(1, Number(s6.respondents || 0)),
      country: countries.join(", "),
      gender_distribution,
      age_distribution,
    },
    ...(categories.length > 0 && { categories }),
    ...(elements.length > 0 && { elements }),
    ...(study_layers.length > 0 && { study_layers }),
    ...(classification_questions.length > 0 && { classification_questions }),
    ...(((layerBackground && (layerBackground.secureUrl || layerBackground.previewUrl))) && {
      background_image_url: String(layerBackground.secureUrl || layerBackground.previewUrl)
    })
  }
  
  console.log('Task generation payload:', payload)
  console.log('Task generation payload - Study ID included:', !!payload.study_id, payload.study_id)
  return payload
}

export async function generateTasks(payload: TaskGenerationPayload): Promise<any> {
  console.log('=== TASK GENERATION API REQUEST ===')
  console.log('URL:', `${API_BASE_URL}/studies/generate-tasks`)
  console.log('Method: POST')
  console.log('Request Body:', JSON.stringify(payload, null, 2))
  console.log('Payload Summary:', {
    study_id: payload.study_id,
    title: payload.title,
    study_type: payload.study_type,
    language: payload.language,
    main_question: payload.main_question,
    rating_scale: payload.rating_scale,
    categories_count: payload.categories?.length || 0,
    elements_count: payload.elements?.length || 0,
    study_layers_count: payload.study_layers?.length || 0,
    classification_questions_count: payload.classification_questions?.length || 0,
    respondents: payload.audience_segmentation?.number_of_respondents || 0,
    countries: payload.audience_segmentation?.country || 'N/A'
  })
  console.log('=== END TASK GENERATION REQUEST ===')

  const res = await fetchWithAuth(`${API_BASE_URL}/studies/generate-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  
  console.log('=== TASK GENERATION API RESPONSE ===')
  console.log('Response Status:', res.status, res.statusText)
  
  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  
  console.log('Response Data:', data)
  console.log('=== END TASK GENERATION RESPONSE ===')
  
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Generate tasks failed (${res.status})`
    console.log('=== TASK GENERATION ERROR ===')
    console.log('Error message:', msg)
    console.log('Full error data:', data)
    console.log('Response status:', res.status)
    console.log('=== END TASK GENERATION ERROR ===')
    // Surface full response for debugging callers
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  return data
}

// Regenerate tasks for a specific study (after creation)
export async function regenerateTasksForStudy(studyId: string): Promise<any> {
  console.log('=== HTTP REQUEST TO /studies/{id}/regenerate-tasks ===')
  console.log('URL:', `${API_BASE_URL}/studies/${studyId}/regenerate-tasks`)
  
  // Build the same payload as generate tasks
  const taskGenerationPayload = buildTaskGenerationPayloadFromLocalStorage()
  console.log('Regenerate tasks payload:', JSON.stringify(taskGenerationPayload, null, 2))
  
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${studyId}/regenerate-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(taskGenerationPayload),
  })
  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Regenerate tasks failed (${res.status})`
    // console.log('Regenerate tasks error:', msg, data)
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  console.log('Regenerate tasks success:', data)
  return data
}

// Background job status types
export interface JobStatus {
  job_id?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'started'
  progress?: number
  message?: string
  error?: string
  created_at?: string
  updated_at?: string
}

// Check background job status
export async function getTaskGenerationStatus(jobId: string): Promise<JobStatus> {
  console.log('=== CHECKING TASK GENERATION STATUS ===')
  console.log('URL:', `${API_BASE_URL}/studies/generate-tasks/status/${jobId}`)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/generate-tasks/status/${jobId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  const text = await res.text().catch(() => '')
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Check job status failed (${res.status})`
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  console.log('Task generation status:', data)
  return data
}

export async function getTaskGenerationResult(jobId: string): Promise<any> {
  console.log('=== FETCHING TASK GENERATION RESULT ===')
  console.log('URL:', `${API_BASE_URL}/studies/generate-tasks/result/${jobId}`)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/generate-tasks/result/${jobId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  const text = await res.text().catch(() => '')
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Fetch job result failed (${res.status})`
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  console.log('Task generation result:', data)
  return data
}

export async function cancelTaskGeneration(jobId: string): Promise<any> {
  console.log('=== CANCELLING TASK GENERATION JOB ===')
  console.log('URL:', `${API_BASE_URL}/studies/generate-tasks/cancel/${jobId}`)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/generate-tasks/cancel/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const text = await res.text().catch(() => '')
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Cancel job failed (${res.status})`
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  console.log('Cancel response:', data)
  return data
}

// Poll job status with adaptive intervals - faster when close to completion
export async function pollJobStatus(
  jobId: string, 
  onProgress?: (status: JobStatus) => void,
  baseIntervalDelay: number = 5000
): Promise<JobStatus> {
  console.log(`🔄 Starting adaptive job polling for job ${jobId} (base interval: ${baseIntervalDelay}ms)`)
  
  let attempt = 1
  let lastProgress = 0
  let consecutiveHighProgressChecks = 0
  
  while (true) {
    try {
      const status = await getTaskGenerationStatus(jobId)
      const currentProgress = typeof status?.progress === 'number' ? status.progress : 0
      console.log(`📊 Job status (attempt ${attempt}):`, status.status, currentProgress ? `${currentProgress}%` : '')
      
      if (onProgress) {
        onProgress(status)
      }
      
      if (status.status === 'completed') {
        console.log('✅ Job completed successfully')
        return status
      }
      
      if (status.status === 'failed') {
        console.error('❌ Job failed:', status.error)
        throw new Error(status.error || 'Job failed')
      }
      
      // Adaptive polling: faster when progress is high
      let intervalDelay = baseIntervalDelay
      
      // If progress reaches 100%, immediately try result endpoint
      if (currentProgress >= 100) {
        console.log(`🎯 Progress at 100%, immediately checking result endpoint...`)
        try {
          const result = await getTaskGenerationResult(jobId)
          // If result has tasks, job is actually complete even if status isn't updated yet
          if (result && result.tasks) {
            console.log('✅ Result endpoint returned data at 100% progress, job is complete!')
            // Return a completed status object
            return {
              ...status,
              status: 'completed' as const
            }
          }
        } catch (resultError) {
          // Result endpoint may not be ready yet, continue polling but very fast
          console.log('⚠️ Result endpoint not ready yet at 100%, continuing with fast polling...')
        }
        intervalDelay = 1000 // Fast polling while waiting for result endpoint
      }
      // If progress >= 95%, poll every 1 second
      else if (currentProgress >= 95) {
        intervalDelay = 1000
        consecutiveHighProgressChecks++
        console.log(`⚡ High progress detected (${currentProgress}%), fast polling: ${intervalDelay}ms`)
        
        // If progress reaches 99%+, try result endpoint proactively every 2 checks
        if (currentProgress >= 99 && consecutiveHighProgressChecks >= 2) {
          console.log(`🔍 Progress at ${currentProgress}%, proactively checking result endpoint...`)
          try {
            const result = await getTaskGenerationResult(jobId)
            // If result has tasks, job is actually complete even if status isn't updated yet
            if (result && result.tasks) {
              console.log('✅ Result endpoint returned data, job is complete!')
              // Return a completed status object
              return {
                ...status,
                status: 'completed' as const
              }
            }
          } catch (resultError) {
            // Result endpoint may not be ready yet, continue polling
            console.log('⚠️ Result endpoint not ready yet, continuing to poll...')
          }
          consecutiveHighProgressChecks = 0 // Reset counter after proactive check
        }
      } 
      // If progress >= 90%, poll every 2 seconds
      else if (currentProgress >= 90) {
        intervalDelay = 2000
        console.log(`⚡ Near completion (${currentProgress}%), moderate polling: ${intervalDelay}ms`)
      }
      // If progress >= 80%, poll every 3 seconds
      else if (currentProgress >= 80) {
        intervalDelay = 3000
      }
      // Otherwise use base interval (5 seconds)
      
      lastProgress = currentProgress
      
      // Wait with adaptive delay before next check
      console.log(`⏳ Waiting ${intervalDelay}ms before next check...`)
      await new Promise(resolve => setTimeout(resolve, intervalDelay))
      attempt++
      
    } catch (error) {
      console.error(`❌ Error checking job status (attempt ${attempt}):`, error)
      
      // Wait before retry (use base interval for errors)
      console.log(`⏳ Retrying in ${baseIntervalDelay}ms...`)
      await new Promise(resolve => setTimeout(resolve, baseIntervalDelay))
      attempt++
      consecutiveHighProgressChecks = 0 // Reset on error
    }
  }
}

// Enhanced task generation with background job support
export async function generateTasksWithPolling(
  payload: TaskGenerationPayload,
  onProgress?: (status: JobStatus) => void
): Promise<any> {
  console.log('=== TASK GENERATION WITH BACKGROUND JOB SUPPORT ===')
  
  // First, try the immediate generation
  try {
    const immediateResult = await generateTasks(payload)
    console.log('=== TASK GENERATION IMMEDIATE RESULT ===')
    try { console.log('Immediate result keys:', Object.keys(immediateResult || {})) } catch {}
    try { console.log('Immediate result.metadata:', (immediateResult as any)?.metadata) } catch {}
    // Extract job id from multiple possible locations (root, metadata, data)
    const jobId = (immediateResult as any)?.job_id 
      || (immediateResult as any)?.metadata?.job_id 
      || (immediateResult as any)?.data?.job_id
    console.log('Computed jobId:', jobId)

    // Check if the response indicates a background job was started
    const statusHint: string | undefined = (immediateResult as any)?.metadata?.status || (immediateResult as any)?.status
    if (jobId || (statusHint && ['started','pending','processing'].includes(statusHint))) {
      const effectiveJobId = String(jobId || (immediateResult as any)?.metadata?.job_id || (immediateResult as any)?.data?.job_id)
      
      // Store study_id immediately when background job starts (for page refresh resilience)
      const immediateStudyId = (immediateResult as any)?.study_id 
        || (immediateResult as any)?.metadata?.study_id 
        || (immediateResult as any)?.data?.study_id
      if (immediateStudyId) {
        console.log('[API] Storing study_id immediately when background job starts:', immediateStudyId)
        try {
          localStorage.setItem('cs_study_id', JSON.stringify(String(immediateStudyId)))
        } catch (storageError) {
          console.warn('Failed to store study_id immediately:', storageError)
        }
      }
      
      console.log('🔄 Background job started, polling for completion...')
      const finalStatus = await pollJobStatus(effectiveJobId, onProgress, 5000) // 5 second interval
      if (finalStatus.status === 'completed') {
        // Fetch the final result from result endpoint
        console.log('🔄 Job completed, fetching final result...')
        const result = await getTaskGenerationResult(effectiveJobId)
        console.log('✅ Final result received:', {
          hasTasks: !!(result?.tasks),
          hasMetadata: !!(result?.metadata),
          taskCount: result?.tasks ? Object.keys(result.tasks).length : 0,
          respondents: result?.metadata?.number_of_respondents,
          study_id: result?.study_id || result?.metadata?.study_id
        })
        
        // Store study_id from result if available
        const studyId = result?.study_id || result?.metadata?.study_id
        if (studyId) {
          console.log('[API] Storing study_id from task generation result:', studyId)
          try {
            localStorage.setItem('cs_study_id', JSON.stringify(studyId))
          } catch (storageError) {
            console.warn('Failed to store study_id:', storageError)
          }
        }
        
        return result
      }
      return finalStatus
    }
    
    // If no job_id, return immediate result
    return immediateResult
    
  } catch (error) {
    console.error('Task generation failed:', error)
    throw error
  }
}

// Study Management Types
export interface StudyDetails {
  id: string
  title: string
  background: string
  language: string
  main_question: string
  orientation_text: string
  study_type: StudyType
  rating_scale: RatingScalePayload
  audience_segmentation: AudienceSegmentationPayload
  elements: Array<ElementPayload & { id: string }>
  study_layers: Array<StudyLayerPayload & { 
    id: string
    images: Array<{
      image_id: string
      name: string
      url: string
      alt_text: string
      order: number
      id: string
    }>
  }>
  classification_questions?: Array<ClassificationQuestionPayload & { id: string }> // NEW: Include classification questions in study details
  tasks: Record<string, any[]>
  creator_id: string
  status: "draft" | "active" | "paused" | "completed"
  share_token: string
  share_url: string
  created_at: string
  updated_at: string
  launched_at: string | null
  completed_at: string | null
  total_responses: number
  completed_responses: number
  abandoned_responses: number
}

export interface UpdateStudyStatusPayload {
  status: "active" | "paused" | "completed"
}

// Full/partial update via PUT (backend expects PUT)
export type UpdateStudyPutPayload = Partial<{
  title: string
  background: string
  language: string
  main_question: string
  orientation_text: string
  study_type: StudyType
  rating_scale: RatingScalePayload
  audience_segmentation: AudienceSegmentationPayload
  elements: ElementPayload[]
  study_layers: StudyLayerPayload[]
  classification_questions: ClassificationQuestionPayload[] // NEW: Include classification questions in updates
  status: "draft" | "active" | "paused" | "completed"
}>

// Fetch study details by ID
export async function getStudyDetails(studyId: string): Promise<StudyDetails> {
  // console.log('=== HTTP REQUEST TO /studies/{id} ===')
  // console.log('URL:', `${API_BASE_URL}/studies/${studyId}`)
  
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${studyId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  
  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Get study details failed (${res.status})`
    // console.log('Get study details error:', msg, data)
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  
  // console.log('Get study details success:', data)
  return data
}

// Update study status (pause/activate/complete)
export async function updateStudyStatus(studyId: string, status: "active" | "paused" | "completed"): Promise<StudyDetails> {
  console.log('=== HTTP REQUEST TO /studies/{id} (PATCH) ===')
  console.log('URL:', `${API_BASE_URL}/studies/${studyId}`)
  console.log('Status update:', status)
  
  const payload: UpdateStudyStatusPayload = { status }
  
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${studyId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  
  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Update study status failed (${res.status})`
    // console.log('Update study status error:', msg, data)
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  
  // console.log('Update study status success:', data)
  return data
}

// PUT update study (e.g., activate via status change)
export async function putUpdateStudy(studyId: string, payload: UpdateStudyPutPayload): Promise<StudyDetails> {
      // console.log('=== HTTP REQUEST TO /studies/{id} (PUT) ===')
      // console.log('URL:', `${API_BASE_URL}/studies/${studyId}`)
      // console.log('Payload keys:', Object.keys(payload))
  
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${studyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  
  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `PUT study update failed (${res.status})`
    // console.log('PUT study update error:', msg, data)
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  
  // console.log('PUT study update success:', data)
  return data
}

export async function getStudyDetailsWithoutAuth(studyId: string): Promise<StudyDetails> {
  // console.log('=== HTTP REQUEST TO /studies/blic/{id} ===')
  // console.log('URL:', `${API_BASE_URL}/studies/public/${studyId}`)
  
  const res = await fetch(`${API_BASE_URL}/studies/public/${studyId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  
  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Get study details failed (${res.status})`
    // console.log('Get study details error:', msg, data)
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  
  // console.log('Get study details success:', data)
  return data
}

// Get study details for start study flow (uses new endpoint)
export async function getStudyDetailsForStart(studyId: string): Promise<StudyDetails> {
    // console.log('=== HTTP REQUEST TO /studies/public/{id}/details ===')
    // console.log('URL:', `${API_BASE_URL}/studies/public/${studyId}/details`)
  
  const res = await fetch(`${API_BASE_URL}/studies/public/${studyId}/details`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  
  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Get study details failed (${res.status})`
    // console.log('Get study details error:', msg, data)
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  
  // console.log('Get study details success:', data)
  return data
}

// Fetch private study details by ID (requires authentication and ownership)
export async function getPrivateStudyDetails(studyId: string): Promise<StudyDetails> {
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/private/${studyId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  
  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Get private study details failed (${res.status})`
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  
  return data
}

// NEW: Public share details for id/share page
export async function getPublicShareDetails(studyId: string): Promise<{ id: string; title: string; study_type: string; status: string; share_url: string }> {
  const url = `${API_BASE_URL}/studies/share/details?study_id=${encodeURIComponent(studyId)}`
  const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch share details: ${res.status} ${text}`)
  }
  return res.json()
}

// Check if the logged-in user is the owner of a study and if study is active
export async function checkStudyOwnership(studyId: string): Promise<{ is_owner: boolean; is_active: boolean }> {
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${studyId}/is-owner`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  
  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }
  
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Check study ownership failed (${res.status})`
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }
  
  return {
    is_owner: data.is_owner === true,
    is_active: data.is_active === true
  }
}

// Home page studies API
export interface StudyListItem {
  id: string
  title: string
  study_type: 'grid' | 'layer'
  status: 'active' | 'draft' | 'completed' | 'paused'
  created_at: string
  total_responses: number
  completed_responses: number
  abandoned_responses: number
}

export interface StudiesResponse {
  studies?: StudyListItem[]
  total?: number
  page?: number
  per_page?: number
  total_pages?: number
}

export async function getStudies(page: number = 1, per_page: number = 1000): Promise<StudyListItem[]> {
  const response = await fetchWithAuth(`${API_BASE_URL}/studies?page=${page}&per_page=${per_page}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to get studies: ${response.status} ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()
  
  // Debug: Log the response structure

  
  // Handle different response structures
  if (Array.isArray(data)) {
    return data
  } else if (data.studies && Array.isArray(data.studies)) {
    return data.studies
  } else if (data === null || data === undefined) {
    // console.log('API returned null/undefined, returning empty array')
    return []
  } else {
    console.warn('Unexpected API response structure:', data)
    return []
  }
}

export async function getStudyBasicDetails(studyId: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/studies/${studyId}/basic`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch study basic details: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching study basic details:', error)
    throw error
  }
}