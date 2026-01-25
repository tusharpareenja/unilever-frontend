/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_BASE_URL } from "./LoginApi"

// Types that mirror backend contract
export type StudyType = "grid" | "layer" | "text" | "hybrid"

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
  number_of_respondents?: number
  country: string
  gender_distribution: GenderDistributionPayload
  age_distribution: AgeDistributionPayload
  aspect_ratio?: string
}

export interface ElementPayload {
  element_id: string
  name: string
  description: string
  element_type: "image" | "text"
  content: string // URL to the uploaded image
  alt_text: string
  category_id: string
}

export interface CategoryPayload {
  category_id: string
  name: string
  order: number
  phase_type?: "grid" | "text" // NEW: phase type for hybrid studies
}

export interface StudyLayerPayload {
  layer_id: string
  name: string
  description: string
  z_index: number
  order: number
  images: string[] // uploaded image URLs
  transform?: {
    x: number
    y: number
    width: number
    height: number
  }
  // Fallback properties if transform is not provided
  x?: number
  y?: number
  width?: number
  height?: number
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
  aspect_ratio?: string
  rating_scale: RatingScalePayload
  audience_segmentation: AudienceSegmentationPayload
  elements?: ElementPayload[]
  study_layers?: StudyLayerPayload[]
  categories?: CategoryPayload[] // NEW: Optional categories for grid studies
  classification_questions?: ClassificationQuestionPayload[] // NEW: Optional classification questions
  background_image_url?: string // NEW: Optional background image for layer studies
  phase_order?: ("grid" | "text" | "mix")[] // NEW: Phase order for hybrid studies
  toggle_shuffle?: boolean // NEW: Shuffle classification questions
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

// Helper: Safely strip surrounding quotes from an ID (common if retrieved from JSON-stringified storage)
export function normalizeStudyId(studyId: string): string {
  if (!studyId) return studyId
  let id = studyId.trim()
  if (id.startsWith('"') && id.endsWith('"')) {
    id = id.slice(1, -1)
  }
  return id
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
  if (res.status === 401) {
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
  const text = get<any[]>("cs_step5_text", []) // NEW: Get text study data
  const hybridGrid = get<any[]>("cs_step5_hybrid_grid", []) // NEW: Get hybrid grid data
  const hybridText = get<any[]>("cs_step5_hybrid_text", []) // NEW: Get hybrid text data
  const layer = get<any[]>("cs_step5_layer", [])
  const layerBackground = get<any | null>("cs_step5_layer_background", null)
  const s6 = get("cs_step6", { respondents: 0, countries: [], genderMale: 0, genderFemale: 0, ageSelections: {} }) as any
  const classificationQuestions = get<any[]>("cs_step4", []) // Get classification questions from localStorage
  const phaseOrder = get<("grid" | "text")[]>("cs_step5_hybrid_phase_order", ["grid", "text"])

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

  // Normalize study type to ensure consistent comparison (handle "Text", "text", "Grid", "grid")
  const rawType = s2.type || "grid"
  const normalizedType = rawType.toLowerCase()

  if (normalizedType === "grid" || normalizedType === "text" || normalizedType === "hybrid") {
    // Grid/Text/Hybrid mode: check if using new category format or legacy format
    const isHybrid = normalizedType === "hybrid"

    const buildElements = (sourceData: any[], typeSuffix: "grid" | "text") => {
      const isTextMode = typeSuffix === "text"
      const isCategoryFormat = sourceData.length > 0 && sourceData[0].title && sourceData[0].elements

      let localCategories: CategoryPayload[] = []
      let localElements: ElementPayload[] = []

      if (isCategoryFormat) {
        localCategories = sourceData.map((category: any, catIdx: number) => ({
          category_id: String(category.id || `C_${typeSuffix}_${catIdx + 1}`),
          name: String(category.title || `Category ${catIdx + 1}`),
          order: catIdx,
          phase_type: typeSuffix, // Set phase type based on the phase being built
        }))

        localElements = sourceData
          .flatMap((category: any, catIdx: number) => {
            return (category.elements || [])
              .filter((e: any) => isTextMode ? (e?.name && e.name.trim()) : Boolean(e?.secureUrl))
              .map((e: any, idx: number) => ({
                element_id: String(e.id || crypto.randomUUID?.() || `E_${typeSuffix}_${idx + 1}`),
                name: e.name || `Element ${idx + 1}`,
                description: e.description || "",
                element_type: isTextMode ? "text" : "image",
                content: isTextMode ? e.name : e.secureUrl,
                alt_text: e.name || `Element ${idx + 1}`,
                category_id: String(category.id || `C_${typeSuffix}_${catIdx + 1}`),
              }))
          })
      } else {
        localElements = sourceData
          .filter(e => isTextMode ? (e.name && e.name.trim()) : e.secureUrl)
          .map((item, idx) => ({
            element_id: String(item.id || crypto.randomUUID?.() || `E_${typeSuffix}_${idx + 1}`),
            name: item.name || `Element ${idx + 1}`,
            description: item.description || "",
            element_type: isTextMode ? "text" : "image",
            content: isTextMode ? item.name : item.secureUrl,
            alt_text: item.name || `Element ${idx + 1}`,
            category_id: `default-category-${typeSuffix}`,
          }))
      }
      return { categories: localCategories, elements: localElements }
    }

    if (isHybrid) {
      const gridResult = buildElements(hybridGrid, "grid")
      const textResult = buildElements(hybridText, "text")
      categories = [...gridResult.categories, ...textResult.categories]
      elements = [...gridResult.elements, ...textResult.elements]
    } else {
      const sourceData = normalizedType === "text" ? text : grid
      const result = buildElements(sourceData, normalizedType as "grid" | "text")
      categories = result.categories
      elements = result.elements
    }
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
          transform: { x: 0, y: 0, width: 100, height: 100 },
          images: [
            {
              image_id: layerBackground.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
              name: layerBackground.name || 'Background',
              url,
              alt_text: layerBackground.name || 'Background',
              order: 0,
              config: {},
            },
          ],
        }
      }
      return null
    })()

    const userLayers = layer.map((l: any, layerIdx: number) => {
      const imageObjects = l.images?.filter((img: any) => img.secureUrl || img.sourceType === 'text').map((img: any, imgIdx: number) => {
        // console.log(`Layer ${layerIdx} Image ${imgIdx}:`, { id: img.id, name: img.name, secureUrl: img.secureUrl })
        const imageObj: any = {
          image_id: img.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          name: img.name || `Image ${imgIdx + 1}`,
          url: img.secureUrl,
          alt_text: img.name || `Image ${imgIdx + 1}`,
          order: imgIdx,
          ...(typeof img.x === 'number' ? { x: img.x } : {}),
          ...(typeof img.y === 'number' ? { y: img.y } : {}),
          ...(typeof img.width === 'number' ? { width: img.width } : {}),
          ...(typeof img.height === 'number' ? { height: img.height } : {}),
          config: {}, // Initialize as empty object
        }

        // Include text properties if this is a text layer - add them at image level AND in config
        if (img.sourceType === 'text' || l.layer_type === 'text') {
          // Add properties at image level
          if (img.htmlContent) imageObj.html_content = img.htmlContent
          if (img.textContent) imageObj.text_content = img.textContent
          if (img.textColor) imageObj.text_color = img.textColor
          if (img.textWeight) imageObj.text_weight = img.textWeight
          if (typeof img.textSize === 'number') imageObj.text_size = img.textSize
          if (img.textFont) imageObj.text_font = img.textFont
          if (img.textBackgroundColor) imageObj.text_background_color = img.textBackgroundColor
          if (typeof img.textBackgroundRadius === 'number') imageObj.text_background_radius = img.textBackgroundRadius
          if (img.textStrokeColor) imageObj.text_stroke_color = img.textStrokeColor
          if (typeof img.textStrokeWidth === 'number') imageObj.text_stroke_width = img.textStrokeWidth
          if (typeof img.textLetterSpacing === 'number') imageObj.text_letter_spacing = img.textLetterSpacing
          if (img.textShadowColor) imageObj.text_shadow_color = img.textShadowColor
          if (typeof img.textShadowBlur === 'number') imageObj.text_shadow_blur = img.textShadowBlur
          if (typeof img.textShadowOffsetX === 'number') imageObj.text_shadow_offset_x = img.textShadowOffsetX
          if (typeof img.textShadowOffsetY === 'number') imageObj.text_shadow_offset_y = img.textShadowOffsetY
          if (img.textFontStyle) imageObj.text_font_style = img.textFontStyle
          if (img.textDecoration) imageObj.text_decoration = img.textDecoration
          if (img.textAlign) imageObj.text_align = img.textAlign
          if (typeof img.textOpacity === 'number') imageObj.text_opacity = img.textOpacity
          if (typeof img.textRotation === 'number') imageObj.text_rotation = img.textRotation

          // Also add config object for backward compatibility
          imageObj.config = {
            text_content: img.textContent || img.htmlContent || '',
            ...(img.htmlContent ? { html_content: img.htmlContent } : {}),
            ...(img.textColor ? { text_color: img.textColor } : {}),
            ...(img.textWeight ? { text_weight: img.textWeight } : {}),
            ...(typeof img.textSize === 'number' ? { text_size: img.textSize } : {}),
            ...(img.textFont ? { text_font: img.textFont } : {}),
            ...(img.textBackgroundColor ? { text_background_color: img.textBackgroundColor } : {}),
            ...(typeof img.textBackgroundRadius === 'number' ? { text_background_radius: img.textBackgroundRadius } : {}),
            ...(img.textStrokeColor ? { text_stroke_color: img.textStrokeColor } : {}),
            ...(typeof img.textStrokeWidth === 'number' ? { text_stroke_width: img.textStrokeWidth } : {}),
            ...(typeof img.textLetterSpacing === 'number' ? { text_letter_spacing: img.textLetterSpacing } : {}),
            ...(img.textShadowColor ? { text_shadow_color: img.textShadowColor } : {}),
            ...(typeof img.textShadowBlur === 'number' ? { text_shadow_blur: img.textShadowBlur } : {}),
            ...(typeof img.textShadowOffsetX === 'number' ? { text_shadow_offset_x: img.textShadowOffsetX } : {}),
            ...(typeof img.textShadowOffsetY === 'number' ? { text_shadow_offset_y: img.textShadowOffsetY } : {}),
            ...(img.textFontStyle ? { text_font_style: img.textFontStyle } : {}),
            ...(img.textDecoration ? { text_decoration: img.textDecoration } : {}),
            ...(img.textAlign ? { text_align: img.textAlign } : {}),
            ...(typeof img.textOpacity === 'number' ? { text_opacity: img.textOpacity } : {}),
            ...(typeof img.textRotation === 'number' ? { text_rotation: img.textRotation } : {}),
            additionalProp1: {}
          }
        }

        return imageObj
      }) || []

      return {
        layer_id: l.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        name: l.name || `Layer ${layerIdx + 1}`,
        description: l.description || "",
        z_index: typeof l.z === "number" ? l.z : layerIdx + (backgroundLayer ? 1 : 0),
        order: typeof l.z === "number" ? l.z : layerIdx + (backgroundLayer ? 1 : 0),
        // PRIORITIZE explicitly saved layer transform
        ...(l.transform ? {
          transform: {
            x: l.transform.x || 0,
            y: l.transform.y || 0,
            width: l.transform.width || 100,
            height: l.transform.height || 100
          }
        } : (l.images && l.images.length > 0 ? {
          // Fallback to first image transform if no layer transform exists
          transform: {
            x: l.images[0].x || 0,
            y: l.images[0].y || 0,
            width: l.images[0].width || 100,
            height: l.images[0].height || 100
          }
        } : {})),
        images: imageObjects,
      }
    })
    // Prepend background layer but ensure we don't have a duplicate in userLayers 
    // (e.g. if state was somehow polluted or resuming from an old version)
    const bgUrl = backgroundLayer?.images?.[0]?.url
    study_layers = backgroundLayer ? [
      backgroundLayer,
      ...userLayers.filter((l: any) => {
        const isBgDescription = l.description === "Auto-added background layer"
        const firstImgUrl = l.images?.[0]?.url
        const isBgNameAndUrl = (l.name === 'Background' || l.name === 'Background Image') && firstImgUrl === bgUrl

        return !(isBgDescription || isBgNameAndUrl)
      })
    ] : userLayers
  }

  // Build classification questions from localStorage (Step 4 format)
  const classification_questions: ClassificationQuestionPayload[] = classificationQuestions
    .filter((q: any) => q.title && q.title.trim().length > 0) // Only include questions with titles
    .map((q: any, idx: number) => {
      const validOptions = q.options?.filter((opt: any) => opt.text && opt.text.trim().length > 0) || []

      return {
        question_id: String(q.id || `Q${idx + 1}`).substring(0, 10),
        question_text: q.title || "",
        question_type: "multiple_choice", // Default to multiple choice
        is_required: q.required !== false, // Use the required field from Step 4
        order: idx + 1,
        answer_options: validOptions.map((option: any, optIdx: number) => ({
          id: String(option.id || String.fromCharCode(65 + optIdx)).substring(0, 10),
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
  const aspectRatioFromLS = (() => {
    try {
      const ar = localStorage.getItem('cs_step5_layer_preview_aspect')
      const map: Record<string, string> = { portrait: '9:16', landscape: '16:9', square: '1:1' }
      return ar && map[ar] ? map[ar] : undefined
    } catch { return undefined }
  })()

  const payload: CreateStudyPayload = {
    title: s1.title || "",
    background: s1.description || "",
    language,
    main_question: s2.mainQuestion || "",
    orientation_text: s2.orientationText || "",
    study_type: (s2.type as StudyType) || "grid",
    ...((() => {
      try {
        const map: Record<string, string> = { portrait: '9:16', landscape: '16:9', square: '1:1' }
        const arKey = localStorage.getItem('cs_step5_layer_preview_aspect')
        let value = arKey && map[arKey] ? map[arKey] : undefined
        if (!value) {
          const raw = localStorage.getItem('current_study_details')
          if (raw) {
            const cs = JSON.parse(raw)
            value = cs?.study_info?.aspect_ratio || cs?.metadata?.aspect_ratio || undefined
          }
        }
        return value ? { aspect_ratio: value } : {}
      } catch { return {} }
    })()),
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
      ...(aspectRatioFromLS ? { aspect_ratio: aspectRatioFromLS } : {}),
      ...((() => {
        if (aspectRatioFromLS) return {}
        try {
          const raw = localStorage.getItem('current_study_details')
          if (!raw) return {}
          const cs = JSON.parse(raw)
          const value = cs?.study_info?.aspect_ratio || cs?.metadata?.aspect_ratio
          return value ? { aspect_ratio: value } : {}
        } catch { return {} }
      })()),
    },
    ...((normalizedType === 'text' || normalizedType === 'grid' || normalizedType === 'hybrid') ? { elements } : {}), // Include elements for grid, text, or hybrid
    ...(normalizedType === 'layer' ? { study_layers } : {}), // Only include study_layers for layer studies
    categories: categories.length > 0 ? categories : undefined, // NEW: Include categories if any
    phase_order: normalizedType === 'hybrid' ? (Array.isArray(phaseOrder) ? phaseOrder : [phaseOrder]) : undefined, // NEW: Include phase_order for hybrid
    classification_questions: classification_questions.length > 0 ? classification_questions : undefined, // NEW: Include classification questions if any
    ...(normalizedType === 'layer' && layerBackground && (layerBackground.secureUrl || layerBackground.previewUrl) ? { background_image_url: layerBackground.secureUrl || layerBackground.previewUrl } : {}),
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
      } catch { }
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
  phase_type?: "grid" | "text" // NEW: phase type for hybrid studies
}

export interface TaskGenerationElementPayload {
  element_id: string
  name: string
  description: string
  element_type: "image" | "text"
  content: string
  alt_text: string
  category_id: string
}

export interface TaskGenerationPayload {
  study_id?: string
  last_step?: number
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
    answer_options?: Array<{
      id: string
      text: string
      order?: number
    }>
  }>
  aspect_ratio?: string
}

export function buildTaskGenerationPayloadFromLocalStorage(): TaskGenerationPayload {
  const s2 = get("cs_step2", { type: "grid" }) as any
  const s6 = get("cs_step6", { respondents: 0, countries: [], genderMale: 0, genderFemale: 0, ageSelections: {} }) as any

  // Load appropriate Step 5 data based on study type
  const studyType = String(s2.type || "grid").toLowerCase()
  const isHybrid = studyType === 'hybrid'

  const grid = get<any[]>(isHybrid ? "cs_step5_hybrid_grid" : "cs_step5_grid", [])
  const text = get<any[]>(isHybrid ? "cs_step5_hybrid_text" : "cs_step5_text", [])
  const layer = get<any[]>("cs_step5_layer", [])
  const layerBackground = get<any | null>("cs_step5_layer_background", null)
  const phaseOrder = get<("grid" | "text" | "mix")[]>("cs_step5_hybrid_phase_order", ["grid", "text"])
  // Try to read existing study id from localStorage.
  // The app sometimes stores a plain string or a JSON string — handle both.
  let existingStudyId = get<string | null>("cs_study_id", null)
  if (!existingStudyId) {
    try {
      const raw = localStorage.getItem('cs_study_id')
      if (raw) {
        try { existingStudyId = JSON.parse(raw) } catch { existingStudyId = raw }
      }
    } catch { }
  }

  console.log('Task generation payload builder - Step 2:', s2)
  console.log('Task generation payload builder - Grid:', grid)
  console.log('Task generation payload builder - Text:', text)
  console.log('Task generation payload builder - Layer:', layer)
  console.log('Task generation payload builder - Existing Study ID:', existingStudyId)
  console.log('Task generation payload builder - Raw localStorage cs_study_id:', localStorage.getItem('cs_study_id'))

  // Helper to ensure valid UUID format (8-4-4-4-12 hex chars)
  const ensureUUID = (id: string | undefined | null): string => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (id && uuidRegex.test(id)) return id

    // If not a valid UUID, create a deterministic-ish one from the string
    if (id && id.length >= 32 && !id.includes('-')) {
      // Might be a non-hyphenated UUID (32 hex chars)
      const hexOnly = id.toLowerCase().replace(/[^0-9a-f]/g, '0').padEnd(32, '0')
      return `${hexOnly.slice(0, 8)}-${hexOnly.slice(8, 12)}-${hexOnly.slice(12, 16)}-${hexOnly.slice(16, 20)}-${hexOnly.slice(20, 32)}`
    }

    // Generate a proper random UUID v4
    try {
      if (typeof window !== 'undefined') {
        if (window.crypto && (window.crypto as any).randomUUID) {
          return (window.crypto as any).randomUUID()
        }
        if (window.crypto) {
          // Fallback using getRandomValues if randomUUID is missing (older browsers)
          return ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          )
        }
      }
    } catch { }

    // Manual UUID v4 placeholder (hex only)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

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

  const stype = s2.type as StudyType
  if (stype === "grid" || stype === "text" || stype === "hybrid") {
    // Grid/Text/Hybrid mode: check if using new category format or legacy format
    const isHybrid = stype === "hybrid"

    const buildElementsForTaskGen = (sourceData: any[], typeSuffix: "grid" | "text") => {
      const isTextMode = typeSuffix === "text"
      const isCategoryFormat = sourceData.length > 0 && sourceData[0].title && sourceData[0].elements

      let localCategories: TaskGenerationCategoryPayload[] = []
      let localElements: TaskGenerationElementPayload[] = []

      if (isCategoryFormat) {
        localCategories = sourceData.map((category: any, catIdx: number) => {
          const categoryId = ensureUUID(category.id)
          return {
            category_id: categoryId,
            name: String(category.title || `Category ${catIdx + 1}`),
            order: catIdx,
            phase_type: typeSuffix, // Set phase type for hybrid/consistency
          }
        })

        localElements = sourceData
          .flatMap((category: any, catIdx: number) => {
            const categoryId = ensureUUID(category.id)
            return (category.elements || [])
              .filter((e: any) => isTextMode ? Boolean(e?.name && e.name.trim()) : Boolean(e?.secureUrl))
              .map((e: any, elIdx: number) => ({
                element_id: ensureUUID(e.id),
                name: String(e.name || `Element ${elIdx + 1}`),
                description: String(e.description || ""),
                element_type: isTextMode ? "text" : "image",
                content: isTextMode ? String(e.name || "") : String(e.secureUrl),
                alt_text: String(e.name || `Element ${elIdx + 1}`),
                category_id: categoryId,
              }))
          })
      } else {
        const defaultCategoryId = ensureUUID(null) // Generate a valid UUID
        localCategories = [{
          category_id: defaultCategoryId,
          name: "Default Category",
          order: 0,
          phase_type: typeSuffix, // Set phase type for hybrid/consistency
        }]
        localElements = sourceData
          .filter((e) => isTextMode ? Boolean(e?.name && e.name.trim()) : Boolean(e?.secureUrl))
          .map((e, idx) => ({
            element_id: ensureUUID(e.id),
            name: String(e.name || `Element ${idx + 1}`),
            description: String(e.description || ""),
            element_type: isTextMode ? "text" : "image",
            content: isTextMode ? String(e.name || "") : String(e.secureUrl),
            alt_text: String(e.name || `Element ${idx + 1}`),
            category_id: defaultCategoryId,
          }))
      }
      return { categories: localCategories, elements: localElements }
    }

    if (isHybrid) {
      const gridResult = buildElementsForTaskGen(grid, "grid")
      const textResult = buildElementsForTaskGen(text, "text")
      categories = [...gridResult.categories, ...textResult.categories]
      elements = [...gridResult.elements, ...textResult.elements]
    } else {
      const sourceData = stype === "text" ? text : grid
      const result = buildElementsForTaskGen(sourceData, stype as "grid" | "text")
      categories = result.categories
      elements = result.elements
    }
  } else {
    // Build study_layers
    const backgroundLayer = (() => {
      if (layerBackground && (layerBackground.secureUrl || layerBackground.previewUrl)) {
        const url = layerBackground.secureUrl || layerBackground.previewUrl
        return {
          layer_id: layerBackground.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          name: layerBackground.name || 'Background',
          description: 'Auto-added background layer',
          z_index: 0,
          order: 0,
          transform: { x: 0, y: 0, width: 100, height: 100 },
          images: [
            {
              image_id: layerBackground.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
              name: layerBackground.name || 'Background',
              url,
              alt_text: layerBackground.name || 'Background',
              order: 0,
              config: {},
            },
          ],
        }
      }
      return null
    })()

    const userLayers = layer.map((l: any, layerIdx: number) => {
      const imageObjects = l.images?.filter((img: any) => img.secureUrl || img.sourceType === 'text').map((img: any, imgIdx: number) => {
        const imageObj: any = {
          image_id: img.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          name: img.name || `Image ${imgIdx + 1}`,
          url: img.secureUrl,
          alt_text: img.name || `Image ${imgIdx + 1}`,
          order: imgIdx,
          ...(typeof img.x === 'number' ? { x: img.x } : {}),
          ...(typeof img.y === 'number' ? { y: img.y } : {}),
          ...(typeof img.width === 'number' ? { width: img.width } : {}),
          ...(typeof img.height === 'number' ? { height: img.height } : {}),
          config: {},
        }

        // Include text properties if this is a text layer - add them at image level AND in config
        if (img.sourceType === 'text' || l.layer_type === 'text') {
          // Add properties at image level
          if (img.htmlContent) imageObj.html_content = img.htmlContent
          if (img.textContent) imageObj.text_content = img.textContent
          if (img.textColor) imageObj.text_color = img.textColor
          if (img.textWeight) imageObj.text_weight = img.textWeight
          if (typeof img.textSize === 'number') imageObj.text_size = img.textSize
          if (img.textFont) imageObj.text_font = img.textFont
          if (img.textBackgroundColor) imageObj.text_background_color = img.textBackgroundColor
          if (typeof img.textBackgroundRadius === 'number') imageObj.text_background_radius = img.textBackgroundRadius
          if (img.textStrokeColor) imageObj.text_stroke_color = img.textStrokeColor
          if (typeof img.textStrokeWidth === 'number') imageObj.text_stroke_width = img.textStrokeWidth
          if (typeof img.textLetterSpacing === 'number') imageObj.text_letter_spacing = img.textLetterSpacing
          if (img.textShadowColor) imageObj.text_shadow_color = img.textShadowColor
          if (typeof img.textShadowBlur === 'number') imageObj.text_shadow_blur = img.textShadowBlur
          if (typeof img.textShadowOffsetX === 'number') imageObj.text_shadow_offset_x = img.textShadowOffsetX
          if (typeof img.textShadowOffsetY === 'number') imageObj.text_shadow_offset_y = img.textShadowOffsetY
          if (img.textFontStyle) imageObj.text_font_style = img.textFontStyle
          if (img.textDecoration) imageObj.text_decoration = img.textDecoration
          if (img.textAlign) imageObj.text_align = img.textAlign
          if (typeof img.textOpacity === 'number') imageObj.text_opacity = img.textOpacity
          if (typeof img.textRotation === 'number') imageObj.text_rotation = img.textRotation

          // Also add config object for backward compatibility
          imageObj.config = {
            text_content: img.textContent || img.htmlContent || '',
            ...(img.htmlContent ? { html_content: img.htmlContent } : {}),
            ...(img.textColor ? { text_color: img.textColor } : {}),
            ...(img.textWeight ? { text_weight: img.textWeight } : {}),
            ...(typeof img.textSize === 'number' ? { text_size: img.textSize } : {}),
            ...(img.textFont ? { text_font: img.textFont } : {}),
            ...(img.textBackgroundColor ? { text_background_color: img.textBackgroundColor } : {}),
            ...(typeof img.textBackgroundRadius === 'number' ? { text_background_radius: img.textBackgroundRadius } : {}),
            ...(img.textStrokeColor ? { text_stroke_color: img.textStrokeColor } : {}),
            ...(typeof img.textStrokeWidth === 'number' ? { text_stroke_width: img.textStrokeWidth } : {}),
            ...(typeof img.textLetterSpacing === 'number' ? { text_letter_spacing: img.textLetterSpacing } : {}),
            ...(img.textShadowColor ? { text_shadow_color: img.textShadowColor } : {}),
            ...(typeof img.textShadowBlur === 'number' ? { text_shadow_blur: img.textShadowBlur } : {}),
            ...(typeof img.textShadowOffsetX === 'number' ? { text_shadow_offset_x: img.textShadowOffsetX } : {}),
            ...(typeof img.textShadowOffsetY === 'number' ? { text_shadow_offset_y: img.textShadowOffsetY } : {}),
            ...(img.textFontStyle ? { text_font_style: img.textFontStyle } : {}),
            ...(img.textDecoration ? { text_decoration: img.textDecoration } : {}),
            ...(img.textAlign ? { text_align: img.textAlign } : {}),
            ...(typeof img.textOpacity === 'number' ? { text_opacity: img.textOpacity } : {}),
            ...(typeof img.textRotation === 'number' ? { text_rotation: img.textRotation } : {}),
            additionalProp1: {}
          }
        }

        return imageObj
      }) || []
      // Build transform: prioritize stored layer transform, fallback to first image
      const transform = l.transform ? {
        x: typeof l.transform.x === 'number' ? l.transform.x : 0,
        y: typeof l.transform.y === 'number' ? l.transform.y : 0,
        width: typeof l.transform.width === 'number' ? l.transform.width : 100,
        height: typeof l.transform.height === 'number' ? l.transform.height : 100,
      } : (() => {
        const first = Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null
        if (!first) return undefined
        return {
          x: typeof first.x === 'number' ? first.x : 10,
          y: typeof first.y === 'number' ? first.y : 10,
          width: typeof first.width === 'number' ? first.width : 80,
          height: typeof first.height === 'number' ? first.height : 80,
        }
      })()

      return {
        layer_id: l.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        name: l.name || `Layer ${layerIdx + 1}`,
        description: l.description || "",
        z_index: typeof l.z === "number" ? l.z : layerIdx + (backgroundLayer ? 1 : 0),
        order: typeof l.z === "number" ? l.z : layerIdx + (backgroundLayer ? 1 : 0),
        ...(transform ? { transform } : {}),
        images: imageObjects,
      }
    })
    study_layers = backgroundLayer ? [backgroundLayer, ...userLayers] : userLayers

  }

  // Get additional data from localStorage
  const s1 = get("cs_step1", { title: "", description: "", language: "ENGLISH" }) as any
  const s3 = get("cs_step3", { minValue: 1, maxValue: 5, minLabel: "", maxLabel: "", middleLabel: "" }) as any
  const s4 = get("cs_step4", []) as any[] // Classification questions

  const language = (s1.language || "en").toString().toLowerCase().startsWith("en") ? "en" : s1.language || "en"
  const aspectRatioFromLS2 = (() => {
    try {
      const ar = localStorage.getItem('cs_step5_layer_preview_aspect')
      const map: Record<string, string> = { portrait: '9:16', landscape: '16:9', square: '1:1' }
      return ar && map[ar] ? map[ar] : undefined
    } catch { return undefined }
  })()

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
    ...(existingStudyId && { study_id: existingStudyId }),
    title: s1.title || "",
    background: s1.description || "",
    language,
    main_question: s2.mainQuestion || "",
    orientation_text: s2.orientationText || "",
    study_type: ((s2.type as StudyType) === 'layer' ? 'layer' : (s2.type as StudyType) === 'text' ? 'text' : (s2.type as StudyType) === 'hybrid' ? 'hybrid' : 'grid') as StudyType,
    phase_order: (s2.type as StudyType) === 'hybrid' ? phaseOrder : undefined,
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
      ...(aspectRatioFromLS2 ? { aspect_ratio: aspectRatioFromLS2 } : {}),
    },
    ...(categories.length > 0 && { categories }),
    ...(elements.length > 0 && { elements }),
    ...(study_layers.length > 0 && { study_layers }),
    ...(classification_questions.length > 0 && { classification_questions }),
    ...((s2.type === 'hybrid') && { phase_order: Array.isArray(phaseOrder) ? phaseOrder : [phaseOrder] }),
    ...(((layerBackground && (layerBackground.secureUrl || layerBackground.previewUrl))) && {
      background_image_url: String(layerBackground.secureUrl || layerBackground.previewUrl)
    }),
    ...((() => {
      try {
        const ar = localStorage.getItem('cs_step5_layer_preview_aspect')
        const map: Record<string, string> = { portrait: '9:16', landscape: '16:9', square: '1:1' }
        const value = ar && map[ar] ? map[ar] : undefined
        return value ? { aspect_ratio: value } : {}
      } catch { return {} }
    })())
  }

  console.log('Task generation payload:', payload)
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
  const cleanId = normalizeStudyId(studyId)
  console.log('=== HTTP REQUEST TO /studies/{id}/regenerate-tasks ===')
  console.log('URL:', `${API_BASE_URL}/studies/${cleanId}/regenerate-tasks`)

  // Build the same payload as generate tasks
  const taskGenerationPayload = buildTaskGenerationPayloadFromLocalStorage()
  console.log('Regenerate tasks payload:', JSON.stringify(taskGenerationPayload, null, 2))

  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/regenerate-tasks`, {
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
    try { console.log('Immediate result keys:', Object.keys(immediateResult || {})) } catch { }
    try { console.log('Immediate result.metadata:', (immediateResult as any)?.metadata) } catch { }
    // Extract job id from multiple possible locations (root, metadata, data)
    const jobId = (immediateResult as any)?.job_id
      || (immediateResult as any)?.metadata?.job_id
      || (immediateResult as any)?.data?.job_id
    console.log('Computed jobId:', jobId)

    // Check if the response indicates a background job was started
    const statusHint: string | undefined = (immediateResult as any)?.metadata?.status || (immediateResult as any)?.status
    if (jobId || (statusHint && ['started', 'pending', 'processing'].includes(statusHint))) {
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
  background_image_url?: string | null
  aspect_ratio?: string
  last_step?: number // Added for resume functionality
  phase_order?: ("grid" | "text" | "mix")[] // NEW: Phase order for hybrid studies
  rating_scale: {
    min_value: number
    max_value: number
    min_label: string
    max_label: string
    middle_label?: string
  }
  audience_segmentation: {
    number_of_respondents: number
    country?: string
    gender_distribution?: {
      male: number
      female: number
    }
    age_distribution?: {
      [key: string]: number
    }
    aspect_ratio?: string
    screener_questions?: any[]
    quota_groups?: any[]
  }
  categories?: any[]
  elements: Array<ElementPayload & { id: string }>
  user_role?: string
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
  }> | null
  classification_questions?: Array<ClassificationQuestionPayload & { id: string }>
  tasks?: Record<string, any[]>
  creator_id?: string
  status?: "draft" | "active" | "paused" | "completed"
  share_token?: string
  share_url?: string
  created_at?: string
  updated_at?: string
  launched_at?: string | null
  completed_at?: string | null
  total_responses?: number
  completed_responses?: number
  abandoned_responses?: number
  jobId?: string
  progress?: number
  startTime?: number
  toggle_shuffle?: boolean
}

export interface UpdateStudyStatusPayload {
  status: "active" | "paused" | "completed" | "draft"
}

// Full/partial update via PUT (backend expects PUT)
export type UpdateStudyPutPayload = Partial<{
  title: string
  background: string
  language: string
  last_step: number
  main_question: string
  orientation_text: string
  study_type: StudyType
  rating_scale: RatingScalePayload
  audience_segmentation: AudienceSegmentationPayload
  elements: ElementPayload[]
  study_layers: StudyLayerPayload[]
  classification_questions: ClassificationQuestionPayload[] // NEW: Include classification questions in updates
  status: "draft" | "active" | "paused" | "completed"
  toggle_shuffle?: boolean
}>

// Fetch study details by ID
export async function getStudyDetails(studyId: string): Promise<StudyDetails> {
  const cleanId = normalizeStudyId(studyId)
  // console.log('=== HTTP REQUEST TO /studies/{id} ===')
  // console.log('URL:', `${API_BASE_URL}/studies/${cleanId}`)

  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}`, {
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

// Get study preview for continue editing
export async function getStudyPreview(studyId: string): Promise<StudyDetails> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/preview`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })

  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }

  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `Get study preview failed (${res.status})`
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }

  return data
}

// Update study status (pause/activate/complete)
export async function updateStudyStatus(studyId: string, status: "active" | "paused" | "completed" | "draft"): Promise<StudyDetails> {
  const cleanId = normalizeStudyId(studyId)
  console.log('=== HTTP REQUEST TO /studies/{id} (PATCH) ===')
  console.log('URL:', `${API_BASE_URL}/studies/${cleanId}`)
  console.log('Status update:', status)

  const payload: UpdateStudyStatusPayload = { status }

  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}`, {
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
export async function putUpdateStudy(studyId: string, payload: UpdateStudyPutPayload, last_step: number): Promise<StudyDetails> {
  const cleanId = normalizeStudyId(studyId)
  // Prepare a safe payload: some backend validations reject fields depending on study type
  // e.g., `study_layers` should only be sent for `layer` studies. Read local step2 to decide.
  let safePayload: any = payload || {}

  // IMPORTANT: If study_type is explicitly in the payload, we use it to determine validation rules
  // Otherwise fall back to localStorage
  let effectiveType = safePayload.study_type
  if (!effectiveType) {
    try {
      const s2 = get("cs_step2", { type: "grid" }) as any
      effectiveType = (s2?.type || "grid").toString()
      console.log('[API] No study_type in payload, using localStorage:', effectiveType)
    } catch (e) {
      effectiveType = "grid"
      console.warn('[API] Could not determine study type from localStorage, defaulting to grid', e)
    }
  }

  const normalizedType = String(effectiveType).toLowerCase()

  // Defensive: Strip layer-specific fields for non-layer studies (grid, text)
  // This prevents backend 400 errors if state is dirty (e.g. switching types)
  if (normalizedType !== 'layer') {
    if (safePayload.hasOwnProperty('study_layers')) {
      delete safePayload.study_layers
      console.log(`[API] Removed study_layers from PUT payload for ${normalizedType} study`)
    }
    if (safePayload.hasOwnProperty('background_image_url')) {
      delete safePayload.background_image_url
      console.log(`[API] Removed background_image_url from PUT payload for ${normalizedType} study`)
    }
  }


  // Add last_step if provided
  if (last_step !== undefined) {
    safePayload.last_step = last_step
  }

  console.log('[API] PUT study update - Study ID:', cleanId)
  console.log('[API] PUT study update - Final payload:', JSON.stringify(safePayload, null, 2))

  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safePayload),
  })

  const text = await res.text().catch(() => "")
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { detail: text } }

  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `PUT study update failed (${res.status})`

    // Handle case where study is already launched (prevents further editing)
    if (typeof msg === 'string' && msg.toLowerCase().includes('already been launched')) {
      if (typeof window !== 'undefined') {
        alert(msg)
        window.location.href = '/home'
        return {} as any // Return empty to stop execution while redirect happens
      }
    }

    console.log('[API] PUT study update error:', msg, data)
    console.log('[API] PUT study update error - Payload was:', JSON.stringify(safePayload, null, 2))
    throw Object.assign(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)), { status: res.status, data })
  }

  // console.log('PUT study update success:', data)
  return data
}

// Fire-and-forget wrapper for PUT updates
export function putUpdateStudyAsync(studyId: string, payload: UpdateStudyPutPayload, last_step?: number) {
  if (typeof window === 'undefined') return
  putUpdateStudy(studyId, payload, last_step ?? 8).catch((err) => {
    console.error('Background PUT update failed:', err)
  })
}

// Member Management API
export interface StudyMember {
  id: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  user_id?: string
  invited_email?: string
  name?: string
  status?: string
}

export async function getStudyMembers(studyId: string): Promise<StudyMember[]> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/members`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch study members: ${res.status}`)
  }

  return await res.json()
}

export async function inviteStudyMember(studyId: string, email: string, role: string): Promise<any> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/members/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.detail || "Failed to invite member")
  }

  return data
}

export async function updateStudyMemberRole(studyId: string, memberId: string, role: string): Promise<any> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || "Failed to update member role")
  }

  if (res.status === 204) return {}
  return await res.json().catch(() => ({}))
}

export async function removeStudyMember(studyId: string, memberId: string): Promise<any> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/members/${memberId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || "Failed to remove member")
  }

  if (res.status === 204) return {}
  return await res.json().catch(() => ({}))
}

export async function getStudyDetailsWithoutAuth(studyId: string): Promise<StudyDetails> {
  const cleanId = normalizeStudyId(studyId)
  // console.log('=== HTTP REQUEST TO /studies/blic/{id} ===')
  // console.log('URL:', `${API_BASE_URL}/studies/public/${cleanId}`)

  const res = await fetch(`${API_BASE_URL}/studies/public/${cleanId}`, {
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
  const cleanId = normalizeStudyId(studyId)
  // console.log('=== HTTP REQUEST TO /studies/public/{id}/details ===')
  // console.log('URL:', `${API_BASE_URL}/studies/public/${cleanId}/details`)

  const res = await fetch(`${API_BASE_URL}/studies/public/${cleanId}/details`, {
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
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/private/${cleanId}`, {
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
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/is-owner`, {
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
  study_type: 'grid' | 'layer' | 'text'
  status: 'active' | 'draft' | 'completed' | 'paused'
  created_at: string
  total_responses: number
  completed_responses: number
  abandoned_responses: number
  last_step?: number
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
  const cleanId = normalizeStudyId(studyId)
  try {
    const response = await fetch(`${API_BASE_URL}/studies/${cleanId}/basic`, {
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

// Update Study - Step 2
export interface UpdateStudyPayload {
  type: "grid" | "layer" | "text" | "hybrid"
  last_step?: number
  main_question: string
  orientation_text: string
}

export async function updateStudy(studyId: string, payload: UpdateStudyPayload): Promise<any> {
  const cleanId = normalizeStudyId(studyId)
  // const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  // if (!token) throw new Error("Authentication token not found")

  // Transform payload to match backend expectations
  // Backend expects 'study_type' but we're sending 'type'
  const backendPayload: any = {
    ...payload,
    study_type: payload.type, // Ensure study_type is set
  }

  console.log('[API] updateStudy - Sending payload:', JSON.stringify(backendPayload, null, 2))

  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      // "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(backendPayload),
  })

  const data = await res.json()
  if (!res.ok) {
    const msg = data?.detail || data?.message || "Failed to update study"

    // Handle case where study is already launched (prevents further editing)
    if (typeof msg === 'string' && msg.toLowerCase().includes('already been launched')) {
      if (typeof window !== 'undefined') {
        alert(msg)
        window.location.href = '/home'
        return {} as any
      }
    }

    console.log('[API] updateStudy error:', data)
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

// Fire and forget update - runs in background without waiting
export function updateStudyAsync(studyId: string, payload: UpdateStudyPayload) {
  if (typeof window === 'undefined') return
  updateStudy(studyId, payload).catch((err) => {
    console.error("Background study update failed:", err.message)
  })
}