import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Alert,
  Dimensions
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import api from '../../services/api';

// 🎯 बैकग्राउंड टास्क का यूनिक नाम (यह नाम पूरे ऐप में सेम रहेगा भाई)
const BACKGROUND_TRACKING_TASK = 'BACKGROUND_GPS_TRACKING_TASK';
const { width } = Dimensions.get('window');
export default function AvailableBatchesScreen({ navigation, route }: any) {
  const queryClient = useQueryClient();

  // =====================================================================
  // 🚀 LIVE BACKGROUND GPS CONTROLLER (START / STOP LOGIC)
  // =====================================================================
  const startLiveTracking = async (batchId: number, journeyType: 'TO_SHOP' | 'TO_CUSTOMER') => {
    try {
      const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
      if (foreStatus !== 'granted') {
        Alert.alert("Permission Denied", "Foreground लोकेशन परमिशन की आवश्यकता है भाई।");
        return;
      }
      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backStatus !== 'granted') {
        Alert.alert("Permission Denied", "Background लोकेशन परमिशन को 'Always Allow' पर सेट करें भाई।");
        return;
      }
      await AsyncStorage.setItem('active_tracking_batch_id', String(batchId));
      await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1500, 
        distanceInterval: 0,
        deferredUpdatesInterval: 1500,
        foregroundService: {
          notificationTitle: "Shopnish Delivery Active",
          notificationBody: journeyType === 'TO_SHOP' ? "Going towards shop..." : "En route to customer...",
          notificationColor: "#001B3A"
        }
      });
    } catch (error) {
      console.error("❌ Error starting tracking:", error);
    }
  };

  const stopLiveTracking = async (reason: string) => {
    try {
      const isTaskRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TRACKING_TASK);
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      }
      await AsyncStorage.removeItem('active_tracking_batch_id');
    } catch (error) {
      console.error("❌ Error stopping tracking:", error);
    }
  };

  useEffect(() => {
    if (navigation) {
      navigation.setParams({ startLiveTracking, stopLiveTracking });
    }
  }, [navigation]);

  // =====================================================================
  // 🎯 फिक्स 1: useQuery से 'batches' और 'isRefetching' दोनों को साफ़ बाहर निकाला भाई
  // =====================================================================
  const { data: batches = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['/delivery/available-batches'],
    queryFn: async () => {
      const res = await api.get("/api/delivery/available-batches");
      // अगर डेटा के अंदर 'batches' की है तो उसे लें, नहीं तो डायरेक्ट रेस्पॉन्स लें भाई
      return res.data?.batches || res.data || [];
    },
  });

  // 2. Mutation: Claim Batch (Order Accept Karna)
  const claimMutation = useMutation({
    mutationFn: (batchId: number) => api.patch(`/api/delivery/batches/${batchId}/claim`),
    onSuccess: () => {
      Alert.alert("Success", "Batch claim ho gaya hai! Ab aap delivery shuru kar sakte hain.");
      queryClient.invalidateQueries({ queryKey: ['/delivery/available-batches'] });
      navigation.navigate('My Tasks'); 
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.error || "Batch claim karne mein samasya hui.";
      Alert.alert("Error", errorMsg);
    }
  });
  const renderBatchItem = ({ item }: any) => {
    const customerName = item.customerName || 'Customer';
    const deliveryCity = item.deliveryCity || 'Bundi';
    const customerPhone = item.customerPhone || 'N/A';

    let finalAddress = 'N/A';

    if (item.deliveryAddress) {
      if (typeof item.deliveryAddress === 'string' && (item.deliveryAddress.startsWith('{') || item.deliveryAddress.startsWith('['))) {
        try {
          const parsedAddr = JSON.parse(item.deliveryAddress);
          const line1 = parsedAddr?.addressLine1 || parsedAddr?.address_line1 || parsedAddr?.address || "";
          const line2 = parsedAddr?.addressLine2 || parsedAddr?.address_line2 || "";
          finalAddress = (line1 || line2) ? `${line1} ${line2}`.trim() : 'N/A';
        } catch (e) {
          finalAddress = item.deliveryAddress;
        }
      } else {
        finalAddress = item.deliveryAddress;
      }
    }

    if (finalAddress === 'Local Address' || finalAddress.trim() === "") {
      finalAddress = 'N/A';
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.batchId}>{item.batchNumber || `Batch #${item.id}`}</Text>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>₹{item.deliveryCharge}</Text>
          </View>
        </View>

        {/* 🏪 Shop Details */}
       <View style={styles.infoRow}>
<Feather name="shopping-bag" size={15} color="#2563eb" />
<View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginLeft: 6 }}>
<Text style={{ fontWeight: 'bold', color: '#1e293b' }}>Pickup Points:</Text>
<View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5, borderColor: '#bfdbfe' }}>
<Text style={{ fontSize: 11, color: '#2563eb', fontWeight: '800' }}>
{item.pickupShops?.split(',')?.length || 1} Shops
</Text>
</View>
</View>
</View>
<View style={{ marginLeft: 22, marginBottom: 4 }}>
<Text style={{ fontSize: 14, color: '#334155', fontWeight: '600' }}>
{item.pickupShops || 'Unknown Shop'}
</Text>
<Text style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 16 }}>
📍 {item.pickupAddresses || 'Address Not Available'}
</Text>
</View>
<View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 }} />
        {/* 👤 Customer Details */}
        <View style={styles.infoRow}>
          <Feather name="user" size={14} color="#64748b" />
          <Text style={styles.infoText}>
            <Text style={{ fontWeight: 'bold' }}>To: </Text>
            {customerName}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Feather name="map-pin" size={14} color="#64748b" />
          <Text style={styles.infoText}>
            {finalAddress}{deliveryCity ? `, ${deliveryCity}` : ''}
          </Text>
        </View>
        {item.nearBy && item.nearBy !== "Not Provided" && item.nearBy !== "null" && (
          <View style={[styles.infoRow, { backgroundColor: '#fef3c7', padding: 6, borderRadius: 4, marginLeft: 20, marginTop: 2 }]}>
            <Feather name="compass" size={12} color="#b45309" />
            <Text style={[styles.infoText, { color: '#b45309', fontSize: 13, fontWeight: '500' }]}>
              <Text style={{ fontWeight: 'bold' }}>Nearby: </Text>
              {item.nearBy}
            </Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Feather name="phone" size={14} color="#64748b" />
          <Text style={styles.infoText}>
            <Text style={{ fontWeight: 'bold' }}>Call: </Text>
            {customerPhone}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.claimButton}
          onPress={() => claimMutation.mutate(item.id)}
          disabled={claimMutation.isPending}
        >
          {claimMutation.isPending ? (
            <ActivityIndicator color="#001B3A" />
          ) : (
            <Text style={styles.claimButtonText}>Claim This Batch</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Available Work</Text>
        <Text style={styles.headerSubtitle}>Naye orders yahan dikhenge</Text>
      </View>

     {/* 🎯 फिक्स: डेटा और की-एक्स्ट्रैक्टर पर फुल सेफ़्टी फॉलबैक लगाया भाई ताकि एरर न आए */}
      <FlatList
        data={Array.isArray(batches) ? batches : (batches as any)?.batches || []}
        renderItem={renderBatchItem}
        keyExtractor={(item) => String(item?.id || Math.random())}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#D4AF37" />
        }
       // 🎯 फिक्स 2: खाली स्क्रीन पर बिना अटके मैन्युअल रिफ्रेश ट्रिगर करने के लिए बटन भाई
        ListEmptyComponent={
          <View style={styles.emptyContainer || { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60, padding: 20 }}>
            <Feather name="coffee" size={46} color="#94a3b8" />
            <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 12, fontSize: 14, fontWeight: '500', paddingHorizontal: 30 }}>
              Abhi koi naya batch available nahi hai. Aap thodi der baad dobara check karein!
            </Text>
            <TouchableOpacity 
              onPress={() => refetch()} 
              style={{ marginTop: 15, backgroundColor: '#eff6ff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe' }}
            >
              <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 13 }}>Tap to Check Again</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
// =====================================================================
// 🎯 100% असली बैकग्राउंड टास्क (कम्पोनेंट के बाहर टाइपस्क्रिप्ट एरर-फ़्री ब्लॉक भाई)
// =====================================================================
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
        // स्टोरेज से केवल वही एक आईडी निकालो जो अभी एक्टिव है भाई
        const activeBatchId = await AsyncStorage.getItem('active_tracking_batch_id');
        
        if (activeBatchId) {
          // बैकएंड एपीआई पर बिना किसी 'batches' वेरिएबल के सीधे हिट मारो भाई
          await api.put('/api/delivery/update-location', { 
            latitude, 
            longitude,
            activeBatchId: Number(activeBatchId)
          });
          console.log(`🌌 [BG LIVE TRACKING]: Sent for Batch ${activeBatchId} -> (${latitude}, ${longitude})`);
        }
      } catch (err) {
        console.error('❌ [BG GPS SYNC FAILED]:', err);
      }
    }
  }
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, backgroundColor: '#001B3A', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, marginBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#D4AF37' },
  headerSubtitle: { fontSize: 14, color: '#94a3b8' },
  listContent: { padding: 15 },
  card: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  batchId: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  priceTag: { backgroundColor: 'rgba(212, 175, 55, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  priceText: { color: '#D4AF37', fontWeight: 'bold', fontSize: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  infoText: { marginLeft: 8, color: '#64748b', fontSize: 14 },
  claimButton: { backgroundColor: '#D4AF37', height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 15 },
  claimButtonText: { color: '#001B3A', fontWeight: 'bold', fontSize: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 10, paddingHorizontal: 40 }
});