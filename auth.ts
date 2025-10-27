
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { Tokens } from "@/lib/api/LoginApi"

// Extend NextAuth types
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
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("=== SIGNIN CALLBACK TRIGGERED ===")
      console.log("Provider:", account?.provider)
      console.log("User:", user)
      console.log("Account:", account)
      console.log("Profile:", profile)
      
      // This runs when user successfully authenticates with Google
      if (account?.provider === "google") {
        try {
          console.log("Making OAuth API call to backend...")
          console.log("NEXT_PUBLIC_BASE_URL:", process.env.NEXT_PUBLIC_BASE_URL)
          
          // Test if the backend is reachable first
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:8000'
          const apiUrl = `${baseUrl}/auth/oauth-login`
          console.log("API URL:", apiUrl)
          console.log("Request payload:", {
            email: user.email,
            name: user.name,
            provider: 'google',
            provider_id: account.providerAccountId,
            profile_picture: user.image
          })
          
          // Call your backend OAuth endpoint
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              provider: 'google',
              provider_id: account.providerAccountId,
              profile_picture: user.image
            })
          });

          console.log("OAuth API response status:", response.status)
          console.log("OAuth API response headers:", response.headers)

          if (response.ok) {
            const data = await response.json();
            console.log("OAuth API response data:", data)
            
            // Store the backend tokens in the user object
            user.backendTokens = data.tokens;
            user.isNewUser = data.is_new_user;
            
            console.log("Stored backend data in user:", {
              backendTokens: user.backendTokens,
              isNewUser: user.isNewUser
            })
            
            // Note: localStorage is not available in server-side callbacks
            // The SessionHandler component will handle localStorage storage on the client side
            
            return true;
          } else {
            const errorText = await response.text();
            console.error('Backend OAuth failed:', errorText);
            return false;
          }
        } catch (error) {
          console.error('OAuth callback error:', error);
          return false;
        }
      }
      return true;
    },
    
    async jwt({ token, user, account }) {
      console.log("=== JWT CALLBACK TRIGGERED ===")
      console.log("User:", user)
      console.log("Token:", token)
      console.log("Account:", account)
      
      // Persist the backend tokens in the JWT
      if (user?.backendTokens) {
        console.log("Storing backend tokens in JWT")
        token.backendTokens = user.backendTokens;
        token.isNewUser = user.isNewUser;
      }
      return token;
    },
    
    async session({ session, token }) {
      console.log("=== SESSION CALLBACK TRIGGERED ===")
      console.log("Session:", session)
      console.log("Token:", token)
      console.log("Token has backendTokens:", !!token.backendTokens)
      
      // Send backend tokens to the client
      if (token.backendTokens) {
        console.log("Adding backend tokens to session")
        session.backendTokens = token.backendTokens as Tokens;
        session.isNewUser = token.isNewUser as boolean | undefined;
        console.log("Session after adding backend data:", session)
      } else {
        console.log("No backend tokens found in token")
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})