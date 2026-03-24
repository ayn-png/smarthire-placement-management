"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onIdTokenChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  role: string | null;
  isLoaded: boolean;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoaded: false,
  getToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Single state object → one setState call per auth event = one render (not three)
  const [authState, setAuthState] = useState<{
    user: User | null;
    role: string | null;
    isLoaded: boolean;
  }>({ user: null, role: null, isLoaded: false });

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          const userRole = (tokenResult.claims.role as string) || null;
          // Set session + role cookies for middleware
          document.cookie = "__session=1; path=/; SameSite=Lax";
          if (userRole) {
            document.cookie = `__role=${userRole}; path=/; SameSite=Lax`;
          }
          // ONE setState call → ONE render
          setAuthState({ user: firebaseUser, role: userRole, isLoaded: true });
        } catch {
          setAuthState({ user: firebaseUser, role: null, isLoaded: true });
        }
      } else {
        // Clear cookies on sign-out
        document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        // ONE setState call → ONE render
        setAuthState({ user: null, role: null, isLoaded: true });
      }
    });

    return () => unsubscribe();
  }, []);

  // Stable function reference — only changes when `user` changes, not on every render
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!authState.user) return null;
    try {
      return await authState.user.getIdToken();
    } catch {
      return null;
    }
  }, [authState.user]);

  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        role: authState.role,
        isLoaded: authState.isLoaded,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
