"use client";

import { useEffect, useState } from "react";
import { createAuthClient } from "better-auth/react";

// Extended auth client with session checking functionality
export const authClient = createAuthClient();

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        setIsLoading(true);
        const { data: session } = await authClient.getSession();
        
        if (session?.user) {
          setUser(session.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Error checking auth session:", error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    signIn: authClient.signIn,
    signOut: authClient.signOut,
  };
}
