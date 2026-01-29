"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { submitProductId } from "@/lib/api/ResponseAPI"

export default function ProductIdPage() {
    const params = useParams<{ id: string }>()
    const router = useRouter()

    const [productId, setProductId] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)

    useEffect(() => {
        const sessionData = localStorage.getItem("study_session")
        if (sessionData) {
            try {
                const parsed = JSON.parse(sessionData)
                if (parsed.sessionId) {
                    setSessionId(parsed.sessionId)
                }
            } catch (e) {
                console.error("Failed to parse session data", e)
            }
        }
    }, [])

    const isProductEntered = productId.trim().length > 0

    const handlePrimaryAction = async () => {
        const nextPath = `/participate/${params.id}/personal-information`

        // If nothing entered → Skip
        if (!isProductEntered) {
            router.push(nextPath)
            return
        }

        // If entered but no session → still allow next
        if (!sessionId) {
            router.push(nextPath)
            return
        }

        setIsSubmitting(true)
        try {
            await submitProductId(sessionId, productId.trim())
            router.push(nextPath)
        } catch (error) {
            console.error("Failed to submit product ID:", error)
            alert("Failed to save Product ID. Please try again or clear it to skip.")
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Product ID
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Enter Product ID to continue (Optional)
                    </p>
                </div>

                <div className="space-y-6">
                    <div>
                        <label htmlFor="product-id" className="sr-only">
                            Product ID
                        </label>
                        <input
                            id="product-id"
                            name="product-id"
                            type="text"
                            maxLength={100}
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            placeholder="Enter Product ID (max 100 characters)"
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md focus:outline-none focus:ring-[rgba(38,116,186,1)] focus:border-[rgba(38,116,186,1)] sm:text-sm"
                        />
                        <div className="mt-1 text-right text-xs text-gray-500">
                            {productId.length}/100
                        </div>
                    </div>

                    <button
                        onClick={handlePrimaryAction}
                        disabled={isSubmitting}
                        className="w-full flex justify-center items-center py-2 px-4 text-sm font-medium rounded-md text-white bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgba(38,116,186,1)] disabled:bg-gray-400"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Submitting...
                            </>
                        ) : isProductEntered
                            ? "Next"
                            : "Skip"}
                    </button>
                </div>
            </div>
        </div>
    )
}
