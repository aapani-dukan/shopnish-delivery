import React from 'react';
import { 
  View, Text, ScrollView, StyleSheet, TextInput, 
  TouchableOpacity, ActivityIndicator, Alert 
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Feather from 'react-native-vector-icons/Feather';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import * as Location from 'expo-location';
import { Button } from 'react-native-paper'; // ✅ Paper wala import karein
// 📋 Validation Schema (Delivery specific fields)
const registrationSchema = z.object({
  fullName: z.string().min(3, "Pura naam likhein"),
  email: z.string().email("Valid email(gmail) address dein"),
  address: z.string().min(10, "Pura pata likhein (Ghar/Area)"),
  city: z.string().min(2, "City ka naam zaroori hai"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode 6 digits ka hona chahiye"),
  vehicleType: z.string().min(2, "Vehicle type (Bike/Cycle) likhein"),
  vehicleNumber: z.string().min(4, "Vehicle number zaroori hai"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

export default function RegistrationScreen() {
  const { user, refreshUserStatus, logout, isLoadingAuth } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);
// ✅ 1. Loading Check
  if (isLoadingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#001B3A' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  // ✅ 2. Pending Status Logic (Jab form submit ho chuka ho)
  if (user?.currentDeliveryStatus === 'pending') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#001B3A' }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#D4AF37', marginBottom: 10 }}>
          Bhai, thoda intezar karo! ⏳
        </Text>
        <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 16, marginBottom: 25 }}>
          Aapka form Admin ke paas approval ke liye gaya hai. Jaise hi approve hoga, aapka dashboard chalu ho jayega.
        </Text>
        
        <TouchableOpacity 
          onPress={() => refreshUserStatus()}
          style={{ backgroundColor: '#D4AF37', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 }}
        >
          <Text style={{ color: '#001B3A', fontWeight: 'bold', fontSize: 16 }}>Status Check Karein</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={logout} style={{ marginTop: 20 }}>
          <Text style={{ color: '#ef4444', fontWeight: 'medium' }}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { 
      fullName: '', 
      email: user?.email || '',
      city: '', 
      address: '', 
      pincode: '', 
      vehicleType: '', 
      vehicleNumber: '' 
    }
  });

  // 📍 Location Detection Logic (Same as Seller App)
  const detectLocation = async () => {
    try {
      setIsLocating(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "App ko location permission chahiye.");
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      setValue('latitude', latitude);
      setValue('longitude', longitude);

      let reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (reverseGeocode.length > 0) {
        const place = reverseGeocode[0];
        const autoAddress = [place.name, place.street, place.district].filter(Boolean).join(', ');
        
        setValue('address', autoAddress, { shouldValidate: true });
        setValue('city', place.city || place.subregion || '', { shouldValidate: true });
        setValue('pincode', place.postalCode || '', { shouldValidate: true });
        
        Alert.alert("Location Found", "Aapka address auto-fill kar diya gaya hai.");
      }
    } catch (error) {
      console.error("Location Error:", error);
      Alert.alert("Error", "Location track nahi ho paayi. Manually bharein.");
    } finally {
      setIsLocating(false);
    }
  };

  // 🚀 Submission Logic (Permanent Fix for Existing Users)
  const onSubmit = async (data: RegistrationFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        phone: user?.phoneNumber?.replace('+91', '') || "",
        firebaseUid: user?.uid,
        //email: user?.email || `${user?.phoneNumber?.replace('+', '')}@shopnish.com`,
      };

      console.log("📤 Sending Delivery Application:", payload);

      // ✅ Using '/apply' to handle existing users without duplicate key error
      const response = await api.post('/api/delivery/register', payload);

      if (response.status === 201 || response.status === 200) {
        Alert.alert("Success 🎉", "Application submitted! Admin approval ka intezar karein.", [
            { text: "Theek Hai", onPress: () => refreshUserStatus() }
        ]);
      }
    } catch (err: any) {
      console.error("❌ Submission Error:", err.response?.data);
      const msg = err.response?.data?.message || "Kuch galti hui hai. Kripya dobara koshish karein.";
      Alert.alert("Submission Failed", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.headerTitle}>Delivery Partner</Text>
        <Text style={styles.headerSub}>Bas kuch details aur kamai shuru karein!</Text>
      </View>

      <View style={styles.formCard}>
        <CustomInput control={control} name="fullName" label="Pura Naam" icon="user" error={errors.fullName} />
        
<CustomInput 
  control={control} 
  name="email" 
  label="Gmail ID (Web login ke liye)" 
  icon="mail" 
  keyboardType="email-address"
  autoCapitalize="none"
  error={errors.email} 
/>
        <TouchableOpacity onPress={detectLocation} style={styles.locationBtn}>
          {isLocating ? <ActivityIndicator color="#0369A1" /> : (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Feather name="map-pin" size={16} color="#0369A1" />
              <Text style={styles.locationBtnText}> Auto-detect Location</Text>
            </View>
          )}
        </TouchableOpacity>

        <CustomInput control={control} name="address" label="Residential Address" icon="home" error={errors.address} multiline />
        
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <CustomInput control={control} name="city" label="City" icon="map" error={errors.city} />
          </View>
          <View style={{ flex: 1 }}>
            <CustomInput control={control} name="pincode" label="Pincode" icon="hash" keyboardType="numeric" error={errors.pincode} />
          </View>
        </View>

        <CustomInput control={control} name="vehicleType" label="Vehicle Type (Bike/Cycle)" icon="truck" error={errors.vehicleType} />
        <CustomInput control={control} name="vehicleNumber" label="Vehicle Number" icon="activity" error={errors.vehicleNumber} />
        
        <TouchableOpacity 
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} 
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color="#D4AF37" /> : <Text style={styles.btnText}>Submit Application</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Cancel & Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Reusable Input Component
const CustomInput = ({ control, name, label, icon, error, ...props }: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputWrapper, error && { borderColor: '#ef4444' }]}>
      <Feather name={icon} size={18} color="#64748b" style={{ marginRight: 10 }} />
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <TextInput 
            style={styles.input} 
            value={value} 
            onChangeText={onChange} 
            placeholder={`Apna ${label} bharein`}
            placeholderTextColor="#cbd5e1" 
            {...props} 
          />
        )}
      />
    </View>
    {error && <Text style={styles.errorText}>{error.message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#001B3A' },
  content: { padding: 20, paddingTop: 40, paddingBottom: 60 },
  hero: { marginBottom: 25 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#D4AF37' },
  headerSub: { color: '#fff', fontSize: 14, opacity: 0.8 },
  formCard: { backgroundColor: '#fff', borderRadius: 25, padding: 20, elevation: 10 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 5, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15 },
  input: { flex: 1, height: 50, color: '#0f172a', fontSize: 15 },
  locationBtn: { backgroundColor: '#F0F9FF', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#BAE6FD' },
  locationBtnText: { color: '#0369A1', fontWeight: '700', fontSize: 14 },
  submitBtn: { backgroundColor: '#001B3A', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnText: { color: '#D4AF37', fontWeight: 'bold', fontSize: 18 },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 3, marginLeft: 5 },
  logoutBtn: { marginTop: 20, alignItems: 'center' },
  logoutText: { color: '#64748b', textDecorationLine: 'underline', fontSize: 13 }
});