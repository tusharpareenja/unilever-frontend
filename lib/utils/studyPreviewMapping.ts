import { normalizeClassificationId } from "@/lib/api/StudyAPI"

/**
 * Hydrates localStorage with study data from the API to make the preview flow work.
 * This effectively "fakes" a study creation session for the recipient of a shareable link.
 */
/**
 * Hydrates localStorage with study data from the API to make the preview flow work.
 * Supports both root-level study details and the "info" API structure with study_info.
 */
export function hydrateLocalStorageFromStudy(data: any) {
    if (typeof window === "undefined") return

    // Extract core info (new API has 'study_info', old one had it at root)
    const info = data.study_info || data
    const tasks = data.assigned_tasks || data.tasks
    const classificationQuestions = data.classification_questions || []
    const metadata = data.metadata || {}

    // 1. Step 1: Basic Details
    const s1 = {
        title: info.title || "",
        description: info.background || "", // Backend uses 'background' for description
        language: info.language || "ENGLISH",
        agree: true,
    }
    localStorage.setItem("cs_step1", JSON.stringify(s1))

    // 2. Step 2: Study Configuration
    const s2 = {
        type: info.study_type || "grid",
        mainQuestion: info.main_question || "",
        orientationText: info.orientation_text || "",
    }
    localStorage.setItem("cs_step2", JSON.stringify(s2))

    // 3. Step 3: Rating Scale
    if (info.rating_scale) {
        const s3 = {
            minValue: info.rating_scale.min_value || 1,
            maxValue: info.rating_scale.max_value || 5,
            minLabel: info.rating_scale.min_label || "",
            maxLabel: info.rating_scale.max_label || "",
            middleLabel: info.rating_scale.middle_label || "",
        }
        localStorage.setItem("cs_step3", JSON.stringify(s3))
    }

    // 4. Step 4: Classification Questions
    if (classificationQuestions.length > 0) {
        const s4 = classificationQuestions.map((q: any) => ({
            id: normalizeClassificationId(q.question_id || q.id, crypto.randomUUID()),
            title: q.question_text,
            required: q.is_required === true || q.is_required === "Y",
            options: q.answer_options?.map((o: any) => ({
                id: normalizeClassificationId(o.id || o.option_id, crypto.randomUUID()),
                text: o.text || o.option_text,
            })),
        }))
        localStorage.setItem("cs_step4", JSON.stringify(s4))
    }

    // 5. Step 5: Study Structure (Simplified as we mostly rely on tasks/elements in assigned_tasks)
    // For grid/text, we might still need categories if the preview landing page uses them for stats
    if (info.study_type === "grid" || info.study_type === "text") {
        if (info.categories && info.categories.length > 0) {
            const categories = info.categories.map((cat: any) => ({
                id: cat.category_id,
                title: cat.name,
                elements: (info.elements || [])
                    .filter((el: any) => el.category_id === cat.category_id)
                    .map((el: any) => ({
                        id: el.id || el.element_id,
                        name: el.name,
                        secureUrl: el.content,
                    })),
            }))
            localStorage.setItem(info.study_type === "grid" ? "cs_step5_grid" : "cs_step5_text", JSON.stringify(categories))
        }
    } else if (info.study_type === "layer") {
        const layers = (info.study_layers || []).map((l: any) => ({
            id: l.id || l.layer_id,
            name: l.name,
            z: l.z_index,
            images: l.images?.map((img: any) => ({
                id: img.id || img.image_id,
                name: img.name,
                secureUrl: img.url,
            })),
        }))
        localStorage.setItem("cs_step5_layer", JSON.stringify(layers))

        if (metadata.background_image_url || info.background_image_url) {
            localStorage.setItem("cs_step5_layer_background", JSON.stringify({
                secureUrl: metadata.background_image_url || info.background_image_url
            }))
        }
    }

    // 6. Step 6: Study Design (Reverted as toggle_shuffle is for classification questions)
    // const s6 = {
    //     designType: "standard",
    // }
    // localStorage.setItem("cs_step6", JSON.stringify(s6))

    // Store classification shuffle setting
    if (info.toggle_shuffle !== undefined) {
        localStorage.setItem("cs_step4_shuffle", JSON.stringify(info.toggle_shuffle))
    }

    // 7. Step 7: Tasks/Matrix
    if (tasks) {
        localStorage.setItem("cs_step7_matrix", JSON.stringify({
            tasks: tasks,
            completed: true
        }))
    }

    // 7. Store the study ID for reference
    localStorage.setItem("cs_study_id", JSON.stringify(info.id || data.study_id))

    // Set flag that this session is from a shared preview
    localStorage.setItem("cs_is_shared_preview", "true")

    // Store respondent_id if available (useful for API-driven preview actions)
    if (data.respondent_id) {
        localStorage.setItem("cs_respondent_id", JSON.stringify(data.respondent_id))
    }
}
