"use client";
import { createContext, useContext, useEffect, useState } from "react";
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
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          const userRole = (tokenResult.claims.role as string) || null;
          setRole(userRole);
          // Set session + role cookies for middleware
          document.cookie = "__session=1; path=/; SameSite=Lax";
          if (userRole) {
            document.cookie = `__role=${userRole}; path=/; SameSite=Lax`;
          }
        } catch {
          setRole(null);
        }
      } else {
        setRole(null);
        // Clear cookies on sign-out
        document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  const getToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoaded, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
