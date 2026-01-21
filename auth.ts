import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { Tokens } from "@/lib/api/LoginApi"

// Extend NextAuth types??
declare module "next-auth" {
  interface User {
    backendTokens?: Tokens
    isNewUser?: boolean
  }

  interface Session {
    backendTokens?: Tokens
    isNewUser?: boolean
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    MicrosoftEntraID,
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "microsoft-entra-id") {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:8000"
          const apiUrl = `${baseUrl}/auth/oauth-login`

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              provider: account.provider,
              provider_id: account.providerAccountId,
              profile_picture: user.image,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            user.backendTokens = data.tokens
            user.isNewUser = data.is_new_user
            return true
          } else {
            console.error("Backend OAuth failed:", await response.text())
            return false
          }
        } catch (error) {
          console.error("OAuth callback error:", error)
          return false
        }
      }
      return true
    },

    async jwt({ token, user }) {
      if (user?.backendTokens) {
        token.backendTokens = user.backendTokens
        token.isNewUser = user.isNewUser
      }
      return token
    },

    async session({ session, token }) {
      if (token.backendTokens) {
        session.backendTokens = token.backendTokens as Tokens
        session.isNewUser = token.isNewUser as boolean | undefined
      }
      return session
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
})