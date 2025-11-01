"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff } from "lucide-react"
import { login as loginApi, forgotPassword } from "@/lib/api/LoginApi"
import { useAuth } from "@/lib/auth/AuthContext"
import { signIn } from "next-auth/react"

interface LoginFormProps {
  onSwitchToRegister: () => void
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleGoogleSignIn = async () => {
    try {
      // Use NextAuth.js with callbackUrl to redirect to a custom handler page
      await signIn("google", { 
        callbackUrl: "/auth/callback"
      })
      
    } catch (error) {
      setErrorMessage("Google sign-in failed. Please try again.")
    }
  }

  const handleMicrosoftSignIn = async () => {
    try {
      // Use NextAuth.js with callbackUrl to redirect to a custom handler page
      await signIn("microsoft-entra-id", { 
        callbackUrl: "/auth/callback"
      })
      
    } catch (error) {
      setErrorMessage("Microsoft sign-in failed. Please try again.")
    }
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const emailOrUsername = formData.get('emailOrUsername') as string
    
    if (!emailOrUsername.trim()) {
      alert("Please enter your email.")
      return
    }

    setIsSendingReset(true)
    try {
      // console.log("Calling forgot password API with:", emailOrUsername.trim())
      // Call the real forgot password API
      const response = await forgotPassword({
        email: emailOrUsername.trim()
      })
      // console.log("API Response:", response)
      alert("Password reset link has been sent to your email address")
      setShowForgotPasswordDialog(false)
    } catch (err: any) {
      console.error("Forgot password API error:", err)
      let message = "Failed to send reset email. Please try again."
      
      if (err?.data?.detail) {
        if (typeof err.data.detail === 'string') {
          message = err.data.detail
        } else if (Array.isArray(err.data.detail)) {
          message = err.data.detail.map((error: any) => {
            if (typeof error === 'string') return error
            if (typeof error === 'object') return error.msg || error.message || JSON.stringify(error)
            return String(error)
          }).join(', ')
        } else if (typeof err.data.detail === 'object') {
          message = err.data.detail.message || err.data.detail.msg || 'Validation error occurred'
        }
      } else if (err?.message) {
        message = err.message
      }
      
      alert(message)
    } finally {
      setIsSendingReset(false)
    }
  }

  return (
    <div className="w-full">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-green-200 via-blue-200 to-purple-200 rounded-t-lg p-4 sm:p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-800">Login Your Account</h1>
      </div>

      {/* Form content */}
      <div className="bg-white rounded-b-lg p-4 sm:p-6 md:p-8 shadow-lg">
        <div className="mb-8">
          <h2 className="text-2xl font-normal text-gray-800">
            Welcome To <span className="text-blue-600 font-semibold">Mindsurve</span>
          </h2>
        </div>

        <form
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault()
            setErrorMessage("")
            setSuccessMessage("")
            if (!identifier || !password) {
              setErrorMessage("Please enter email and password.")
              return
            }
            setIsSubmitting(true)
            try {
              const response = await loginApi({
                email: identifier,
                password,
              })
              
              // Store user data and tokens in auth context
              login(response.user, response.tokens)
              
              setSuccessMessage("Logged in successfully.")
              
              // Redirect to home page after successful login
              setTimeout(() => {
                router.push('/home')
              }, 1000)
              
            } catch (err: unknown) {
              let message = "Login failed."
              
              if ((err as any)?.data?.detail) {
                // Handle different error formats
                if (typeof (err as any).data.detail === 'string') {
                  message = (err as any).data.detail
                } else if (Array.isArray((err as any).data.detail)) {
                  // Handle validation errors array
                  message = (err as any).data.detail.map((error: Record<string, unknown>) => {
                    if (typeof error === 'string') return error
                    if (typeof error === 'object') return error.msg || error.message || JSON.stringify(error)
                    return String(error)
                  }).join(', ')
                } else if (typeof (err as any).data.detail === 'object') {
                  // Handle object errors
                  message = (err as any).data.detail.message || (err as any).data.detail.msg || 'Validation error occurred'
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
            <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-md px-3 py-2">
              {successMessage}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <Input
              type="email"
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="w-full px-4 py-3 pr-12 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-gray-600 ">
                Remember me
              </label>
            </div>
            <button 
              type="button" 
              onClick={() => setShowForgotPasswordDialog(true)} 
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
            >
              Forgot Password ?
            </button>
          </div>

          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full font-medium transition-colors cursor-pointer" 
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </Button>

          <div className="text-center">
            <span className="text-gray-500">or</span>
          </div>

          <div className="flex flex-col justify-center gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors py-3 px-4"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
              <span className="text-gray-700 font-medium cursor-pointer">Continue with Google</span>
            </button>
            <button
              type="button"
              onClick={handleMicrosoftSignIn}
              className="w-full bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors py-3 px-4"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23">
                <path fill="#f25022" d="M1 1h10v10H1z"/>
                <path fill="#00a4ef" d="M12 1h10v10H12z"/>
                <path fill="#7fba00" d="M1 12h10v10H1z"/>
                <path fill="#ffb900" d="M12 12h10v10H12z"/>
              </svg>
              <span className="text-gray-700 font-medium cursor-pointer">Continue with Microsoft</span>
            </button>
          </div>

          <div className="text-center mt-6">
            <span className="text-gray-600">Don&apos;t have an account ? </span>
            <button 
              type="button" 
              onClick={onSwitchToRegister} 
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors cursor-pointer"
            >
              Sign up
            </button>
          </div>
        </form>
      </div>
      
      {/* Enhanced Forgot Password Dialog with Blur Background */}
      {showForgotPasswordDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100 animate-slideIn">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-800">Forgot Password</h2>
                <button
                  onClick={() => setShowForgotPasswordDialog(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>
              
              <p className="text-gray-600 mb-6 leading-relaxed">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <Input
                    name="emailOrUsername"
                    type="email"
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForgotPasswordDialog(false)}
                    className="flex-1 py-3 rounded-full border-gray-300 hover:bg-gray-50 transition-colors"
                    disabled={isSendingReset}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full font-medium transition-colors"
                    disabled={isSendingReset}
                  >
                    {isSendingReset ? "Sending..." : "Send Reset Link"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add custom animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}