import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Feather from 'react-native-vector-icons/Feather';

import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
// Context
import { useAuth } from '../context/AuthContext';

// Screens (Yeh screens hum agle step mein banayenge)
import LoginScreen from '../screens/Auth/LoginScreen';
import AvailableBatchesScreen from '../screens/Dashboard/AvailableBatchesScreen';
import MyTasksScreen from '../screens/Dashboard/MyTasksScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import BatchDetailsScreen from '../screens/Dashboard/BatchDetailsScreen';
import DeliveryTrackingScreen from '../screens/Dashboard/DeliveryTrackingScreen';
import RegistrationScreen from '../screens/RegistrationScreen';
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// --- DELIVERY TAB NAVIGATION ---
const DeliveryTabs = () => {
  const { user, refreshUserStatus } = useAuth();

  // ✅ CONFIRMED: Logs ke mutabiq ye do fields check karni hain
  const status = user?.approvalStatus || user?.user?.deliveryApprovalStatus;

  // 🚩 Agar status pending hai, toh Dashboard nahi, Message dikhao
  if (status === 'pending') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#001B3A', padding: 20 }}>
        <Text style={{ fontSize: 70, marginBottom: 20 }}>⏳</Text>
        <Text style={{ color: '#D4AF37', fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
          Verification Pending
        </Text>
        <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 15, fontSize: 16, lineHeight: 22 }}>
          aapka registration mil gaya hai. Admin approval ke baad dashboard chalu ho jayega.
        </Text>
        
        <TouchableOpacity 
          onPress={refreshUserStatus}
          style={{ backgroundColor: '#D4AF37', marginTop: 30, paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10 }}
        >
          <Text style={{ color: '#001B3A', fontWeight: 'bold' }}>Status Check Karein</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          {/* ✅ Naya logic: Agar user ka status 'pending' hai 
              ya wo 'isNewUser' hai (Registration nahi ki), 
              toh dono cases mein use RegistrationScreen par hi rakho */}
          {(user?.isNewUser || user?.currentDeliveryStatus === 'pending') ? (
            <Stack.Screen name="Registration" component={RegistrationScreen} />
          ) : (
            <>
              {/* ✅ Jab status 'approved' ho jaye (isNewUser false ho jayega), 
                  tabhi ye Main tabs khulenge */}
              <Stack.Screen name="Main" component={DeliveryTabs} />
              
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
        </>
      )}
    </Stack.Navigator>
  );
}