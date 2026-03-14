import { 
  getAuth, 
  getIdToken,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  sendPasswordResetEmail, 
  signInWithPhoneNumber,
  FirebaseAuthTypes
} from '@react-native-firebase/auth';

// ✅ Auth instance
const auth = getAuth();

/* ==========================================================================
   AUTH HELPERS (DELIVERY OPTIMIZED)
   ========================================================================== */

/**
 * Fresh Token nikalne ke liye (Backend calls se pehle use karein)
 */
export const getFreshToken = async () => {
  const user = auth.currentUser;
  if (user) {
    // forceRefresh: true taaki expired token ki dikkat na ho
    return await getIdToken(user, true);
  }
  return null;
};

/**
 * Email Sign In (Delivery Boy login backup)
 */
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await getIdToken(userCredential.user);
    return { user: userCredential.user, token };
  } catch (error: any) {
    console.error("Firebase Login Error:", error.code);
    throw error;
  }
};

/**
 * Phone OTP Verification (Main for Delivery Boys)
 */
export const sendOtpToPhone = async (phoneNumber: string) => {
  try {
    // 🚩 Ensure: +91 format hona chahiye
    const confirmation = await signInWithPhoneNumber(auth, phoneNumber);
    return confirmation;
  } catch (error: any) {
    console.error("Firebase SMS Error:", error.code);
    throw error;
  }
};

/**
 * Logout Logic
 */
export const logoutUser = async () => {
  try {
    await signOut(auth);
    console.log("Partner logged out successfully");
  } catch (error) {
    console.error("Firebase Logout Error:", error);
    throw error;
  }
};

/**
 * Password Reset (If using email)
 */
export const sendPasswordReset = (email: string) => {
  return sendPasswordResetEmail(auth, email);
};

export default auth;