/**
 * auth.ts — Compatibility shim. These functions are no-ops.
 * Authentication is handled by Firebase Auth via AuthContext.
 * Use `useAuth()` from `@/contexts/AuthContext` in components.
 */

import { UserRole } from "@/types";

// No-ops kept for call-site compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveTokens(_tokens: any): void {}
export function clearTokens(): void {}
export function getAccessToken(): undefined { return undefined; }
export function getUserRole(): UserRole | undefined { return undefined; }
export function getUserId(): string | undefined { return undefined; }
export function getUserName(): string | undefined { return undefined; }
export function isAuthenticated(): boolean { return false; }

/** Pure helper — determines the correct dashboard path for a given role. */
export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case "STUDENT":
      return "/student/dashboard";
    case "PLACEMENT_ADMIN":
      return "/admin/dashboard";
    case "COLLEGE_MANAGEMENT":
      return "/management/dashboard";
    default:
      return "/login";
  }
}
