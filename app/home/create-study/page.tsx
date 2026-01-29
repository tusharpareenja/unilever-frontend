"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { DashboardHeader } from "../components/dashboard-header"
import { AuthGuard } from "@/components/auth/AuthGuard"
import Stepper from "@/components/create-study/Stepper"
import { Step1BasicDetails } from "@/components/create-study/steps/Step1BasicDetails"
import { Step2StudyType } from "@/components/create-study/steps/Step2StudyType"
import { Step3RatingScale } from "@/components/create-study/steps/Step3RatingScale"
import { Step4ClassificationQuestions } from "@/components/create-study/steps/Step4ClassificationQuestions"
import { Step5StudyStructure } from "@/components/create-study/steps/Step5StudyStructure"
import { Step6AudienceSegmentation } from "@/components/create-study/steps/Step6AudienceSegmentation"
import { Step7TaskGeneration } from "@/components/create-study/steps/Step7TaskGeneration"
import { Step8LaunchPreview } from "@/components/create-study/steps/Step8LaunchPreview"
import { getStudyPreview, StudyType } from "@/lib/api/StudyAPI"

// Type definitions for backend responses
interface ClassificationQuestion {
  id?: string
  question_id?: string
  title?: string
  question_text?: string
  required?: boolean
  is_required?: boolean
  options?: AnswerOption[]
  answer_options?: AnswerOption[]
}

interface AnswerOption {
  id?: string
  text?: string
  option_text?: string
  order?: number
}

interface GridElement {
  id?: string
  name?: string
  title?: string
  textContent?: string
  content?: string
  secureUrl?: string
  image_url?: string
  previewUrl?: string
  url?: string
  data?: string
  category_id?: string | number
  categoryId?: string | number
  category?: string | number
  category_name?: string
  element_type?: 'image' | 'text'
}

interface GridCategory {
  id?: string
  title?: string
  name?: string
  description?: string
  elements?: GridElement[]
}

interface LayerImage {
  id?: string
  image_id?: string
  name?: string
  url?: string
  x?: number
  y?: number
  width?: number
  height?: number
  text_content?: string
  text_color?: string
  text_weight?: string
  text_size?: number
  text_font?: string
  text_background_color?: string
  text_background_radius?: number
  text_stroke_color?: string
  text_stroke_width?: number
}

interface StudyLayer {
  id?: string
  layer_id?: string
  name?: string
  layer_name?: string
  description?: string
  z_index?: number
  z?: number
  layer_type?: 'image' | 'text'
  images?: LayerImage[]
  transform?: {
    x: number
    y: number
    width: number
    height: number
  }
  x?: number
  y?: number
  width?: number
  height?: number
}

// Utility function to notify stepper of data changes
const notifyStepDataChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('stepDataChanged'))
  }
}

// Utility function to load draft study data from backend
const loadDraftStudyData = async (studyId: string, shouldUpdateStep: boolean = true) => {
  try {
    console.log('Loading draft study data for ID:', studyId)
    const studyDetails = await getStudyPreview(studyId)
    console.log('Received study details:', studyDetails)

    // Populate Step 1 - Basic Details
    localStorage.setItem('cs_step1', JSON.stringify({
      title: studyDetails.title || '',
      description: studyDetails.background || '',
      language: studyDetails.language || 'en',
      agree: true
    }))

    // Save user role if present
    if (studyDetails.user_role) {
      localStorage.setItem('user_role', studyDetails.user_role)
    } else {
      // Default to admin if creating new or if backend doesn't send it (legacy)
      // Actually strictly speaking for new study user is admin. But here we are loading draft.
      // If missing, assume admin/owner? Or viewer?
      // Let's assume 'admin' for now if it's missing to not break existing flows, 
      // ensuring user can edit their study.
      localStorage.setItem('user_role', 'admin')
    }

    // Populate Step 2 - Study Type
    localStorage.setItem('cs_step2', JSON.stringify({
      type: studyDetails.study_type || 'grid',
      mainQuestion: studyDetails.main_question || '',
      orientationText: studyDetails.orientation_text || 'Welcome to the study!',
    }))

    // Populate Step 3 - Rating Scale
    if (studyDetails.rating_scale) {
      localStorage.setItem('cs_step3', JSON.stringify({
        minValue: studyDetails.rating_scale.min_value || 1,
        maxValue: studyDetails.rating_scale.max_value || 5,
        minLabel: studyDetails.rating_scale.min_label || '',
        middleLabel: studyDetails.rating_scale.middle_label || '',
        maxLabel: studyDetails.rating_scale.max_label || '',
      }))
    }

    // Populate Step 4 - Classification Questions
    if (studyDetails.classification_questions && Array.isArray(studyDetails.classification_questions)) {
      // Transform backend format (question_id, question_text, answer_options) to frontend format (id, title, options)
      const transformedQuestions = studyDetails.classification_questions.map((q: ClassificationQuestion) => ({
        id: q.id || q.question_id || crypto.randomUUID(),
        title: q.title || q.question_text || '',
        required: q.required !== false && q.is_required !== false,
        options: (q.options || q.answer_options || [])
          .sort((a: AnswerOption, b: AnswerOption) => (a.order || 0) - (b.order || 0))
          .map((opt: AnswerOption) => ({
            id: opt.id || crypto.randomUUID(),
            text: opt.text || opt.option_text || ''
          }))
      }))
      localStorage.setItem('cs_step4', JSON.stringify(transformedQuestions))
      if (typeof studyDetails.toggle_shuffle === 'boolean') {
        localStorage.setItem('cs_step4_shuffle', String(studyDetails.toggle_shuffle))
      } else {
        localStorage.setItem('cs_step4_shuffle', 'false')
      }
    } else {
      localStorage.setItem('cs_step4', JSON.stringify([]))
      localStorage.setItem('cs_step4_shuffle', 'false')
    }

    // Populate Step 5 - Study Structure (Grid, Layer, Text, or Hybrid)
    if (studyDetails.study_type === 'grid' || studyDetails.study_type === 'text' || studyDetails.study_type === 'hybrid') {
      const isHybrid = studyDetails.study_type === 'hybrid'
      const storageKey = studyDetails.study_type === 'text' ? 'cs_step5_text' : (isHybrid ? 'cs_step5_hybrid' : 'cs_step5_grid')
      try {
        // If backend provided categories, map them to the frontend category+elements shape
        if (studyDetails.categories && Array.isArray(studyDetails.categories)) {
          const globalElements = Array.isArray(studyDetails.elements) ? studyDetails.elements : []

          const convertElement = (el: GridElement, idx: number) => {
            // Check all candidates for a potential URL
            const urlCandidate = el.secureUrl || el.image_url || el.previewUrl || el.url || el.data || el.content || el.textContent || ''
            const looksLikeUrl = typeof urlCandidate === 'string' && urlCandidate.trim().startsWith('http')

            // Use backend provided element_type if available (preferred), otherwise guess based on content
            const type = el.element_type || (looksLikeUrl ? 'image' : 'text')

            // Canonicalize URL: for images, use the candidate. For text, url is empty.
            const url = type === 'image' ? urlCandidate : ''
            const textContent = el.textContent || el.content || el.name || el.title || (type === 'text' ? urlCandidate : '')

            return {
              id: el.id || `element-${idx}`,
              name: el.name || el.title || (type === 'text' ? textContent : ''),
              previewUrl: url,
              secureUrl: url,
              sourceType: type === 'text' ? 'text' : 'upload',
              textContent: textContent,
            }
          }

          // Build a list of converted global elements with original refs
          const convertedGlobal = globalElements.map((el: GridElement, idx: number) => ({ _orig: el, data: convertElement(el, idx) }))

          const transformedCategories = studyDetails.categories.map((cat: GridCategory, cIdx: number) => {
            const catEls = Array.isArray(cat.elements) ? cat.elements : []
            const convertedFromCat = catEls.map((el: GridElement, eIdx: number) => convertElement(el, eIdx))

            // Find any global elements that reference this category by id or name
            const matched = convertedGlobal
              .filter(ci => {
                const el = ci._orig
                if (!el) return false
                const cid = String(cat.id || '')
                // Common category reference fields
                return (
                  String(el.category_id || el.categoryId || el.category || el.category_name || '') === cid ||
                  String(el.category_name || el.category || '') === String(cat.title || cat.name || '')
                )
              })
              .map(ci => ci.data)

            // Combine and dedupe by id
            const all = [...convertedFromCat, ...matched]
            const seen = new Set<string>()
            const deduped = all.filter((a) => {
              if (!a || !a.id) return false
              if (seen.has(a.id)) return false
              seen.add(a.id)
              return true
            })

            return {
              id: cat.id || `category-${cIdx}`,
              title: cat.title || cat.name || `Category ${cIdx + 1}`,
              description: cat.description || '',
              elements: deduped,
            }
          })

          // Append any remaining unassigned global elements to the first category (or create one)
          const assignedIds = new Set<string>(transformedCategories.flatMap((c) => c.elements.map((e) => e.id)))
          const unassigned = convertedGlobal.map(c => c.data).filter((d) => !assignedIds.has(d.id))
          if (unassigned.length > 0) {
            if (transformedCategories.length > 0) {
              transformedCategories[0].elements = [...transformedCategories[0].elements, ...unassigned]
            } else {
              transformedCategories.push({ id: 'category-1', title: 'Category 1', description: '', elements: unassigned })
            }
          }

          localStorage.setItem(storageKey, JSON.stringify(transformedCategories))

          // Special handling for hybrid: split into grid and text keys
          if (isHybrid) {
            const gridCats = transformedCategories
              .map(c => ({
                ...c,
                elements: c.elements.filter(e => e.sourceType === 'upload')
              }))
              .filter(c => {
                const backendCat = (studyDetails.categories as any[])?.find(bc => bc.id === c.id)
                return backendCat?.phase_type === 'grid' || c.elements.length > 0
              })

            const textCats = transformedCategories
              .map(c => ({
                ...c,
                elements: c.elements.filter(e => e.sourceType === 'text')
              }))
              .filter(c => {
                const backendCat = (studyDetails.categories as any[])?.find(bc => bc.id === c.id)
                return backendCat?.phase_type === 'text' || c.elements.length > 0
              })
            localStorage.setItem('cs_step5_hybrid_grid', JSON.stringify(gridCats))
            localStorage.setItem('cs_step5_hybrid_text', JSON.stringify(textCats))
            if (studyDetails.phase_order) {
              localStorage.setItem('cs_step5_hybrid_phase_order', JSON.stringify(studyDetails.phase_order))
            }
          }
        } else if (studyDetails.elements && Array.isArray(studyDetails.elements)) {
          // No categories provided: wrap all elements into a single default category
          const elements = studyDetails.elements.map((el: GridElement, idx: number) => {
            const url = el.secureUrl || el.image_url || el.previewUrl || el.url || el.data || el.content || ''
            return {
              id: el.id || `element-${idx}`,
              name: el.name || '',
              previewUrl: url || '',
              secureUrl: url || '',
              sourceType: 'upload',
              textContent: el.name || '',
            }
          })
          const defaultCategory = [{ id: 'category-1', title: 'Category 1', description: '', elements }]
          localStorage.setItem(storageKey, JSON.stringify(defaultCategory))
        } else {
          localStorage.setItem(storageKey, JSON.stringify([]))
        }
      } catch (e) {
        console.error(`Failed to populate ${storageKey} from study details`, e)
        localStorage.setItem(storageKey, JSON.stringify([]))
      }
      localStorage.setItem('cs_step5_layer', JSON.stringify([]))
    } else if (studyDetails.study_type === 'layer' && studyDetails.study_layers) {
      // Handle layer study structure - transform to frontend format
      const layers = Array.isArray(studyDetails.study_layers) ? studyDetails.study_layers : []
      const bgUrl = studyDetails.background_image_url

      const transformedLayers = layers
        .filter((layer: StudyLayer) => {
          if (!bgUrl) return true
          const firstImgUrl = layer.images?.[0]?.url
          // Skip if it's the auto-added background layer (by description or name+URL)
          const isBackgroundDescription = layer.description === "Auto-added background layer"
          const isBackgroundNameAndUrl = (layer.name === 'Background' || layer.layer_name === 'Background') && firstImgUrl === bgUrl

          return !(isBackgroundDescription || isBackgroundNameAndUrl)
        })
        .map((layer: StudyLayer, layerIdx: number) => {
          // Extract transform from layer - log for debugging
          console.log(`[LoadDraft] Processing layer ${layerIdx}:`, {
            layer_id: layer.layer_id,
            has_transform: !!layer.transform,
            transform_data: layer.transform,
            z_index: layer.z_index
          })

          // Extract transform from layer - handle both nested and direct properties
          let layerTransform = layer.transform

          // If transform is an object with x, y, width, height, use it
          if (layerTransform && typeof layerTransform === 'object' &&
            (typeof layerTransform.x === 'number' || typeof layerTransform.y === 'number' ||
              typeof layerTransform.width === 'number' || typeof layerTransform.height === 'number')) {
            layerTransform = {
              x: layerTransform.x ?? 0,
              y: layerTransform.y ?? 0,
              width: layerTransform.width ?? 100,
              height: layerTransform.height ?? 100
            }
          } else {
            // Fallback to direct properties or defaults
            layerTransform = {
              x: layer.x ?? 0,
              y: layer.y ?? 0,
              width: layer.width ?? 100,
              height: layer.height ?? 100
            }
          }

          return {
            id: layer.id || layer.layer_id || `layer-${layerIdx}`,
            name: layer.name || layer.layer_name || `Layer ${layerIdx + 1}`,
            description: layer.description || '',
            z: typeof layer.z_index === 'number' ? layer.z_index : layerIdx,
            layer_type: layer.layer_type || 'image',
            transform: layerTransform,
            images: (layer.images || []).map((img: LayerImage, imgIdx: number) => {
              // Extract config from either top-level or nested config object
              const config = (img as any).config || {}

              const coerceNumber = (v: any, fallback = 0) => (v === null || typeof v === 'undefined') ? fallback : Number(v)
              const coerceString = (v: any, fallback = '') => (v === null || typeof v === 'undefined') ? fallback : String(v)

              const textContent = coerceString(config.text_content ?? (img as any).text_content ?? img.name ?? '')
              const textColor = coerceString(config.text_color ?? (img as any).text_color ?? '')
              const textWeight = coerceString(config.text_weight ?? (img as any).text_weight ?? '600')
              const textSize = coerceNumber(config.text_size ?? (img as any).text_size ?? 48)
              const textFont = coerceString(config.text_font ?? (img as any).text_font ?? 'Inter')
              const textBackgroundColor = coerceString(config.text_background_color ?? (img as any).text_background_color ?? '')
              const textBackgroundRadius = coerceNumber(config.text_background_radius ?? (img as any).text_background_radius ?? 0)
              const textStrokeColor = coerceString(config.text_stroke_color ?? (img as any).text_stroke_color ?? '')
              const textStrokeWidth = coerceNumber(config.text_stroke_width ?? (img as any).text_stroke_width ?? 0)
              const textLetterSpacing = coerceNumber(config.text_letter_spacing ?? (img as any).text_letter_spacing ?? 0)
              const textShadowColor = coerceString(config.text_shadow_color ?? (img as any).text_shadow_color ?? '')
              const textShadowBlur = coerceNumber(config.text_shadow_blur ?? (img as any).text_shadow_blur ?? 0)
              const textShadowOffsetX = coerceNumber(config.text_shadow_offset_x ?? (img as any).text_shadow_offset_x ?? 0)
              const textShadowOffsetY = coerceNumber(config.text_shadow_offset_y ?? (img as any).text_shadow_offset_y ?? 0)
              const textFontStyle = coerceString(config.text_font_style ?? (img as any).text_font_style ?? 'normal')
              const textDecoration = coerceString(config.text_decoration ?? (img as any).text_decoration ?? 'none')
              const textAlign = coerceString(config.text_align ?? (img as any).text_align ?? 'left')
              const textOpacity = coerceNumber(config.text_opacity ?? (img as any).text_opacity ?? 100)
              const textRotation = coerceNumber(config.text_rotation ?? (img as any).text_rotation ?? 0)
              const htmlContent = coerceString(config.html_content ?? (img as any).html_content ?? '')

              return {
                id: img.id || img.image_id || `img-${layerIdx}-${imgIdx}`,
                previewUrl: img.url || '',
                secureUrl: img.url || '',
                name: img.name || '',
                x: typeof img.x === 'number' ? img.x : layerTransform.x,
                y: typeof img.y === 'number' ? img.y : layerTransform.y,
                width: typeof img.width === 'number' ? img.width : layerTransform.width,
                height: typeof img.height === 'number' ? img.height : layerTransform.height,
                sourceType: layer.layer_type === 'text' ? 'text' : 'upload',
                textContent,
                htmlContent,
                textColor,
                textWeight: textWeight as any,
                textSize,
                textFont,
                textBackgroundColor,
                textBackgroundRadius,
                textStrokeColor,
                textStrokeWidth,
                textLetterSpacing,
                textShadowColor,
                textShadowBlur,
                textShadowOffsetX,
                textShadowOffsetY,
                textFontStyle,
                textDecoration,
                textAlign,
                textOpacity,
                textRotation,
              }
            })
          }
        })
      console.log('[LoadDraft] Transformed layers with transform data:', transformedLayers)
      localStorage.setItem('cs_step5_layer', JSON.stringify(transformedLayers))
      localStorage.setItem('cs_step5_grid', JSON.stringify([]))
      localStorage.setItem('cs_step5_text', JSON.stringify([]))

      // Store background image if available
      if (studyDetails.background_image_url) {
        localStorage.setItem('cs_step5_layer_background', JSON.stringify({
          id: 'background',
          previewUrl: studyDetails.background_image_url,
          secureUrl: studyDetails.background_image_url,
          name: 'Background Image',
        }))
      }

      // Store aspect ratio
      if (studyDetails.aspect_ratio) {
        const aspectMap: Record<string, string> = {
          '9:16': 'portrait',
          '16:9': 'landscape',
          '1:1': 'square',
        }
        localStorage.setItem('cs_step5_layer_preview_aspect', aspectMap[studyDetails.aspect_ratio] || 'portrait')
      }
    }

    // Populate Step 6 - Audience Segmentation
    if (studyDetails.audience_segmentation) {
      const ageSelections: Record<string, { checked: boolean; percent: string }> = {}
      if (studyDetails.audience_segmentation.age_distribution) {
        Object.keys(studyDetails.audience_segmentation.age_distribution).forEach(ageRange => {
          const value = studyDetails.audience_segmentation.age_distribution![ageRange]
          ageSelections[ageRange] = {
            checked: value > 0,
            percent: value > 0 ? String(value) : '',
          }
        })
      } else {
        // Default age ranges
        ['18 - 24', '25 - 34', '35 - 44', '45 - 54', '55 - 64', '65+'].forEach(range => {
          ageSelections[range] = { checked: false, percent: '' }
        })
      }

      const audienceData = {
        respondents: studyDetails.audience_segmentation.number_of_respondents || 0,
        countries: studyDetails.audience_segmentation.country ? [studyDetails.audience_segmentation.country] : [],
        genderMale: studyDetails.audience_segmentation.gender_distribution?.male || 50,
        genderFemale: studyDetails.audience_segmentation.gender_distribution?.female || 50,
        ageSelections,
      }

      localStorage.setItem('cs_step6', JSON.stringify(audienceData))
    }

    // Store a preview of tasks (first respondent) and mark step 7 completed.
    // Do NOT persist the full `tasks` matrix to localStorage because it can be very large.
    if (studyDetails.tasks) {
      // Also store task generation completion flag
      localStorage.setItem('cs_step7_tasks', JSON.stringify({
        completed: true,
        timestamp: Date.now(),
      }))

      // Transform and store a lightweight task preview for UI rendering only
      const taskMatrix = {
        metadata: {
          total_respondents: Object.keys(studyDetails.tasks).length,
          completed_at: new Date().toISOString(),
          message: 'Task generation completed successfully',
        },
        preview_tasks: studyDetails.tasks['1'] || [],
        total_respondents: Object.keys(studyDetails.tasks).length,
        total_tasks: studyDetails.tasks['1']?.length || 0,
      }
      localStorage.setItem('cs_step7_matrix', JSON.stringify(taskMatrix))
    }

    // Store job ID if present in the study details
    if (studyDetails.jobId) {
      const jobState = {
        jobId: studyDetails.jobId,
        progress: studyDetails.progress || 0,
        startTime: studyDetails.startTime || Date.now(),
        status: studyDetails.status || null,
        studyId: studyId,
        timestamp: Date.now()
      }
      localStorage.setItem('cs_step7_job_state', JSON.stringify(jobState))
      console.log('[LoadDraft] Stored job state in localStorage:', jobState)
    }

    // NEW: Restore the last saved step based on local completion validation
    // This honors "open the last step which shows completed" request
    let targetStep = 1

    // Helper validation logic mirrored from Stepper.tsx
    const isStepCompleted = (stepId: number): boolean => {
      try {
        switch (stepId) {
          case 1: {
            const data = localStorage.getItem('cs_step1')
            if (!data) return false
            const parsed = JSON.parse(data)
            return !!(parsed.title && parsed.description && parsed.language && parsed.agree)
          }
          case 2: {
            const data = localStorage.getItem('cs_step2')
            if (!data) return false
            const parsed = JSON.parse(data)
            return !!(parsed.type && parsed.mainQuestion && parsed.orientationText)
          }
          case 3: {
            const data = localStorage.getItem('cs_step3')
            if (!data) return false
            const parsed = JSON.parse(data)
            return !!(parsed.minValue && parsed.maxValue && parsed.minLabel && parsed.maxLabel)
          }
          case 4: {
            const data = localStorage.getItem('cs_step4')
            if (!data) return false
            try {
              const parsed = JSON.parse(data)
              if (!Array.isArray(parsed) || parsed.length === 0) return false
              return parsed.every((q: any) => {
                const questionText = q.title || q.question_text || ''
                const opts = q.options || q.answer_options || []
                return (questionText && questionText.trim().length > 0 && Array.isArray(opts) && opts.length >= 2 && opts.every((o: any) => (o.text || o.option_text) && (o.text || o.option_text).trim().length > 0))
              })
            } catch { return false }
          }
          case 5: {
            const gridData = localStorage.getItem('cs_step5_grid')
            const textData = localStorage.getItem('cs_step5_text')
            const layerData = localStorage.getItem('cs_step5_layer')
            const step2Data = localStorage.getItem('cs_step2')
            if (!step2Data) return false
            const step2 = JSON.parse(step2Data)
            if (step2.type === 'grid') {
              if (!gridData) return false
              let grid: any
              try { grid = JSON.parse(gridData) } catch { return false }
              const isCategoryFormat = grid.length > 0 && grid[0] && grid[0].title && grid[0].elements
              if (isCategoryFormat) {
                const hasValidElement = (element: any) => Boolean(element && (element.secureUrl || element.previewUrl || element.textContent))
                return Array.isArray(grid) && grid.length >= 3 && grid.every((category: any) => category.title && category.title.trim().length > 0 && category.elements && Array.isArray(category.elements) && category.elements.length >= 3 && category.elements.every((element: any) => hasValidElement(element)))
              } else {
                return Array.isArray(grid) && grid.length >= 3 && grid.every((e: any) => (e && (e.secureUrl || e.previewUrl || e.textContent)))
              }
            } else if (step2.type === 'text') {
              if (!textData) return false
              let text: any
              try { text = JSON.parse(textData) } catch { return false }
              return Array.isArray(text) && text.length >= 3 && text.every((category: any) => category.title && category.title.trim().length > 0 && category.elements && Array.isArray(category.elements) && category.elements.length >= 3 && category.elements.every((element: any) => element.name && element.name.trim().length > 0))
            } else if (step2.type === 'hybrid') {
              const hGridData = localStorage.getItem('cs_step5_hybrid_grid')
              const hTextData = localStorage.getItem('cs_step5_hybrid_text')
              if (!hGridData || !hTextData) return false
              let hGrid: any, hText: any
              try {
                hGrid = JSON.parse(hGridData)
                hText = JSON.parse(hTextData)
              } catch { return false }

              const validatePhase = (cats: any[], isText: boolean) => {
                return Array.isArray(cats) && cats.length >= 3 && cats.every((category: any) =>
                  category.title && category.title.trim().length > 0 &&
                  category.elements && Array.isArray(category.elements) && category.elements.length >= 3 &&
                  category.elements.every((element: any) =>
                    isText ? (element.name && element.name.trim().length > 0) : Boolean(element.secureUrl || element.previewUrl || element.textContent)
                  )
                )
              }
              return validatePhase(hGrid, false) && validatePhase(hText, true)
            } else {
              if (!layerData) return false
              const layer = JSON.parse(layerData)
              return Array.isArray(layer) && layer.length >= 3 && layer.every((l: any) => l.images && l.images.length >= 3 && l.images.every((img: any) => img.secureUrl))
            }
          }
          case 6: {
            const data = localStorage.getItem('cs_step6')
            if (!data) return false
            const parsed = JSON.parse(data)
            return !!(parsed.respondents && parsed.respondents > 0)
          }
          case 7: {
            const data = localStorage.getItem('cs_step7_tasks')
            return !!data
          }
          case 8: return false // Cannot auto-complete step 8 to jump *past* it
          default: return false
        }
      } catch { return false }
    }

    // Find the highest step where all previous steps are completed
    // If Step 1 is done, check 2. If 2 is done, check 3. etc.
    // We want the last one that IS completed, OR the next one?
    // User said: "last step which shows completed just open that"
    // So if 1, 2, 3 are done. 4 is not. Open 3.

    // First, verify up to where we have continuous completion
    let maxCompleted = 0
    for (let i = 1; i <= 7; i++) {
      if (isStepCompleted(i)) {
        maxCompleted = i
      } else {
        // Gap found, stop checking? 
        // Usually wizard flow implies sequential completion.
        break
      }
    }

    // If we have any completed steps, use the max completed one.
    // If nothing is completed, default to 1.
    // Also consider backend's last_step as a hint if local validation fails?
    // But user explicitly asked for "last step which shows completed".
    if (maxCompleted > 0) {
      targetStep = maxCompleted
      console.log('[LoadDraft] Calculated target step based on completion:', targetStep)
    } else if (studyDetails.last_step) {
      // Fallback to backend if local check finds nothing (e.g. data format mismatch)
      targetStep = studyDetails.last_step
      console.log('[LoadDraft] Fallback to backend last_step:', targetStep)
    }

    if (shouldUpdateStep) {
      localStorage.setItem('cs_current_step', String(targetStep))
    }


    console.log('Draft study data loaded successfully into localStorage')
  } catch (error) {
    console.error('Failed to load draft study data:', error)
    throw error
  }
}

export default function CreateStudyPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [studyType, setStudyType] = useState<StudyType>("grid")
  const [isLoadingDraft, setIsLoadingDraft] = useState(false)
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_role') || 'admin'
    }
    return 'admin'
  })

  useEffect(() => {
    // Listen for storage changes in case it updates in another tab/component
    const handleStorage = () => {
      const r = localStorage.getItem('user_role')
      if (r) setUserRole(r)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Synchronous restore from backup before children mount
  const didRestoreBackupRef = useRef(false)
  if (typeof window !== 'undefined' && !didRestoreBackupRef.current) {
    try {
      // Check if this is a fresh start (user clicked "Create New Study")
      const isFreshStart = localStorage.getItem('cs_is_fresh_start') === 'true'

      if (!isFreshStart) {
        // Only restore backup if NOT a fresh start
        const backupRaw = localStorage.getItem('cs_backup_steps')
        if (backupRaw) {
          const backup = JSON.parse(backupRaw) as Record<string, unknown>
          const stepKeys = ['cs_step1', 'cs_step2', 'cs_step3', 'cs_step4', 'cs_step5_grid', 'cs_step5_text', 'cs_step5_layer', 'cs_step6']
          stepKeys.forEach((k) => {
            if (!localStorage.getItem(k) && backup && Object.prototype.hasOwnProperty.call(backup, k)) {
              const v = backup[k]
              if (v != null) {
                try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) } catch { }
              }
            }
          })
        }
      } else {
        // If fresh start, clear all backup and step data
        try {
          localStorage.removeItem('cs_backup_steps')
          const keysToRemove = [
            'cs_step1',
            'cs_step2',
            'cs_step3',
            'cs_step4',
            'cs_step4_shuffle',
            'cs_step5_grid',
            'cs_step5_text',
            'cs_step5_hybrid',
            'cs_step5_hybrid_grid',
            'cs_step5_hybrid_text',
            'cs_step5_hybrid_phase_order',
            'cs_step5_layer',
            'cs_step5_layer_background',
            'cs_step5_layer_preview_aspect',
            'cs_step6',
            'cs_step7_tasks',
            'cs_step7_matrix',
            'cs_step7_job_state',
            'cs_step7_timer_state',
            'cs_step8'
          ]
          keysToRemove.forEach(key => {
            try {
              localStorage.removeItem(key)
            } catch { }
          })
        } catch { }
      }
    } catch { }
    didRestoreBackupRef.current = true
  }

  // Hydrate study type and last step from localStorage to avoid resets on refresh
  // Also load draft study data from backend if resuming a draft
  useEffect(() => {
    if (typeof window === 'undefined') return

    const initializePage = async () => {
      try {
        // Check if this is a fresh start (user clicked "Create New Study")
        const isFreshStart = localStorage.getItem('cs_is_fresh_start') === 'true'

        // Check if we're resuming a draft study
        const studyId = localStorage.getItem('cs_study_id')
        const isResumingDraft = localStorage.getItem('cs_resuming_draft') === 'true'

        if (studyId) {
          // ALWAYS Sync with backend on mount if we have a study ID
          // This allows multiple users to see each other's changes on refresh
          // Load study data from backend
          // This will populate all step data from the backend for this specific study
          setIsLoadingDraft(true)
          setDraftLoadError(null)

          // Parse study_id: handle both plain string and JSON-stringified format
          let parsedStudyId = studyId
          try {
            const parsed = JSON.parse(studyId)
            if (typeof parsed === 'string') {
              parsedStudyId = parsed
            }
          } catch {
            // Already a plain string, use as-is
          }

          console.log('[CreateStudy] Loading draft study for study_id:', parsedStudyId)

          // Get the previously loaded study ID to check if we're switching studies
          const previousStudyId = sessionStorage.getItem('cs_previous_study_id')

          // If we're switching to a different study, clear the old data first
          if (previousStudyId && previousStudyId !== studyId) {
            console.log('[CreateStudy] Switching from study', previousStudyId, 'to study', studyId)
            const keysToRemove = [
              'cs_step1',
              'cs_step2',
              'cs_step3',
              'cs_step4',
              'cs_step4_shuffle',
              'cs_step5_grid',
              'cs_step5_text',
              'cs_step5_hybrid',
              'cs_step5_hybrid_grid',
              'cs_step5_hybrid_text',
              'cs_step5_hybrid_phase_order',
              'cs_step5_layer',
              'cs_step5_layer_background',
              'cs_step5_layer_preview_aspect',
              'cs_step6',
              'cs_step7_tasks',
              'cs_step7_matrix',
              'cs_step7_job_state',
              'cs_step7_timer_state',
              'cs_backup_steps',
              'cs_flash_message',
              'cs_step8'
            ]
            keysToRemove.forEach(key => {
              try {
                localStorage.removeItem(key)
              } catch { }
            })
          }

          try {
            await loadDraftStudyData(parsedStudyId, isResumingDraft)

            // Verify that key data was actually written to localStorage
            const step1Data = localStorage.getItem('cs_step1')
            if (!step1Data) {
              throw new Error('Failed to load study data: Basic details not found')
            }

            console.log('[CreateStudy] Successfully loaded draft study data for study_id:', studyId)

            // Store the current study ID so we can detect switches next time
            sessionStorage.setItem('cs_previous_study_id', studyId)

            // Clear the flag
            localStorage.removeItem('cs_resuming_draft')

            // Sync user role from localStorage after load
            const loadedRole = localStorage.getItem('user_role')
            if (loadedRole) setUserRole(loadedRole)

            setIsLoadingDraft(false)

            // No longer forcing a full page reload here, as we wrap the steps 
            // in isLoadingDraft check which will trigger a re-mount when it turns false.
            // window.location.reload()
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to load draft study data'
            console.error('[CreateStudy] Error loading draft study:', errorMsg, err)
            setDraftLoadError(errorMsg)
            // Clear the resuming draft flag so user can try again
            localStorage.removeItem('cs_resuming_draft')
            setIsLoadingDraft(false)
            return
          }
        } else if (isFreshStart || (!studyId && !isResumingDraft)) {
          // Fresh start - clear any old study data to ensure clean state
          const keysToRemove = [
            'cs_step1',
            'cs_step2',
            'cs_step3',
            'cs_step4',
            'cs_step5_grid',
            'cs_step5_text',
            'cs_step5_layer',
            'cs_step5_layer_background',
            'cs_step5_layer_preview_aspect',
            'cs_step6',
            'cs_step7_tasks',
            'cs_step7_matrix',
            'cs_step7_job_state',
            'cs_step7_timer_state',
            'cs_backup_steps',
            'cs_flash_message'
          ]
          keysToRemove.forEach(key => {
            try {
              localStorage.removeItem(key)
            } catch { }
          })
          // Clear the fresh start flag
          localStorage.removeItem('cs_is_fresh_start')
          // Clear the previous study ID so next resume loads fresh
          sessionStorage.removeItem('cs_previous_study_id')
          // Reset to step 1
          setCurrentStep(1)
        }

        // Hydrate study type (only if not in fresh start)
        if (!isFreshStart) {
          const s2 = localStorage.getItem('cs_step2')
          if (s2) {
            const v = JSON.parse(s2)
            if (v?.type === 'layer' || v?.type === 'grid' || v?.type === 'text' || v?.type === 'hybrid') setStudyType(v.type)
          }

          // Hydrate current step
          const savedStep = localStorage.getItem('cs_current_step')
          if (savedStep) {
            const stepNum = Number(savedStep)
            if (!Number.isNaN(stepNum) && stepNum >= 1 && stepNum <= 8) setCurrentStep(stepNum)
          }
        }
      } catch (error) {
        console.error('Error initializing page:', error)
      }
    }

    initializePage()
  }, [])


  // Persist current step for refresh continuity
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem('cs_current_step', String(currentStep)) } catch { }
  }, [currentStep])

  // Periodically snapshot all step keys into a backup to survive accidental clears
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stepKeys = ['cs_step1', 'cs_step2', 'cs_step3', 'cs_step4', 'cs_step5_grid', 'cs_step5_text', 'cs_step5_layer', 'cs_step6']
    const writeBackup = () => {
      try {
        const snapshot: Record<string, unknown> = {}
        stepKeys.forEach((k) => {
          const v = localStorage.getItem(k)
          if (v != null) snapshot[k] = v
        })
        localStorage.setItem('cs_backup_steps', JSON.stringify(snapshot))
      } catch { }
    }
    const id = window.setInterval(writeBackup, 2000)
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeBackup() })
    window.addEventListener('beforeunload', writeBackup)
    writeBackup()
    return () => {
      clearInterval(id)
      window.removeEventListener('beforeunload', writeBackup)
    }
  }, [])

  return (
    <AuthGuard requireAuth={true}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="min-h-screen bg-slate-100"
      >
        <DashboardHeader />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow-sm border border-[rgba(209,223,235,1)]">
            <div className="px-4 sm:px-6 lg:px-8 py-5 border-b border-[rgba(209,223,235,1)] sticky top-0 z-50 bg-white">
              {/* Error message if draft loading failed */}
              {draftLoadError && (
                <div className="mb-3 rounded-md px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
                  <strong>Error loading draft:</strong> {draftLoadError}
                </div>
              )}
              {/* Flash message from step redirects */}
              {typeof window !== 'undefined' && (() => {
                try {
                  const raw = localStorage.getItem('cs_flash_message')
                  if (!raw) return null
                  const msg = JSON.parse(raw)
                  // Clear immediately so it only shows once
                  localStorage.removeItem('cs_flash_message')
                  return (
                    <div className={`mb-3 rounded-md px-3 py-2 text-sm ${msg?.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                      {String(msg?.message || '')}
                    </div>
                  )
                } catch { return null }
              })()}
              <Stepper currentStep={currentStep} onStepChange={setCurrentStep} />
            </div>

            <div className="px-4 sm:px-6 lg:px-8 py-6">
              <div className={currentStep === 1 ? "block" : "hidden"} aria-hidden={currentStep !== 1}>
                <Step1BasicDetails key={`step1-${isLoadingDraft}`} onNext={() => setCurrentStep(2)} onCancel={() => history.back()} onDataChange={notifyStepDataChanged} isReadOnly={userRole === 'viewer'} />
              </div>
              <div className={currentStep === 2 ? "block" : "hidden"} aria-hidden={currentStep !== 2}>
                <Step2StudyType
                  key={`step2-${isLoadingDraft}`}
                  value={studyType}
                  onNext={(selected) => { setStudyType(selected); setCurrentStep(3) }}
                  onBack={() => setCurrentStep(1)}
                  onDataChange={notifyStepDataChanged}
                  isReadOnly={userRole === 'viewer'}
                />
              </div>
              <div className={currentStep === 3 ? "block" : "hidden"} aria-hidden={currentStep !== 3}>
                <Step3RatingScale key={`step3-${isLoadingDraft}`} onNext={() => setCurrentStep(4)} onBack={() => setCurrentStep(2)} onDataChange={notifyStepDataChanged} isReadOnly={userRole === 'viewer'} />
              </div>
              <div className={currentStep === 4 ? "block" : "hidden"} aria-hidden={currentStep !== 4}>
                <Step4ClassificationQuestions key={`step4-${isLoadingDraft}`} onNext={() => setCurrentStep(5)} onBack={() => setCurrentStep(3)} onDataChange={notifyStepDataChanged} isReadOnly={userRole === 'viewer'} />
              </div>
              <div className={currentStep === 5 ? "block" : "hidden"} aria-hidden={currentStep !== 5}>
                <Step5StudyStructure key={`step5-${isLoadingDraft}`} onNext={() => setCurrentStep(6)} onBack={() => setCurrentStep(4)} mode={studyType} onDataChange={notifyStepDataChanged} isReadOnly={userRole === 'viewer'} />
              </div>
              <div className={currentStep === 6 ? "block" : "hidden"} aria-hidden={currentStep !== 6}>
                <Step6AudienceSegmentation key={`step6-${isLoadingDraft}`} onNext={() => setCurrentStep(7)} onBack={() => setCurrentStep(5)} onDataChange={notifyStepDataChanged} isReadOnly={userRole === 'viewer'} />
              </div>
              <div className={currentStep === 7 ? "block" : "hidden"} aria-hidden={currentStep !== 7}>
                <Step7TaskGeneration key={`step7-${isLoadingDraft}`} active={currentStep === 7} onNext={() => setCurrentStep(8)} onBack={() => setCurrentStep(6)} onDataChange={notifyStepDataChanged} isReadOnly={userRole === 'viewer'} />
              </div>
              <div className={currentStep === 8 ? "block" : "hidden"} aria-hidden={currentStep !== 8}>
                <Step8LaunchPreview key={`step8-${isLoadingDraft}`} onBack={() => setCurrentStep(7)} onDataChange={notifyStepDataChanged} isReadOnly={userRole === 'viewer'} userRole={userRole} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AuthGuard>
  )
}
