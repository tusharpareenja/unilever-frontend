"use client"

import { useState } from "react"
import Image from "next/image"
import { LoginForm } from "./components/login"
import { RegisterForm } from "./components/register-form"
import { AuthGuard } from "@/components/auth/AuthGuard"

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <AuthGuard requireAuth={false}>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
        {/* Left side - Auth forms */}
        <div className="w-full md:flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
          <div className="w-full max-w-sm sm:max-w-md md:max-w-md lg:max-w-lg">
            {isLogin ? (
              <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
            ) : (
              <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
            )}
          </div>
        </div>

        {/* Right side - Study image */}
        <div className="hidden md:flex md:flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 items-center justify-center p-8">
          <div className="text-center">
            

            {/* Animated GIF from public folder */}
            <div className="relative mt-4 w-32 h-32 lg:w-40 lg:h-40 mx-auto rounded-md shadow-sm overflow-hidden">
              <Image
                src="/giphy.gif"
                alt="Animated illustration"
                fill
                style={{ objectFit: 'contain' }}
              />
            </div>

            <h2 className="mt-6 text-xl lg:text-2xl font-semibold text-gray-800">Enhance Your Learning Journey</h2>
            <p className="mt-2 text-gray-600">Join thousands of students in their academic success</p>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
