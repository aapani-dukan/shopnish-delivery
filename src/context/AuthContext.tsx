import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth'; 
import api from '../services/api'; 

interface AuthContextType {
  user: any | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  sendOtp: (phoneNumber: string) => Promise<FirebaseAuthTypes.ConfirmationResult>;
  verifyOtp: (confirm: FirebaseAuthTypes.ConfirmationResult, otpCode: string) => Promise<{ success: boolean; error?: any } | void>;
  logout: () => Promise<void>;
  refreshUserStatus: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const syncUserWithBackend = async (firebaseUser: FirebaseAuthTypes.User) => {
    try {
      // setIsLoadingAuth(true); // Isse loop ban sakta hai, dhyan se use karein
      const token = await firebaseUser.getIdToken(true);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const res = await api.post('/api/delivery/login'); 
      
      const fullUserData = res.data?.user || res.data;
      
      //  Object ko hamesha safely set karein
      setUser({
        uid: firebaseUser.uid || '',
        phoneNumber: firebaseUser.phoneNumber || '',
        ...fullUserData,
        isNewUser: false           
      });

    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 404) {
        setUser({
          uid: firebaseUser.uid,
          phoneNumber: firebaseUser.phoneNumber,
          isNewUser: true 
        });
      } else {
        console.error("Sync Error:", err.message);
        // Alert.alert hatao, console rakho taaki background sync app na roke
        setUser(null);
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        syncUserWithBackend(firebaseUser);
      } else {
        setUser(null);
        setIsLoadingAuth(false);
      }
    });
    return () => unsubscribe(); 
  }, []);

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
  if (!confirm) {
    console.error("Confirm object missing!");
    return { success: false, error: "Session expired. Try again." };
  }

  try {
    const credential = await confirm.confirm(otpCode);
    if (credential?.user) {
      await syncUserWithBackend(credential.user);
      return { success: true };
    }
  } catch (error: any) {
    // Yahan throw mat karo, return karo taaki UI handle kar sake
    console.log("OTP Verification Error:", error.code);
    return { success: false, error: error.code };
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