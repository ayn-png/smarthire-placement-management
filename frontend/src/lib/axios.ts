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
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Only hard-redirect to login if Firebase ALSO confirms there is no active
      // session. If auth.currentUser exists the 401 is a backend config issue
      // (e.g. wrong service-account key on the server) — silently reject instead
      // of creating a middleware redirect loop (/login → /student/dashboard → …).
      if (!auth.currentUser) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
