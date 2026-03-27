import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth'; 
import api from '../services/api'; 

interface AuthContextType {
  user: any | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  sendOtp: (phoneNumber: string) => Promise<FirebaseAuthTypes.ConfirmationResult>;
  verifyOtp: (confirm: FirebaseAuthTypes.ConfirmationResult, otpCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserStatus: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // --- User Sync Logic ---
  const syncUserWithBackend = async (firebaseUser: FirebaseAuthTypes.User) => {
    try {
      setIsLoadingAuth(true);
      const token = await firebaseUser.getIdToken(true);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const res = await api.post('/api/delivery/login'); 
      
      const fullUserData = res.data?.user || res.data;
      setUser({
        uid: firebaseUser.uid,
        phoneNumber: firebaseUser.phoneNumber,
        ...fullUserData           
      });

    } catch (err: any) {
  // 🟠 Case: Token sahi hai par user database mein nahi mila (Backend 401 de raha hai)
  if (err.response?.status === 401 || err.response?.status === 404) {
    console.log("User not found or Auth failed, showing Registration...");
    
    // 💡 Yahan logout nahi karenge, balki user ko flag denge
    setUser({
      uid: firebaseUser.uid,
      phoneNumber: firebaseUser.phoneNumber,
      isNewUser: true // 👈 Isse Registration Screen khul jayegi
    });
  } 
  // 🔴 Case: Real Network/Server Error
  else {
    console.error("Asli Error:", err.message);
    Alert.alert("Network Error", "Server response nahi de raha.");
    setUser(null);
  }
} finally {
  setIsLoadingAuth(false);
}
  };

  // --- Auth State Listener ---
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        await syncUserWithBackend(firebaseUser);
      } else {
        setUser(null);
        setIsLoadingAuth(false);
      }
    });

    return () => unsubscribe(); 
  }, []);

  // 1. Send OTP
  const sendOtp = async (phoneNumber: string) => {
    try {
      const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
      return confirmation;
    } catch (error: any) {
      console.error("Firebase Send OTP Error:", error.code, error.message);
      throw error;
    }
  };

  // 2. Verify OTP
  const verifyOtp = async (confirm: FirebaseAuthTypes.ConfirmationResult, otpCode: string) => {
    try {
      const credential = await confirm.confirm(otpCode);
      if (credential?.user) {
        await syncUserWithBackend(credential.user);
      }
    } catch (error: any) {
      console.error("OTP Verification Error:", error.code, error.message);
      throw error;
    }
  };

  // 3. Logout
  const logout = async () => {
    try {
      await auth().signOut();
      setUser(null);
      delete api.defaults.headers.common['Authorization'];
      console.log("Logged out successfully!");
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  // 4. Refresh Status
  const refreshUserStatus = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      await syncUserWithBackend(currentUser);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      isLoadingAuth, 
      sendOtp,
      verifyOtp,
      logout,
      refreshUserStatus 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};