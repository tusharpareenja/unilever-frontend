"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

interface Step1BasicDetailsProps {
  onNext: () => void
  onCancel: () => void
  onDataChange?: () => void
  isReadOnly?: boolean
}

function readTokens(): { access_token?: string; refresh_token?: string; token_type?: string } | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('tokens') : null
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function createStudyMinimal(title: string, background: string, language: string) {
  const tokens = readTokens()
  if (!tokens) throw new Error("Authentication token not found")

  const res = await fetch(`${API_BASE_URL}/studies/minimal`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokens.access_token}`
    },
    body: JSON.stringify({
      title,
      background,
      language: language.toLowerCase().substring(0, 2),
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.detail || "Failed to create study")
  return data
}

export function Step1BasicDetails({ onNext, onCancel, onDataChange, isReadOnly = false }: Step1BasicDetailsProps) {
  const [title, setTitle] = useState(() => {
    try { const v = localStorage.getItem('cs_step1'); if (v) { const o = JSON.parse(v); return o.title || "" } } catch { };
    return ""
  })
  const [description, setDescription] = useState(() => {
    try { const v = localStorage.getItem('cs_step1'); if (v) { const o = JSON.parse(v); return o.description || "" } } catch { };
    return ""
  })
  const [language, setLanguage] = useState(() => {
    try {
      const v = localStorage.getItem('cs_step1')
      if (v) {
        const o = JSON.parse(v)
        let lang = o.language || "ENGLISH"

        // Map language codes to full names
        const languageMap: Record<string, string> = {
          'en': 'ENGLISH',
          'es': 'SPANISH',
          'fr': 'FRENCH',
          'de': 'GERMAN',
          'it': 'ITALIAN',
          'pt': 'PORTUGUESE',
          'nl': 'DUTCH',
          'ru': 'RUSSIAN',
          'zh': 'CHINESE',
          'ja': 'JAPANESE',
          'ko': 'KOREAN',
          'ar': 'ARABIC',
          'hi': 'HINDI',
          'sv': 'SWEDISH',
          'no': 'NORWEGIAN',
          'da': 'DANISH',
          'fi': 'FINNISH',
          'pl': 'POLISH',
          'cs': 'CZECH',
          'hu': 'HUNGARIAN'
        }

        // If language is a code, map it to full name
        if (lang.length <= 2) {
          lang = languageMap[lang.toLowerCase()] || 'ENGLISH'
        }

        return lang
      }
    } catch { }
    return "ENGLISH"
  })
  const [agree, setAgree] = useState(() => {
    try { const v = localStorage.getItem('cs_step1'); if (v) { const o = JSON.parse(v); return Boolean(o.agree) } } catch { };
    return false
  })
  const [showTerms, setShowTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('cs_step1', JSON.stringify({ title, description, language, agree }))
    onDataChange?.()
  }, [title, description, language, agree, onDataChange])

  const handleNext = async () => {
    if (loading) return
    setError(null)

    // If read-only, we just navigate. No saving.
    if (isReadOnly) {
      onNext()
      return
    }

    // Check if cs_study_id already exists in localStorage
    const existingStudyId = localStorage.getItem('cs_study_id')
    if (existingStudyId) {
      // Study already exists, skip API call and proceed
      console.log('Study already exists with ID:', existingStudyId)
      onNext()
      return
    }

    setLoading(true)
    try {
      const response = await createStudyMinimal(title, description, language)
      const studyId = response.id || response.study_id
      if (!studyId) throw new Error("No study ID returned")
      localStorage.setItem('cs_study_id', studyId)
      onNext()
    } catch (err: any) {
      setError(err.message || "Failed to create study")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="space-y-5">
        <div className={isReadOnly ? "opacity-70 pointer-events-none" : ""}>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Study Title <span className="text-red-500">*</span></label>
          <Input
            placeholder="Enter a descriptive title for your study."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg"
            disabled={isReadOnly}
          />
          <p className="mt-2 text-xs text-gray-500">Choose a clear, descriptive title (3–200 characters)</p>
        </div>

        <div className={isReadOnly ? "opacity-70 pointer-events-none" : ""}>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Study Description <span className="text-red-500">*</span></label>
          <textarea
            placeholder="Describe the background and purpose of your study."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[120px] rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)] disabled:bg-gray-50 disabled:text-gray-500"
            disabled={isReadOnly}
          />
          <p className="mt-2 text-xs text-gray-500">Provide context about your study (max 2000 characters)</p>
        </div>

        <div className={isReadOnly ? "opacity-70 pointer-events-none" : ""}>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Language <span className="text-red-500">*</span></label>
          <Select value={language} onValueChange={setLanguage} disabled={isReadOnly}>
            <SelectTrigger className="w-full rounded-lg">
              <SelectValue placeholder="Select a language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ENGLISH">English</SelectItem>
              <SelectItem value="SPANISH">Spanish</SelectItem>
              <SelectItem value="FRENCH">French</SelectItem>
              <SelectItem value="GERMAN">German</SelectItem>
              <SelectItem value="ITALIAN">Italian</SelectItem>
              <SelectItem value="PORTUGUESE">Portuguese</SelectItem>
              <SelectItem value="DUTCH">Dutch</SelectItem>
              <SelectItem value="RUSSIAN">Russian</SelectItem>
              <SelectItem value="CHINESE">Chinese</SelectItem>
              <SelectItem value="JAPANESE">Japanese</SelectItem>
              <SelectItem value="KOREAN">Korean</SelectItem>
              <SelectItem value="ARABIC">Arabic</SelectItem>
              <SelectItem value="HINDI">Hindi</SelectItem>
              <SelectItem value="SWEDISH">Swedish</SelectItem>
              <SelectItem value="NORWEGIAN">Norwegian</SelectItem>
              <SelectItem value="DANISH">Danish</SelectItem>
              <SelectItem value="FINNISH">Finnish</SelectItem>
              <SelectItem value="POLISH">Polish</SelectItem>
              <SelectItem value="CZECH">Czech</SelectItem>
              <SelectItem value="HUNGARIAN">Hungarian</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-gray-500">Choose the primary language for your study</p>
        </div>

        <div className={`flex items-start sm:items-center gap-2 ${isReadOnly ? "opacity-70 pointer-events-none" : ""}`}>
          <input id="agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="w-4 h-4 mt-1 sm:mt-0 cursor-pointer" disabled={isReadOnly} />
          <label htmlFor="agree" className="text-sm text-gray-700">
            I Read and Agree to <span
              className="text-[rgba(38,116,186,1)] cursor-pointer hover:underline"
              onClick={() => !isReadOnly && setShowTerms(true)}
            >
              Terms and Conditions
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
        <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto cursor-pointer" onClick={onCancel} disabled={loading}>Cancel</Button>
        <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto">
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <Button
            className="cursor-pointer rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto disabled:opacity-60"
            onClick={handleNext}
            disabled={!title || !description || !agree || loading}
          >
            {loading ? "Saving..." : "Save & Next"}
          </Button>
        </div>
      </div>

      {/* Terms and Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Terms and Conditions</h2>
              <button
                className="text-gray-500 hover:text-gray-700 text-xl"
                onClick={() => setShowTerms(false)}
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4 text-sm text-gray-700">
                <h3 className="font-semibold text-base">1. Study Creation and Management</h3>
                <p>By creating a study on this platform, you agree to comply with all applicable laws and regulations. You are responsible for ensuring that your study content is appropriate, accurate, and does not violate any third-party rights.</p>

                <h3 className="font-semibold text-base">2. Data Collection and Privacy</h3>
                <p>You acknowledge that participant data will be collected according to our privacy policy. You must obtain proper consent from participants and ensure compliance with data protection regulations such as GDPR, CCPA, and other applicable privacy laws.</p>

                <h3 className="font-semibold text-base">3. Content Guidelines</h3>
                <p>Your study content must not contain:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Offensive, discriminatory, or inappropriate material</li>
                  <li>Copyrighted content without proper authorization</li>
                  <li>Misleading or false information</li>
                  <li>Content that violates platform policies</li>
                </ul>

                <h3 className="font-semibold text-base">4. Participant Rights</h3>
                <p>Participants have the right to withdraw from your study at any time. You must respect their privacy and provide clear information about data usage. Participants should be able to contact you with questions or concerns.</p>

                <h3 className="font-semibold text-base">5. Platform Usage</h3>
                <p>You agree to use the platform responsibly and not to:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Attempt to circumvent platform security measures</li>
                  <li>Use the platform for illegal activities</li>
                  <li>Interfere with other users' studies</li>
                  <li>Share your account credentials</li>
                </ul>

                <h3 className="font-semibold text-base">6. Intellectual Property</h3>
                <p>You retain ownership of your study content, but grant the platform a license to host and display your studies. The platform's software and features remain our intellectual property.</p>

                <h3 className="font-semibold text-base">7. Limitation of Liability</h3>
                <p>The platform is provided "as is" without warranties. We are not liable for any damages arising from your use of the platform or your studies. You use the platform at your own risk.</p>

                <h3 className="font-semibold text-base">8. Termination</h3>
                <p>We reserve the right to suspend or terminate your account if you violate these terms. You may terminate your account at any time by contacting support.</p>

                <h3 className="font-semibold text-base">9. Changes to Terms</h3>
                <p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>

                <h3 className="font-semibold text-base">10. Contact Information</h3>
                <p>For questions about these terms, please contact our support team at support@example.com or through the platform's help center.</p>

                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    Last updated: {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowTerms(false)}
                className="px-4 py-2"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

