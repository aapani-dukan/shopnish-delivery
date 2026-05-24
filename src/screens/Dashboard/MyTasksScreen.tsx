import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert,Modal, TextInput,Dimensions } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import { useSocket } from '../../hooks/useSocket';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import axios from 'axios'; // या जो भी आपका API क्लाइंट हो
 const { width } = Dimensions.get('window');
export default function MyTasksScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { isConnected, socket } = useSocket();
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [selectedBatchForOtp, setSelectedBatchForOtp] = useState<number | null>(null);
  // App चालू होते ही एक्टिव जर्नी को रिकवर करें
  useEffect(() => {
    const checkActiveJourney = async () => {
      const savedBatchId = await AsyncStorage.getItem('activeBatchId');
      if (savedBatchId) {
        const bId = parseInt(savedBatchId);
        setActiveBatchId(bId);
        startLiveTracking(bId);
      }
    };
    checkActiveJourney();
return () => {
  if (watchIdRef.current !== null) {
    Geolocation.clearWatch(watchIdRef.current); // 👈 यहाँ भी बदलें
  }
};
   
  }, []);

  // 1. बैकएंड से असाइन किए गए एक्टिव बैचेस लेकर आना
  const { data: myTasks } = useQuery({
    queryKey: ['/delivery/my-tasks'],
    queryFn: async () => {
      const response = await api.get("/api/delivery/batches");
      return response.data.batches || response.data; 
    },
    refetchInterval: 15000, // हर 15 सेकंड में ऑटो रिफ्रेश
  });

  // 🎯 2. म्यूटेशन: स्टेटस अपडेट करने के लिए (Path & Log Fix)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ batchId, status, otp }: { batchId: number, status: string, otp?: string }) => {
      console.log(`📡 Requesting Status Change: Batch #${batchId} -> ${status}`);
      
      // 🚨 FIX: अगर आपके Axios instance में /api पहले से जुड़ा है, 
      // तो यहाँ सिर्फ '/delivery-boys/batches/...' लिखें।
      // अभी के लिए हम पूरा पाथ साफ़ लिख रहे हैं, अपने Axios config के हिसाब से इसे चेक करें:
      const response = await api.patch(`/api/delivery/batches/${batchId}/status`, { status, otp });
      return response.data;
    },
    onSuccess: (data) => {
      console.log("✅ Server Status Updated:", data);
      // डेटाबेस रीफ्रेच करें ताकि बटन 'Confirm Pickup' बन जाए
      queryClient.invalidateQueries({ queryKey: ['/delivery/my-tasks'] });
    },
    onError: (error: any) => {
      console.error("❌ Status Update Failed Network Error:", error);
      
      // 🛑 यह अलर्ट हमें बताएगा कि API क्यों नहीं मिली (404) या ब्लॉक हुई (401)
      const statusCode = error?.response?.status;
      const errMsg = error?.response?.data?.error || "Server responded with an error.";
      
      Alert.alert(
        `API Error (Status: ${statusCode || 'Unknown'})`,
        `Path Checked: /api/delivery/batches/status\nReason: ${errMsg}`
      );
    }
  });
  // 📡 2. ZOMATO STYLE LIVE TRACKING SENDER (Updated with Library Fix)
  const startLiveTracking = (batchId: number) => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current); // 👈 यहाँ बदला
    }

    // 🚨 FIX: navigator.geolocation की जगह अब 'Geolocation' यूज़ होगा
    watchIdRef.current = Geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, heading } = position.coords;

        // A. कस्टमर के लिए सॉकेट पर लाइव ब्रॉडकास्ट
        if (socket && socket.connected) {
          console.log(`🚀 Sending Bike Live Location: Lat ${latitude}, Lng ${longitude}`);
          socket.emit('delivery:location-update', {
            batchId,
            latitude,
            longitude,
            heading: heading || 0
          });
        }

        // B. आपके बैकएंड की /update-location API पर जीपीएस डेटाबेस सिंक
        try {
          await api.put('/api/delivery/update-location', { latitude, longitude });
        } catch (err) {
          console.log("GPS DB Sync Error:", err);
        }
      },
      (error) => console.error("🚨 Live GPS Error:", error),
      {
        enableHighAccuracy: true, 
        distanceFilter: 1,        
        maximumAge: 0
      } as any 
    );
  };
// 🚀 4. ACTION: जर्नी शुरू करना (Map Open + Background Sync Fix)
  const handleStartJourney = async (batch: any, targetType: 'shop' | 'customer') => {
    try {
      const nextStatus = targetType === 'shop' ? 'ready_for_pickup' : 'out_for_delivery';

      // 1. UI Status aur Local Storage ko turant set karo taaki button change ho jaye
      setActiveBatchId(batch.id);
      await AsyncStorage.setItem('activeBatchId', batch.id.toString());
      
      // 2. Live Tracking loop start karo
      startLiveTracking(batch.id);

      // 3. Dynamic Map URL banao (Coordinates check ke sath)
      const targetLat = targetType === 'shop' ? batch.pickupPoints?.[0]?.latitude : batch.deliveryLat;
      const targetLng = targetType === 'shop' ? batch.pickupPoints?.[0]?.longitude : batch.deliveryLng;

      let url = "";
      if (targetLat && targetLng) {
        // Standard geo URL format jo har phone ke maps application ko support karta hai
        url = `geo:${targetLat},${targetLng}?q=${targetLat},${targetLng}(Target)`;
      } else {
        const cleanAddress = encodeURIComponent(targetType === 'shop' ? batch.pickupAddresses : (batch.deliveryAddress || "Bundi"));
        url = `https://www.google.com/maps/dir/?api=1&destination=${cleanAddress}`;
      }

      // 4. Map ko sabse pehle open karo (Bina wait kiye taaki delivery boy ruke nahi)
      console.log("🗺️ Attempting to open map URL:", url);
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback url agar geo: direct support na kare
        const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetLat || 25.44},${targetLng || 75.66}`;
        await Linking.openURL(fallbackUrl);
      }

      // 5. Background mein backend status update call chala do (Fire and forget safely)
      updateStatusMutation.mutate({ batchId: batch.id, status: nextStatus });

    } catch (err) {
      console.error("🚨 Journey Start Failed completely:", err);
      Alert.alert("Error", "Safar shuru karne mein koi dikkat aayi hai.");
    }
  };
  
  // 🛍️ 5. एक्शन: दुकान से पिकअप कन्फर्म करना
  const handleConfirmPickup = async (batchId: number) => {
    Alert.alert("Confirm Pickup", "क्या आपने वेंडर से सारे आइटम्स ले लिए हैं?", [
      { text: "नहीं", style: "cancel" },
      {
        text: "हाँ, ले लिए",
        onPress: async () => {
          // वेंडर का काम खत्म, लोकल ट्रैकिंग थोड़ी देर रोको जब तक नया सफर शुरू न हो
         if (watchIdRef.current !== null) {
  Geolocation.clearWatch(watchIdRef.current); // 👈 यहाँ भी बदलें
  watchIdRef.current = null;
}
          await AsyncStorage.removeItem('activeBatchId');
          setActiveBatchId(null);

          // बैकएंड को बताओ माल उठ चुका है -> 'picked_up'
          updateStatusMutation.mutate({ batchId, status: 'picked_up' });
        }
      }
    ]);
  };

  // 🏁 6. एक्शन: कस्टमर को डिलीवरी देना (OTP वेरिफिकेशन के साथ)
// 1. नई म्यूटेशन जोड़ें जो OTP भेजेगी
const sendOtpMutation = useMutation({
  mutationFn: async (batchId: number) => {
    return await api.post(`/api/delivery/batches/${batchId}/send-otp`);
  },
  onSuccess: (data) => {
    console.log("✅ OTP API Triggered successfully");
    // अब इसके बाद OTP मोडल दिखाएं
    setOtpModalVisible(true);
  },
  onError: (error: any) => {
    Alert.alert("Error", "OTP भेजने में दिक्कत आई: " + error.message);
  }
});

// 2. अपना 'Confirm Delivery' बटन फंक्शन अपडेट करें
const handleConfirmDelivery = (batchId: number) => {
  setSelectedBatchForOtp(batchId);
  // मोडल खोलने से पहले API हिट करें ताकि डेटाबेस में OTP जनरेट हो जाए
  sendOtpMutation.mutate(batchId);
};

  // ओटीपी सबमिट करने का फाइनल लॉजिक
  const submitDeliveryOtp = () => {
    if (!deliveryOtp || deliveryOtp.length < 4) {
      Alert.alert("त्रुटि", "कृपया सही OTP दर्ज करें!");
      return;
    }

    if (!selectedBatchForOtp) return;

    // मोडल बंद करो
    setOtpModalVisible(false);

    // बैकएंड को डिलीवर स्टेटस और ओटीपी भेजो
    updateStatusMutation.mutate(
      { batchId: selectedBatchForOtp, status: 'delivered', otp: deliveryOtp },
      {
        onSuccess: async () => {
          if (watchIdRef.current !== null) {
            Geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          await AsyncStorage.removeItem('activeBatchId');
          setActiveBatchId(null);
          Alert.alert("सफलता", "ऑर्डर सफलतापूर्वक डिलीवर हो गया है! 🎉");
        }
      }
    );
  };


const TaskCardItem = ({ item, activeBatchId, handleStartJourney, handleConfirmPickup, handleStartJourneyCustomer, handleConfirmDelivery, navigation }: any) => {
  const [totalToCollect, setTotalToCollect] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState<boolean>(true);

  const currentStatus = item.status?.toLowerCase();
  const isJourneyActive = activeBatchId === item.id;

  // 🎯 जादू यहाँ है: स्क्रीन पर कार्ड आते ही यह आपकी नई सटीक एपीआई को कॉल करेगा
 // 🎯 आपके कस्टमाइज्ड api इंस्टेंस के साथ सुधरा हुआ इफेक्ट
  useEffect(() => {
    const fetchBatchPrice = async () => {
      try {
        setLoadingPrice(true);
        
        // 💡 मुख्य बदलाव: 'axios.get' की जगह आपके इम्पोर्टेड 'api.get' का उपयोग किया है
        // आपके एक्सप्रेस राउटर के बेस पाथ के अनुसार रूट सेट करें
        const response = await api.get(`/api/delivery/batch-price/${item.id}`); 
        
        // 💡 सुरक्षा जांच: अगर आपके रूट का बेस पाथ सिर्फ '/api' है, 
        // तो ऊपर वाली लाइन को बदलकर यह कर दें: const response = await api.get(`/batch-price/${item.id}`);

        if (response.data && response.data.totalToCollect !== undefined) {
          setTotalToCollect(Number(response.data.totalToCollect));
        } else {
          setTotalToCollect(0);
        }
      } catch (error: any) {
        // एरर की पूरी डिटेल देखने के लिए
        console.log(`❌ Price API Fail for batch ${item.id}:`, error.message);
        setTotalToCollect(0); 
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchBatchPrice();
  }, [item.id]);

  return (
    <View style={styles.card}>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
      </View>
      
      <Text style={styles.batchTitle}>Batch #{item.id}</Text>
      
      <View style={styles.infoRow}>
        <Feather name="shopping-bag" size={16} color="#475569" />
        <Text style={styles.shopText} numberOfLines={1}>{item.pickupShops || "Unknown Shop"}</Text>
      </View>

      <View style={styles.infoRow}>
        <Feather name="map-pin" size={14} color="#64748b" />
        <Text style={styles.addressText} numberOfLines={2}>{item.pickupAddresses || "Address Not Available"}</Text>
      </View>

      <Text style={styles.orderCount}>📦 {item.totalItems || 0} Orders to deliver</Text>

      {/* 💵 कस्टमर कैश कलेक्शन बॉक्स (रीयल-टाइम एपीआई समर्थित) */}
      <View style={[
        styles.paymentStatusBadge, 
        { backgroundColor: '#fef2f2', borderColor: '#fee2e2', padding: 12, borderRadius: 8, marginVertical: 10 }
      ]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#ef4444' }}>
            💵 CASH ON DELIVERY (COD)
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ color: '#475569', fontSize: 14 }}>कस्टमर से नकद (Cash) लें:</Text>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#ef4444' }}>
            {loadingPrice ? "कैलकुलेट हो रहा है..." : `₹${Number(totalToCollect).toFixed(2)}`}
          </Text>
        </View>
      </View>
     <TouchableOpacity 
        style={{
          backgroundColor: '#001B3A',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: '#D4AF37'
        }}
        onPress={() => navigation.navigate('BatchDetails', { batchId: item.id, batchData: item })}
      >
        <Feather name="eye" size={16} color="#D4AF37" style={{ marginRight: 6 }} />
        <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 14 }}>View Orders (कस्टमर जानकारी)</Text>
      </TouchableOpacity>
      <View style={styles.divider} />
      
      {/* 🔘 ऐक्शन्स बटन्स */}
      <View style={styles.actionRow}>
        {currentStatus === 'assigned' && (
          <TouchableOpacity style={styles.mapBtn} onPress={() => handleStartJourney(item, 'shop')}>
            <Feather name="navigation" size={18} color="#001B3A" />
            <Text style={styles.btnText}>Start Journey (To Shop)</Text>
          </TouchableOpacity>
        )}
        {currentStatus === 'ready_for_pickup' && (
          <TouchableOpacity style={[styles.mapBtn, { backgroundColor: '#10b981' }]} onPress={() => handleConfirmPickup(item.id)}>
            <Feather name="check-square" size={18} color="#fff" />
            <Text style={[styles.btnText, { color: '#fff' }]}>Confirm Pickup</Text>
          </TouchableOpacity>
        )}
        {currentStatus === 'picked_up' && (
          <TouchableOpacity style={[styles.mapBtn, { backgroundColor: '#7c3aed' }]} onPress={() => handleStartJourneyCustomer(item, 'customer')}>
            <Feather name="truck" size={18} color="#fff" />
            <Text style={[styles.btnText, { color: '#fff' }]}>Start Journey (To Customer)</Text>
          </TouchableOpacity>
        )}
        {currentStatus === 'out_for_delivery' && (
          <TouchableOpacity style={[styles.mapBtn, { backgroundColor: '#0284c7' }]} onPress={() => handleConfirmDelivery(item.id)}>
            <Feather name="home" size={18} color="#fff" />
            <Text style={[styles.btnText, { color: '#fff' }]}>Confirm Delivery (Enter OTP)</Text>
          </TouchableOpacity>
        )}
      </View>
      {isJourneyActive && (
        <View style={styles.liveIndicator}>
          <View style={styles.redDot} />
          <Text style={styles.liveText}>Live Tracking Active</Text>
        </View>
      )}
    </View>
  );
};
   const renderTask = ({ item }: any) => {
  return (
    <TaskCardItem 
      item={item}
      activeBatchId={activeBatchId}
      handleStartJourney={handleStartJourney}
      handleConfirmPickup={handleConfirmPickup}
      handleConfirmDelivery={handleConfirmDelivery}
      navigation={navigation}
    />
  );
};
        
         return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Active Tasks</Text>
        <Text style={styles.socketStatus}>
          {isConnected ? "🟢 Server Connected" : "🔴 Reconnecting..."}
        </Text>
      </View>

      <FlatList
        data={myTasks as any[]}
        renderItem={renderTask}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 15 }}
        ListEmptyComponent={<Text style={styles.empty}>Abhi aapne koi batch claim nahi kiya hai.</Text>}
      />
     {/* 🎯 CUSTOM OTP MODAL WITH SIMPLE BYPASS SYSTEM (100% FIXED) */}
    <Modal
      animationType="slide"
      transparent={true}
      visible={otpModalVisible}
      onRequestClose={() => setOtpModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Delivery Verification</Text>
          <Text style={styles.modalSubTitle}>कस्टमर से पूछकर यहाँ OTP दर्ज करें:</Text>
          
          <TextInput
            style={styles.otpInput}
            placeholder="Enter OTP"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            maxLength={6}
            value={deliveryOtp}
            onChangeText={setDeliveryOtp}
          />

          <View style={styles.modalActionRow}>
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: '#e2e8f0' }]} 
              onPress={() => setOtpModalVisible(false)}
            >
              <Text style={[styles.modalBtnText, { color: '#475569' }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: '#0284c7' }]} 
              onPress={submitDeliveryOtp}
            >
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>Verify & Deliver</Text>
            </TouchableOpacity>
          </View>

          {/* 🎯 FIRE BYPASS BUTTON: बिना फोटो के सीधे सिंपल डिलीवरी */}
          <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 }} />
          
          <TouchableOpacity 
            style={styles.bypassBtn} 
            onPress={() => {
              Alert.alert(
                "Bypass OTP?", 
                "क्या आप कस्टमर के लोकेशन पर मौजूद हैं? बिना OTP सीधे डिलीवरी मार्क करने के लिए कन्फर्म करें।",
                [
                  { text: "Cancel", style: "cancel" },
                  { 
                    text: "Yes, Deliver Directly", 
                    onPress: () => {
                      setOtpModalVisible(false);
                      
                      // बैकएंड को सीधा बाईपास कोड हिट करा देंगे
                      updateStatusMutation.mutate(
                        { 
                          batchId: selectedBatchForOtp!, 
                          status: 'delivered', 
                          otp: 'BYPASS_BY_RIDER' 
                        },
                        {
                          onSuccess: async () => {
                            if (watchIdRef.current !== null) {
                              Geolocation.clearWatch(watchIdRef.current);
                              watchIdRef.current = null;
                            }
                            await AsyncStorage.removeItem('activeBatchId');
                            setActiveBatchId(null);
                            Alert.alert("सफलता", "ऑर्डर बिना OTP के सीधे डिलीवर मार्क कर दिया गया है।");
                          }
                        }
                      );
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.bypassBtnText}>
              Customer Doesn't Have OTP / Bypass
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 25, backgroundColor: '#001B3A', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#D4AF37' },
  socketStatus: { fontSize: 12, color: '#94a3b8', marginTop: 5 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 15, elevation: 5 },
  statusBadge: { alignSelf: 'flex-start', backgroundColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 10 },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
  batchTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingRight: 5 },
  shopText: { fontSize: 15, fontWeight: '600', color: '#334155', marginLeft: 8 },
  addressText: { fontSize: 13, color: '#64748b', marginLeft: 10, flex: 1 },
  orderCount: { color: '#0284c7', marginTop: 12, fontWeight: '600', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D4AF37', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, flex: 1, marginRight: 10, justifyContent: 'center' },
  btnText: { marginLeft: 6, fontWeight: 'bold', color: '#001B3A', fontSize: 12 },
  detailBtn: { justifyContent: 'center', paddingHorizontal: 10 },
  detailText: { color: '#001B3A', fontWeight: '600' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: '#fff1f2', padding: 8, borderRadius: 8 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 8 },
  liveText: { fontSize: 12, color: '#ef4444', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 100, color: '#94a3b8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 25, width: width * 0.85, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  modalSubTitle: { fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  otpInput: { 
    backgroundColor: '#f8fafc', 
    borderWidth: 1,           // 👈 borderSize को borderWidth कर दिया
    borderColor: '#cbd5e1', 
    borderRadius: 12, 
    padding: 15, 
    fontSize: 18, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    color: '#1e293b', 
    marginBottom: 20, 
    letterSpacing: 4 
  },
  modalActionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  modalBtnText: { fontWeight: 'bold', fontSize: 14 },
  bypassBtn: {
    backgroundColor: '#fff1f2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffe4e6',
    marginTop: 5
  },
  bypassBtnText: {
    color: '#e11d48',
    fontWeight: 'bold',
    fontSize: 12
  },
  codValueText: {
  fontSize: 20, // थोड़ा बड़ा और बोल्ड
  fontWeight: '900',
  color: '#b91c1c',
},
// 🚨 StyleSheet.create के अंदर ये स्टाइल्स जोड़ें:

  paymentStatusBadge: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 10,
  },
  paymentModeText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  codAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#fee2e2',
  },
  codLabelText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#991b1b',
  },
  onlinePaidSubText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
    marginTop: 4,
  },
});