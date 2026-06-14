import axios from "axios"; // 🎯 फिक्स 1: 'mport' की स्पेलिंग को सुधार कर 'import' किया भाई
import { getAuth } from "@react-native-firebase/auth";

// 🎯 जादुई कवच: अगर ऐप डिबग/टेस्टिंग मोड में चल रहा है तो true रहेगा भाई!
const isDevelopment = __DEV__;

const baseURL = isDevelopment
  ? "http://66.116.235.235:5001"   // 👉 लैपटॉप या फोन पर टेस्ट करते समय अपने आप पोर्ट 5001 पकड़ेगा (Testing DB)
  : "https://api.shopnish.com";   // 👉 लाइव प्लेस्टोर वाले असली ग्राहकों के फोन में अपने आप मेन डोमेन पर रहेगा (Main Prod DB)

const api = axios.create({
  baseURL: baseURL, // 🔥 अब यह डिब्बा पूरी तरह डायनेमिक हो गया भाई साहब!
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
          // 🎯 फिक्स 2: टाइपस्क्रिप्ट एरर से बचने के लिए हेडर्स को सेफ़ली इंजेक्ट किया भाई
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          
          // 🎯 फिक्स 3: बैकएंड को तुरंत पहचानने के लिए डिलीवरी रोल हेडर में जोड़ दिया भाई
          config.headers["x-user-role"] = "delivery";
          
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
      // 💡 Delivery Boy account approved nahi hai ya Role galat hai भाई
      console.error("🚫 [API] Forbidden: Access Denied / Partner Not Approved");
    }
    
    if (status === 401) {
      // 💡 Session Expire ho gaya bhai
      console.log("🚫 [API] Session Expired / Unauthorized");
    }

    return Promise.reject(error);
  }
);

export default api;