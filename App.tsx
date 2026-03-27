import 'react-native-gesture-handler';
//import './src/services/firebaseConfig';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // <-- Naya Import
import app from '@react-native-firebase/app';
import { useEffect } from 'react';
// Provider aur Navigator Imports
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { getApps, initializeApp } from '@react-native-firebase/app';
// 1. QueryClient Banayein
const queryClient = new QueryClient();

if (getApps().length === 0) {
  initializeApp({} as any); 
}
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 2. React Query Provider Wrap Karein */}
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AuthProvider>
            <NavigationContainer>
              <AppNavigator />
              <StatusBar style="light" />
            </NavigationContainer>
          </AuthProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}