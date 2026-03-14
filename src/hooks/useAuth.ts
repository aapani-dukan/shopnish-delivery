import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * useAuth Custom Hook for Shopnish Delivery
 * Iska use karke aap Delivery Boy ka status aur login logic
 * kisi bhi screen par bina kisi jhanjhat ke use kar sakte hain.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  // Error check: Taaki humein turant pata chal jaye agar AuthProvider miss ho gaya ho
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider. Make sure your App.tsx is wrapped correctly.');
  }

  // Ab yahan se context return hoga jisme user, isAuthenticated, sendOtp etc. milenge
  return context;
};