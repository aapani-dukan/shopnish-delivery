import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Feather from 'react-native-vector-icons/Feather';
import { View, ActivityIndicator } from 'react-native';

// Context
import { useAuth } from '../context/AuthContext';

// Screens (Yeh screens hum agle step mein banayenge)
import LoginScreen from '../screens/Auth/LoginScreen';
import AvailableBatchesScreen from '../screens/Dashboard/AvailableBatchesScreen';
import MyTasksScreen from '../screens/Dashboard/MyTasksScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import BatchDetailsScreen from '../screens/Dashboard/BatchDetailsScreen';
import DeliveryTrackingScreen from '../screens/Dashboard/DeliveryTrackingScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// --- DELIVERY TAB NAVIGATION ---
function DeliveryTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: string = 'list';
          if (route.name === 'Available') iconName = 'search';
          else if (route.name === 'My Tasks') iconName = 'truck';
          else if (route.name === 'Profile') iconName = 'user';
          
          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#D4AF37', // Gold for Delivery
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { height: 65, paddingBottom: 10, paddingTop: 5, backgroundColor: '#001B3A' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Available" component={AvailableBatchesScreen} />
      <Tab.Screen name="My Tasks" component={MyTasksScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// --- MAIN NAVIGATOR ---
export default function AppNavigator() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#001B3A' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          {/* Main Delivery Flow */}
          <Stack.Screen name="Main" component={DeliveryTabs} />
          
          {/* Detailed Screens */}
          <Stack.Screen 
            name="BatchDetails" 
            component={BatchDetailsScreen} 
            options={{ headerShown: true, title: 'Order Details' }} 
          />
          <Stack.Screen 
            name="Tracking" 
            component={DeliveryTrackingScreen} 
            options={{ headerShown: false }} 
          />
        </>
      )}
    </Stack.Navigator>
  );
}