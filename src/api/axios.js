import axios from "axios";

const api = axios.create({
  baseURL: "/api", 
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

/* =========================================
    SECURE REQUEST INTERCEPTOR
========================================= */
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const sellerId = localStorage.getItem("sellerId") || sessionStorage.getItem("sellerId");
      const designerId = localStorage.getItem("designerId") || sessionStorage.getItem("designerId");
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");

      // Attach secure identifiers to headers
      if (sellerId) config.headers["x-seller-id"] = sellerId;
      if (designerId) config.headers["x-designer-id"] = designerId;
      
      // Pin the Identity via Bearer Token
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================================
    SECURE RESPONSE INTERCEPTOR
========================================= */
api.interceptors.response.use(
  (response) => {
    // Logic for global decryption will go here once backend is ready
    return response;
  },
  (error) => {
    // Handle session expiry (401)
    if (error.response?.status === 401) {
      console.warn("Security Challenge: Unauthorized or Expired Session.");
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
      }
    }

    console.error("API Error Interface:", error.response?.data?.message || error.message);
    return Promise.reject(error);
  }
);

export default api;