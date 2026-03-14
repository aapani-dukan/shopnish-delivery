import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPhoneNumber, 
  getIdToken,
  signOut,
  FirebaseAuthTypes 
} from '@react-native-firebase/auth';
import { Alert } from 'react-native';
import api from '../services/api'; // ✅ Aapka naya api client

interface AuthContextType {
  user: any | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  sendOtp: (phoneNumber: string) => Promise<void>;
  verifyOtp: (otpCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserStatus: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await syncUserWithBackend(firebaseUser);
      } else {
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
      }
      setIsLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  const syncUserWithBackend = async (firebaseUser: FirebaseAuthTypes.User) => {
    try {
      const token = await getIdToken(firebaseUser);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // 🚩 Delivery Boy ke liye specific login route
      const res = await api.post('/delivery-boys/login', {
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email || ""
      }); 
      
      const fullUserData = res.data?.user || res.data;
      
      // 🛡️ Role Check: Kya ye user delivery boy hai?
      if (fullUserData && fullUserData.isDelivery) {
        setUser({
          uid: firebaseUser.uid,
          phoneNumber: firebaseUser.phoneNumber,
          ...fullUserData           
        });
      } else {
        // Agar user delivery boy nahi hai toh logout karwa do
        Alert.alert("Access Denied", "Aapka account delivery partner ke roop mein registered nahi hai.");
        await logout();
      }
    } catch (err: any) {
      console.error("Sync Error:", err.response?.data || err.message);
      // Agar backend approve na ho (403/404), toh user ko access mat do
      setUser(null);
    }
  };

  const sendOtp = async (phoneNumber: string) => {
    try {
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber);
      setConfirm(confirmation);
    } catch (error: any) {
      console.error("Firebase Send OTP Error:", error.code, error.message);
      throw error;
    }
  };

  const verifyOtp = async (otpCode: string) => {
    try {
      if (!confirm) throw new Error("OTP confirmation missing.");
      const credential = await confirm.confirm(otpCode);
      if (credential?.user) {
        await syncUserWithBackend(credential.user);
        setConfirm(null);
      }
    } catch (error: any) {
      console.error("OTP Verification Error:", error.code, error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setConfirm(null);
      delete api.defaults.headers.common['Authorization'];
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const refreshUserStatus = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) await syncUserWithBackend(currentUser);
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