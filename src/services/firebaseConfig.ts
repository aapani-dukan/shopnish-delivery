import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Aapka purana project credentials (Aapani Dukan)
const firebaseConfig = {
  apiKey: "AIzaSyC5HscYVxTuYIpLTDeLy6ZY5Z2OhOCogso",
  authDomain: "aapani-dukan.firebaseapp.com",
  projectId: "aapani-dukan",
  storageBucket: "aapani-dukan.firebasestorage.app",
  messagingSenderId: "352463214204",
  appId: "1:352463214204:web:03e436f694a6a16d1fdbf9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth instance ko export karein
export const auth = getAuth(app);
export default app;