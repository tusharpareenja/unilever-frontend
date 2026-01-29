"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function PreviewProductIdPage() {
    const router = useRouter()
    const [productId, setProductId] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const isProductEntered = productId.trim().length > 0

    const handlePrimaryAction = () => {
        const nextPath = '/home/create-study/preview/personal-information'
        setIsSubmitting(true)
        // In preview, we don't actually submit to the backend session
        // Just navigate to the next step
        setTimeout(() => {
            router.push(nextPath)
        }, 500)
    }

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Product ID (Preview)
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
                                Continuing...
                            </>
                        ) : isProductEntered ? "Next" : "Skip"}
                    </button>
                </div>
            </div>
        </div>
    )
}
