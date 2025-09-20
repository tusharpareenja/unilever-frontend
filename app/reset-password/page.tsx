"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff } from "lucide-react"
import { API_BASE_URL } from "@/lib/api/LoginApi"

export default function ResetPasswordPage() {
  const [token, setToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [isResetting, setIsResetting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isTokenValid, setIsTokenValid] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  

  // Get token from URL query parameter
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token')
    console.log("Token from URL:", tokenFromUrl)
    console.log("Base URL:", API_BASE_URL)
    if (tokenFromUrl) {
      setToken(tokenFromUrl)
      validateToken(tokenFromUrl)
    } else {
      setErrorMessage("Invalid reset link. No token provided.")
      setIsValidating(false)
    }
  }, [searchParams, API_BASE_URL])

  // Validate token with backend
  const validateToken = async (tokenToValidate: string) => {
    try {
      const fullUrl = `${API_BASE_URL}/auth/validate-reset-token/${tokenToValidate}`
      console.log("Validating token:", tokenToValidate)
      console.log("Full URL:", fullUrl)
      
      const response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      console.log("Token validation response status:", response.status)
      console.log("Response headers:", response.headers)
      
      if (response.ok) {
        const responseData = await response.json()
        console.log("Token validation success:", responseData)
        setIsTokenValid(true)
        setSuccessMessage("You can now reset your password.")
      } else {
        const errorData = await response.json()
        console.error("Token validation error response:", errorData)
        setErrorMessage(`Invalid or expired reset link. Error: ${errorData?.detail || 'Unknown error'}`)
      }
    } catch (error) {
      console.error("Token validation network error:", error)
      setErrorMessage(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsValidating(false)
    }
  }

  // Reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    // Validation
    if (!newPassword.trim()) {
      setErrorMessage("Please enter a new password.")
      return
    }

    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }

    setIsResetting(true)
    try {
      console.log("Resetting password with token:", token)
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          new_password: newPassword
        }),
      })

      console.log("Reset password response status:", response.status)
      const data = await response.json()
      console.log("Reset password response data:", data)

      if (response.ok) {
        setSuccessMessage("Password has been reset successfully! You can now login with your new password.")
        // Clear form
        setNewPassword("")
        setConfirmPassword("")
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } else {
        setErrorMessage(data?.detail || "Failed to reset password. Please try again.")
      }
    } catch (error) {
      console.error("Reset password error:", error)
      setErrorMessage("Failed to reset password. Please try again.")
    } finally {
      setIsResetting(false)
    }
  }

  // Loading state while validating token
  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating reset link...</p>
        </div>
      </div>
    )
  }

  // Error state if token is invalid
  if (!isTokenValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">Invalid Reset Link</h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <Button 
            onClick={() => router.push('/login')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full font-medium"
          >
            Back to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-200 via-blue-200 to-purple-200 rounded-t-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-800">Reset Your Password</h1>
        </div>

        {/* Form */}
        <div className="p-6">
          {errorMessage && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
              {errorMessage}
            </div>
          )}
          
          {successMessage && (
            <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-4">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  className="w-full px-4 py-3 pr-12 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  className="w-full px-4 py-3 pr-12 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full font-medium transition-colors"
              disabled={isResetting}
            >
              {isResetting ? "Resetting Password..." : "Reset Password"}
            </Button>
          </form>

          <div className="text-center mt-6">
            <button 
              onClick={() => router.push('/login')}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
