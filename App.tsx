import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; 
import { getApps, initializeApp } from '@react-native-firebase/app';
import * as Notifications from 'expo-notifications'; 

// Provider aur Navigator Imports
import { AuthProvider, useAuth } from './src/context/AuthContext'; 
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator'; // 👈 navigationRef ko yahan import kiya
import { registerForPushNotificationsAsync } from './src/services/notificationService'; 

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, 
    shouldSetBadge: true,
  }),
});

const queryClient = new QueryClient();

if (getApps().length === 0) {
  initializeApp({} as any); 
}

function AppContent() {
  const { user } = useAuth(); 
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (user?.id) {
      registerForPushNotificationsAsync(user.id);
    }

    // App Khuli Ho Tab (Foreground Listener)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Foreground Notification Received:', notification);
    });

    // 🎯 NOTIFICATION CLICK REDIRECTION LOGIC 🚨
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🎯 Notification Clicked by Delivery Boy:', response);
      
      // Backend se bheja gaya batchId nikalenge
      const batchId = response.notification.request.content.data?.batchId;
      
      if (batchId) {
        console.log(`🚀 Redirecting delivery boy to Available Screen for Batch: ${batchId}`);
        
        // Check karenge ki navigation container ready hai ya nahi
        if (navigationRef.isReady()) {
          // 🎯 Aapki screen ka asli naam 'Available' hai, hum wahan direct jump kar rahe hain
          // Aur sath me batchId bhi bhej rahe hain taaki screen use highlight kar sake
         ( navigationRef.navigate as any)('Available' as never, { batchId } as never);
        }
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user?.id]); 

  return (
    // 🚨 NavigationContainer ko humne ref de diya hai
    <NavigationContainer ref={navigationRef}>
      <AppNavigator />
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}