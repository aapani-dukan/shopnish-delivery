import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api'; 

export const registerForPushNotificationsAsync = async (userId: number) => {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for delivery app!');
      return;
    }

    // 🚨 DELIVERY APP KI PROJECT ID
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: '25b3f0e8-df22-4990-9d33-e645762c1cb9', 
    })).data;
    
    console.log("🔥 Delivery FCM Token:", token);

    // ✅ Token ko backend mein save karein
    try {
      await api.patch(`/api/delivery/update-fcm-token`, { 
        userId, 
        fcmToken: token 
      });
    } catch (err) {
      console.error("Delivery Token Save Error:", err);
    }
  }

  if (Platform.OS === 'android') {
    // 🚨 1. DELIVERY SIREN CHANNEL (Backend aur FCM V1 se 100% matched)
    Notifications.setNotificationChannelAsync('delivery_siren_v10', { // 👈 v1 ko v10 kar diya
      name: 'New Delivery Tasks', 
      importance: Notifications.AndroidImportance.MAX, 
      
      // ✅ SELLER APP KE JESE: .mp3 hata diya hai, sirf 'siren' rahega
      sound: 'siren', 
      
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // 2. Default Channel
    Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return token;
};