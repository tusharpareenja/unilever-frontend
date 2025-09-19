"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff } from "lucide-react"
import { register as registerApi } from "@/lib/api/LoginApi"
import { useAuth } from "@/lib/auth/AuthContext"

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const { login } = useAuth()
  const router = useRouter()

  return (
    <div className="w-full">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-green-200 via-blue-200 to-purple-200 rounded-t-lg p-4 sm:p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-800">Create Your Account</h1>
      </div>

      {/* Form content */}
      <div className="bg-white rounded-b-lg p-4 sm:p-6 md:p-8 shadow-lg">
        <div className="mb-8">
          <h2 className="text-2xl font-normal text-gray-800">
            Welcome To <span className="text-blue-600 font-semibold">UniliverImageStudy</span>
          </h2>
        </div>

        <form
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault()
            setErrorMessage("")
            setSuccessMessage("")
            if (!fullName || !username || !email || !password || !confirmPassword) {
              setErrorMessage("Please fill in all required fields.")
              return
            }
            if (password !== confirmPassword) {
              setErrorMessage("Passwords do not match.")
              return
            }
            setIsSubmitting(true)
            try {
              const response = await registerApi({
                username,
                email,
                name: fullName,
                password,
              })
              
              // Store user data and tokens in auth context
              login(response.user, response.tokens)
              
              setSuccessMessage("Account created successfully.")
              
              // Redirect to home page after successful registration
              setTimeout(() => {
                router.push('/home')
              }, 1000)
              
            } catch (err: unknown) {
              console.error('Registration error:', err)
              let message = "Registration failed."
              
              if ((err as any)?.data?.detail) {
                // Handle different error formats
                if (typeof (err as any).data.detail === 'string') {
                  message = (err as any).data.detail
                } else if (Array.isArray((err as any).data.detail)) {
                  // Handle validation errors array
                  message = (err as any).data.detail.map((error: Record<string, unknown>) => error.msg || error.message || error).join(', ')
                } else if (typeof (err as any).data.detail === 'object') {
                  // Handle object errors
                  message = (err as any).data.detail.message || (err as any).data.detail.msg || JSON.stringify((err as any).data.detail)
                }
              } else if ((err as Error)?.message) {
                message = (err as Error).message
              }
              
              setErrorMessage(message)
            } finally {
              setIsSubmitting(false)
            }
          }}
        >
          {errorMessage && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {typeof errorMessage === 'string' ? errorMessage : 'An error occurred'}
            </div>
          )}
          {successMessage && (
            <div className="text-green-700 text-sm bg-green-50 border green-200 rounded-md px-3 py-2">
              {successMessage}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="Enter your full name"
                className="w-full px-4 py-3 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="Choose a username"
                className="w-full px-4 py-3 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              placeholder="Enter your password"
              className="w-full px-4 py-3 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="w-full px-4 py-3 pr-12 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  className="w-full px-4 py-3 pr-12 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full font-medium" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Account"}
          </Button>

          <div className="text-center">
            <span className="text-gray-500">or</span>
          </div>

          <div className="flex justify-center space-x-4">
            {/* <button
              type="button"
              className="w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </button> */}
            {/* <button
              type="button"
              className="w-12 h-12 bg-black rounded-full flex items-center justify-center hover:bg-gray-800"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            </button> */}
          </div>

          <div className="text-center mt-6">
            <span className="text-gray-600">Already have an Account ? </span>
            <button type="button" onClick={onSwitchToLogin} className="text-blue-600 hover:underline font-medium">
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
