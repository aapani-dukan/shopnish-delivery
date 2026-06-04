import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert,Modal, TextInput,Dimensions } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import { useSocket } from '../../hooks/useSocket';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios'; // या जो भी आपका API क्लाइंट हो
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

// टास्क का नाम बिल्कुल पुराना वाला ही रहेगा ताकि दोनों स्क्रीन कनेक्ट रहें भाई
const BACKGROUND_TRACKING_TASK = 'BACKGROUND_GPS_TRACKING_TASK';
 const { width } = Dimensions.get('window');
export default function MyTasksScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { isConnected, socket } = useSocket();
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [selectedBatchForOtp, setSelectedBatchForOtp] = useState<number | null>(null);
 // App चालू होते ही GPS परमिशन मांगें और एक्टिव मल्टी-जर्नी को रिकवर करें
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. पहले स्क्रीन पर दिखने वाली (Foreground) लोकेशन की परमिशन मांगें
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        
        if (foregroundStatus === 'granted') {
          // 2. अगर वो मिल गई, तब बैकग्राउंड (Allow all the time) की परमिशन मांगें
          const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          
          if (backgroundStatus !== 'granted') {
            Alert.alert(
              "बैकग्राउंड लोकेशन ज़रूरी है!",
              "Zomato की तरह बैकग्राउंड ट्रैकिंग चलाने के लिए कृपया अपने फोन की Settings > Apps > Shopnish Delivery > Permissions > Location में जाएं और उसे 'Allow all the time' (हमेशा अनुमति दें) पर सेट करें भाई।"
            );
          }
        } else {
          Alert.alert("अनुमति अस्वीकार", "ऐप को सही से चलाने के लिए लोकेशन परमिशन देना ज़रूरी है।");
        }

       // 🎯 सुधार १: अब यह पुराने 'outForDeliveryAt' के बजाय हमारी नई समझ 'updatedAt' से रिकवरी करेगा
        const activeBatchesJson = await AsyncStorage.getItem('active_out_for_delivery_batches');
        if (activeBatchesJson) {
          const activeBatches = JSON.parse(activeBatchesJson);
          const now = Date.now();
          const ONE_HOUR_MS = 60 * 60 * 1000;

          const validBatches = activeBatches.filter((batch: any) => {
            const baseTime = batch.updatedAt ? new Date(batch.updatedAt).getTime() : now;
            return (now - baseTime) < ONE_HOUR_MS;
          });

          if (validBatches.length > 0) {
            setActiveBatchId(validBatches[validBatches.length - 1].id);
            if (validBatches.length !== activeBatches.length) {
              await AsyncStorage.setItem('active_out_for_delivery_batches', JSON.stringify(validBatches));
            }
            console.log(`🔄 [RECOVERY]: Recovered ${validBatches.length} active tracking batches.`);
          } else {
            await AsyncStorage.removeItem('active_out_for_delivery_batches');
            await AsyncStorage.removeItem('active_tracking_batch_id');
            setActiveBatchId(null);
          }
        }
      } catch (err) {
        console.error("❌ App initialization failed:", err);
      }
    };
    initializeApp();
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

  // 🎯 फिक्स 1: मल्टी-वेंडर पिकअप और बैच लेवल स्टेटस को अलग-अलग हैंडल करने वाला सुधरा हुआ म्यूटेशन भाई
  const updateStatusMutation = useMutation({
    mutationFn: async ({ batchId, subOrderId, status, otp }: { batchId: number, subOrderId?: number, status: string, otp?: string }) => {
      // अगर पिकअप की बात है और हमारे पास subOrderId है, तो विशिष्ट सब-ऑर्डर एंडपॉइंट पर हिट मारो भाई
      if (status === 'picked_up' && subOrderId) {
        console.log(`📡 Requesting Sub-Order Pickup: Batch #${batchId} -> SubOrder #${subOrderId}`);
        const response = await api.patch(`/api/delivery/sub-orders/${subOrderId}/pickup`, { status });
        return response.data;
      }
      
      // बाकी सारे बैच-लेवल स्टेटस (जैसे out_for_delivery, delivered) पुराने रूट पर ही चलेंगे भाई
      console.log(`📡 Requesting Batch Status Change: Batch #${batchId} -> ${status}`);
      const response = await api.patch(`/api/delivery/batches/${batchId}/status`, { status, otp });
      return response.data;
    },
    onSuccess: (data) => {
      console.log("✅ Server Status Updated Successfully:", data);
      queryClient.invalidateQueries({ queryKey: ['/delivery/my-tasks'] });
    },
    onError: (error: any) => {
      console.error("❌ Status Update Failed:", error);
      const statusCode = error?.response?.status;
      const errMsg = error?.response?.data?.error || "Server responded with an error.";
      
      Alert.alert(
        `API Error (Status: ${statusCode || 'Unknown'})`,
        `Reason: ${errMsg}`
      );
    }
  });

 // 📡 START LIVE TRACKING (मल्टी-बैच और 'updatedAt' सपोर्ट के साथ)
  const startLiveTracking = async (batchId: number) => {
    try {
      const activeBatchesJson = await AsyncStorage.getItem('active_out_for_delivery_batches');
      let activeBatches = activeBatchesJson ? JSON.parse(activeBatchesJson) : [];

      const batchIndex = activeBatches.findIndex((b: any) => b.id === batchId);
      const batchData = {
        id: batchId,
        status: 'picked_up',
        updatedAt: new Date().toISOString() // 🎯 सुधार २: TaskManager के लिए फ्रेश आईएसओ टाइमस्टैम्प
      };

      if (batchIndex > -1) {
        activeBatches[batchIndex] = batchData;
      } else {
        activeBatches.push(batchData);
      }

      await AsyncStorage.setItem('active_out_for_delivery_batches', JSON.stringify(activeBatches));
      await AsyncStorage.setItem('active_tracking_batch_id', String(batchId));

      await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 10,
        deferredUpdatesInterval: 5000,
        foregroundService: {
          notificationTitle: "Shipnish Delivery Active",
          notificationBody: `En route to customer (Tracking ${activeBatches.length} active deliveries)...`,
          notificationColor: "#001B3A"
        }
      });
      console.log(`🚀 [BG GPS]: Tracking activated for Batch #${batchId}.`);
    } catch (err) {
      console.error("❌ Background tracking start failed:", err);
    }
  };
  // 🛑 2. STOP LIVE TRACKING (सिर्फ़ डिलीवर हुए बैच को लिस्ट से हटाएगा भाई)
  const stopLiveTracking = async (batchId: number, reason: string) => {
    try {
      // एक्टिव बैचेस की लिस्ट निकालो
      const activeBatchesJson = await AsyncStorage.getItem('active_out_for_delivery_batches');
      
      if (activeBatchesJson) {
        let activeBatches = JSON.parse(activeBatchesJson);

        // 🎯 जादू यहाँ है: सिर्फ़ उस बैच को लिस्ट से हटाओ जो डिलीवर हुआ है, बाकी चलते रहेंगे!
        const remainingBatches = activeBatches.filter((b: any) => b.id !== batchId);

        if (remainingBatches.length > 0) {
          // अगर अभी भी कुछ बैचेस का रास्ता बचा है, तो बची हुई लिस्ट को सेव करो
          await AsyncStorage.setItem('active_out_for_delivery_batches', JSON.stringify(remainingBatches));
          console.log(`ℹ️ [BG GPS]: Batch #${batchId} removed. ${remainingBatches.length} batches still tracking. Reason: ${reason}`);
        } else {
          // 🛑 अगर सारे बैचेस डिलीवर हो चुके हैं, तो फोन के जीपीएस इंजन को पूरी तरह बंद कर दो भाई!
          const isTaskRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TRACKING_TASK);
          if (isTaskRunning) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
          }
          await AsyncStorage.removeItem('active_out_for_delivery_batches');
          await AsyncStorage.removeItem('active_tracking_batch_id');
          console.log(`🛑 [BG GPS]: All batches clear. Stopped background engine. Reason: ${reason}`);
        }
      }
    } catch (err) {
      console.error("❌ Background tracking stop failed:", err);
    }
  };
 // 🛍️ ४. एक्शन: दुकान से पिकअप कन्फर्म करना (सर्वर -> picked_up)
  const handleConfirmPickup = async (batchId: number) => {
    Alert.alert("Confirm Pickup", "क्या आपने वेंडर से सारे आइटम्स ले लिए हैं?", [
      { text: "नहीं", style: "cancel" },
      {
        text: "हाँ, ले लिए",
        onPress: async () => {
          console.log(`📦 Pickup Confirmed for Batch #${batchId}. Setting status to picked_up...`);
          
          updateStatusMutation.mutate(
            { batchId, status: 'picked_up' },
            {
              onSuccess: async () => {
                // 🎯 सुधार ३: सर्वर सक्सेस होने पर ट्रैकिंग इंजन और लोकल स्टोरेज दोनों सिंक होंगे भाई
                await startLiveTracking(batchId);
                setActiveBatchId(batchId);
              }
            }
          );
        }
      }
    ]);
  };// 🚀 ५. नया एक्शन: रास्ते में निकलने का बटन दबाना (सर्ver -> out_for_delivery)
  const handleStartJourney = async (batchId: number) => {
    console.log(`🚀 Starting Journey for Batch #${batchId}. Setting status to out_for_delivery...`);
    
    updateStatusMutation.mutate(
      { batchId, status: 'out_for_delivery' },
      {
        onSuccess: async () => {
          try {
            // 🎯 सुधार ४: जर्नी स्टार्ट होते ही लोकल स्टोरेज का टाइमस्टैम्प फिर से रीसेट (Fresh 60 Mins)
            const activeBatchesJson = await AsyncStorage.getItem('active_out_for_delivery_batches');
            if (activeBatchesJson) {
              let activeBatches = JSON.parse(activeBatchesJson);
              const batchIndex = activeBatches.findIndex((b: any) => b.id === batchId);

              if (batchIndex > -1) {
                activeBatches[batchIndex].status = 'out_for_delivery';
                activeBatches[batchIndex].updatedAt = new Date().toISOString(); // टाइमर रीसेट भाई!
                await AsyncStorage.setItem('active_out_for_delivery_batches', JSON.stringify(activeBatches));
              }
            }
          } catch (e) {
            console.error("❌ AsyncStorage re-sync failed:", e);
          }
          setActiveBatchId(batchId);
        }
      }
    );
  };

  // 🏁 5. एक्शन: कस्टमर को डिलीवरी देना (OTP वेरिफिकेशन के साथ)
  const sendOtpMutation = useMutation({
    mutationFn: async (batchId: number) => {
      return await api.post(`/api/delivery/batches/${batchId}/send-otp`);
    },
    onSuccess: () => {
      console.log("✅ OTP API Triggered successfully");
      setOtpModalVisible(true);
    },
    onError: (error: any) => {
      Alert.alert("Error", "OTP भेजने में दिक्कत आई: " + error.message);
    }
  });

  const handleConfirmDelivery = (batchId: number) => {
    setSelectedBatchForOtp(batchId);
    sendOtpMutation.mutate(batchId);
  };

  // ओटीपी सबमिट करने का फाइनल लॉजिक (GPS STOP ON DELIVERED)
 // ओटीपी सबमिट करने का फाइनल लॉजिक (GPS STOP ON DELIVERED)
  const submitDeliveryOtp = () => {
    if (!deliveryOtp || deliveryOtp.length < 4) {
      Alert.alert("त्रुटि", "कृपया सही OTP दर्ज करें!");
      return;
    }

    if (!selectedBatchForOtp) return;

    setOtpModalVisible(false);

    updateStatusMutation.mutate(
      { batchId: selectedBatchForOtp, status: 'delivered', otp: deliveryOtp },
      {
        onSuccess: async () => {
          // 🎯 फिक्स: यहाँ ब्रैकेट को सही से बंद किया है और 'BATCH_DELIVERED' रीज़न पास किया है भाई
          await stopLiveTracking(selectedBatchForOtp!, 'BATCH_DELIVERED');

          setActiveBatchId(null);
          setDeliveryOtp('');
          Alert.alert("सफलता", "ऑर्डर सफलतापूर्वक डिलीवर हो गया है! 🎉");
        }
      }
    );
  };
const TaskCardItem = ({ item, activeBatchId, handleStartJourney, handleConfirmPickup, handleConfirmDelivery, navigation }: any) => {
  const [totalToCollect, setTotalToCollect] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState<boolean>(true);

  const currentStatus = item.status?.toLowerCase();
  const isJourneyActive = activeBatchId === item.id;

  // 🎯 जादू यहाँ है: स्क्रीन पर कार्ड आते ही यह आपकी नई सटीक एपीआई को कॉल करेगा
 // 🎯 आपके कस्टमाइज्ड api इंस्टेंस के साथ सुधरा हुआ इफेक्ट
 // 🎯 फिक्स 2: कस्टमाइज्ड api इंस्टेंस और सेफ़ क्लीन-अप के साथ सुधरा हुआ प्राइज लोडर भाई
  useEffect(() => {
    let isMounted = true;

    const fetchBatchPrice = async () => {
      try {
        setLoadingPrice(true);
        const response = await api.get(`/api/delivery/batch-price/${item.id}`); 
        
        if (isMounted) {
          if (response.data && response.data.totalToCollect !== undefined) {
            setTotalToCollect(Number(response.data.totalToCollect));
          } else {
            setTotalToCollect(0);
          }
        }
      } catch (error: any) {
        console.log(`❌ Price API Fail for batch ${item.id}:`, error.message);
        if (isMounted) setTotalToCollect(0); 
      } finally {
        if (isMounted) setLoadingPrice(false);
      }
    };

    fetchBatchPrice();

    // मेमोरी लीक रोकने के लिए क्लीन-अप फंक्शन भाई
    return () => {
      isMounted = false;
    };
  }, [item.id, api]); // 🎯 यहाँ 'api' को डिपेंडेंसी में लॉक कर दिया ताकि लाइव ट्रैकिंग स्मूथ रहे भाई

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
        onPress={() =>navigation.navigate('BatchDetails', { batchId: item.id, batchData: item  })}
      >
        <Feather name="eye" size={16} color="#D4AF37" style={{ marginRight: 6 }} />
        <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 14 }}>View Orders (कस्टमर जानकारी)</Text>
      </TouchableOpacity>
      <View style={styles.divider} />
      
  {/* 🔘 ऐक्शन्स बटन्स */}
{/* 🎯 फिक्स 1: केस-इन्सेंसिटिव स्टेटस चेकिंग के साथ सुधरा हुआ ऐक्शन बटन्स ब्लॉक भाई */}
  <View style={styles.actionRow}>
    {/* स्टेप 1: जब बैच सिर्फ असाइन हुआ हो, तब दुकान से सामान पिकअप करने का बटन दिखेगा भाई */}
    {item.status?.toLowerCase() === 'assigned' && (
      <TouchableOpacity 
        style={[styles.mapBtn, { backgroundColor: '#10b981', width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 }]} 
        onPress={() => handleConfirmPickup(item.id)}
      >
        <Feather name="check-square" size={18} color="#fff" />
        <Text style={[styles.btnText, { color: '#fff', marginLeft: 8, fontWeight: 'bold' }]}>Confirm Pickup</Text>
      </TouchableOpacity>
    )}

    {/* स्टेप 2: सामान पिकअप हो चुका है, अब राइडर जर्नी स्टार्ट करने के लिए बटन दबाएगा */}
    {item.status?.toLowerCase() === 'picked_up' && (
      <TouchableOpacity 
        style={[styles.mapBtn, { backgroundColor: '#f59e0b', width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 }]} 
        onPress={() => handleStartJourney(item.id)}
      >
        <Feather name="navigation" size={18} color="#fff" />
        <Text style={[styles.btnText, { color: '#fff', marginLeft: 8, fontWeight: 'bold' }]}>Start Journey (Out for Delivery)</Text>
      </TouchableOpacity>
    )}

    {/* स्टेप 3: जब राइडर रास्ते में हो, तब कस्टमर के घर पहुँचकर OTP डालने का बटन दिखेगा */}
    {item.status?.toLowerCase() === 'out_for_delivery' && (
      <TouchableOpacity 
        style={[styles.mapBtn, { backgroundColor: '#0284c7', width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 }]} 
        onPress={() => handleConfirmDelivery(item.id)}
      >
        <Feather name="home" size={18} color="#fff" />
        <Text style={[styles.btnText, { color: '#fff', marginLeft: 8, fontWeight: 'bold' }]}>Confirm Delivery (Enter OTP)</Text>
      </TouchableOpacity>
    )}
  </View>

{/* 🎯 लाइव इंडिकेटर: सामान पिकअप होने से लेकर डिलीवर होने तक (दोनों स्टेट्स में) लाइव ट्रैकिंग का रेड डॉट चमकेगा भाई */}
{(currentStatus === 'picked_up' || currentStatus === 'out_for_delivery') && (
  <View style={styles.liveIndicator}>
    <View style={styles.redDot} />
    <Text style={styles.liveText}>Live Tracking Active (60 Min Max)</Text>
  </View>
)}
    </View>
  );
}
// 🎯 फिक्स 2: क्रैश रोकने के लिए 'handleStartJourney' को सफलतापूर्वक यहाँ पास कर दिया भाई!
const renderTask = ({ item }: any) => {
  return (
    <TaskCardItem 
      item={item}
      activeBatchId={activeBatchId}
      handleConfirmPickup={handleConfirmPickup}
      handleStartJourney={handleStartJourney} // 👈 यह मिसिंग था भाई, अब बिल्कुल सेफ़ है!
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

          {/* 🎯 FIRE BYPASS BUTTON: बिना ओटीपी के सीधे डिलीवरी */}
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
                      
                      updateStatusMutation.mutate(
                        { 
                          batchId: selectedBatchForOtp!, 
                          status: 'delivered', 
                          otp: 'BYPASS_BY_RIDER' 
                        },
                        {
                          onSuccess: async () => {
                            // 🔥 FIX: बाईपास से डिलीवर होने पर भी बैकग्राउंड जीपीएस को तुरंत बंद करो भाई!
                         await stopLiveTracking(selectedBatchForOtp!, 'BYPASS_DELIVERED');
                            setActiveBatchId(null);
                            setDeliveryOtp('');
                            Alert.alert("सफलता", "ऑर्डर बिना OTP के सीधे डिलीवर मार्क कर दिया गया है। 🎉");
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
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('❌ [BACKGROUND TASK FATAL]:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const { latitude, longitude } = locations[0].coords;

      try {
        const activeBatchesJson = await AsyncStorage.getItem('active_out_for_delivery_batches');
        
        // 🎯 सुधार: अगर स्टोरेज में कोई डेटा नहीं है, तो बार-बार लॉग प्रिंट करने के बजाय चुपचाप यहीं इंजन बंद कर दो भाई
        if (!activeBatchesJson) {
          const isTaskRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TRACKING_TASK);
          if (isTaskRunning) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
          }
          return; // यहीं से बाहर निकल जाओ, फालतू लॉग नहीं आएगा!
        }

       let activeBatches = JSON.parse(activeBatchesJson);
        const now = Date.now();
        const ONE_HOUR_MS = 60 * 60 * 1000;

        const validBatchIds: number[] = [];
        const remainingBatches = activeBatches.filter((batch: any) => {
          
          // 🎯 फिक्स: किसी स्पेसिफिक स्टेटस के टाइमस्टैम्प के बजाय 'updatedAt' या 'timestamp' का इस्तेमाल करें
          // जब मोबाइल ऐप में बैच स्टोर करें, तो उसमें 'updatedAt' ज़रूर डालें भाई
          const baseTime = batch.updatedAt ? new Date(batch.updatedAt).getTime() : now;
          const timeElapsed = now - baseTime;
          
          // 🎯 अब यह 'picked_up' और 'out_for_delivery' दोनों को बिना किसी NaN एरर के पूरे 1 घंटे तक ट्रैक करेगा!
          if (timeElapsed < ONE_HOUR_MS) {
            validBatchIds.push(batch.id);
            return true;
          }
          return false;
        });
        if (remainingBatches.length !== activeBatches.length) {
          await AsyncStorage.setItem('active_out_for_delivery_batches', JSON.stringify(remainingBatches));
        }

        if (validBatchIds.length > 0) {
          await api.put('/api/delivery/update-location', { 
            latitude, 
            longitude,
            activeBatchIds: validBatchIds 
          });
          console.log(`📌 [BG GPS SYNC]: Sent location for active batches [${validBatchIds.join(', ')}]`);
        } else {
          // 🎯 सुधार: अगर कोई वैलिड बैच नहीं बचा, तो बैकएंड को खाली एरे देकर जीपीएस बंद कर दो भाई
          try {
            await api.put('/api/delivery/update-location', { latitude, longitude, activeBatchIds: [] });
          } catch (e) {}

          const isTaskRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TRACKING_TASK);
          if (isTaskRunning) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
          }
        }

      } catch (err) {
        console.error('❌ [BG GPS SYNC FAILED]:', err);
      }
    }
  }
});