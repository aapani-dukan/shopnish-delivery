import axios from "axios";
import { getAuth } from "@react-native-firebase/auth";

const api = axios.create({
  baseURL: "https://shopnish-seprate.onrender.com", 
  timeout: 15000, 
  headers: {
    "Content-Type": "application/json",
  },
});

// 🚀 Request Interceptor: Auto-attach Firebase Token
api.interceptors.request.use(
  async (config) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        // getIdToken(true) use karein taaki hamesha fresh token jaye
        const token = await user.getIdToken(true); 
        
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          
          // Image upload ke liye condition
          if (config.data instanceof FormData) {
            config.headers["Content-Type"] = "multipart/form-data";
          }
        }
      }
    } catch (err) {
      console.error("❌ [API] Token fetching error:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 📥 Response Interceptor: Error Handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 403) {
      // 💡 Delivery Boy account approved nahi hai ya Role galat hai
      console.error("🚫 [API] Forbidden: Access Denied / Partner Not Approved");
    }
    
    if (status === 401) {
      // 💡 Session Expire ho gaya
      console.log("🚫 [API] Session Expired / Unauthorized");
    }

    return Promise.reject(error);
  }
);

export default api;