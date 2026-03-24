import axios from "axios";
import { auth } from "@/lib/firebase";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch {
        // Token refresh failed — proceed without token
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      if (!auth.currentUser) {
        // Genuinely not logged in — redirect to login page
        window.location.href = "/login";
      } else {
        // User IS authenticated via Firebase but the backend returned 401.
        // This happens when the Firestore users/{uid} document is missing
        // (firebase-sync failed silently during role-select). Auto-heal by
        // calling /auth/self-sync which creates the doc, then retry once.
        const original = error.config as typeof error.config & { _retried?: boolean };
        if (!original._retried) {
          original._retried = true;
          try {
            const token = await auth.currentUser.getIdToken();
            // Use bare axios (not the api instance) to avoid this interceptor
            // running recursively on the self-sync call itself.
            await axios.post(
              `${API_URL}/api/v1/auth/self-sync`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            // Re-attach fresh token and retry the original request
            original.headers = {
              ...(original.headers ?? {}),
              Authorization: `Bearer ${token}`,
            };
            return api(original);
          } catch {
            // self-sync also failed — nothing more we can do, fall through
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
