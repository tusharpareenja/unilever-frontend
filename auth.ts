
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
      // This runs when user successfully authenticates with Google
      if (account?.provider === "google") {
        try {
          // Test if the backend is reachable first
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:8000'
          const apiUrl = `${baseUrl}/auth/oauth-login`
          
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

          if (response.ok) {
            const data = await response.json();
            
            // Store the backend tokens in the user object
            user.backendTokens = data.tokens;
            user.isNewUser = data.is_new_user;
            
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
      // Persist the backend tokens in the JWT
      if (user?.backendTokens) {
        token.backendTokens = user.backendTokens;
        token.isNewUser = user.isNewUser;
      }
      return token;
    },
    
    async session({ session, token }) {
      // Send backend tokens to the client
      if (token.backendTokens) {
        session.backendTokens = token.backendTokens as Tokens;
        session.isNewUser = token.isNewUser as boolean | undefined;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})