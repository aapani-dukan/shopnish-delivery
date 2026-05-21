import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import { useSocket } from '../../hooks/useSocket';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MyTasksScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { isConnected, socket } = useSocket(); // 👈 Socket instance nikala live emit ke liye
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);
  
  // 🎯 Geolocation watch id ko store karne ke liye useRef (taaki journey khatam hone par band ho sake)
  const watchIdRef = useRef<number | null>(null);

  // App khulte hi check karo ki koi journey pehle se chal toh nahi rahi thi
  useEffect(() => {
    const checkActiveJourney = async () => {
      const savedBatchId = await AsyncStorage.getItem('activeBatchId');
      if (savedBatchId) {
        const bId = parseInt(savedBatchId);
        setActiveBatchId(bId);
        // 🔄 Agar app crash/close hui thi aur boy safar par tha, toh live tracking fir se auto-start kar do
        startLiveTracking(bId);
      }
    };
    checkActiveJourney();

    // Clean up: Screen se bahar jaane par tracking band ho jaye
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // 1. Apne accepted batches fetch karein
  const { data: myTasks, isLoading } = useQuery({
    queryKey: ['/delivery/my-tasks'],
    queryFn: async () => {
      const response = await api.get("/api/delivery/batches");
      return response.data.batches || response.data; 
    },
    refetchInterval: 30000, 
  });
// 📡 2. ZOMATO STYLE LIVE TRACKING SENDER (Updated with Type Fix)
  const startLiveTracking = (batchId: number) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;

        if (socket && socket.connected) {
          console.log(`🚀 Sending Bike Live Location: Lat ${latitude}, Lng ${longitude}`);
          socket.emit('delivery:location-update', {
            batchId: batchId,
            latitude: latitude,
            longitude: longitude,
            heading: heading || 0 
          });
        }
      },
      (error) => console.error("🚨 Live GPS Error:", error),
      // 🎯 FIX: 'as any' lagane se type definition wali error turant khatam ho jayegi
      {
        enableHighAccuracy: true, 
        distanceFilter: 1,        
        maximumAge: 0
      } as any 
    );
  };
  
  // 3. Start Journey Logic
  const startJourney = async (batch: any) => {
    setActiveBatchId(batch.id);
    await AsyncStorage.setItem('activeBatchId', batch.id.toString());
    
    Alert.alert("Journey Started", "Aapka live location ab customers ko real-time dikh raha hai."); 
    
    // Live tracking shooter ko start karein
    startLiveTracking(batch.id);

    // Dynamic map URL generation
    const targetLat = batch.pickupPoints?.[0]?.latitude || batch.deliveryLat;
    const targetLng = batch.pickupPoints?.[0]?.longitude || batch.deliveryLng;

    let url = "";
    if (targetLat && targetLng) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`;
    } else {
      const cleanAddress = encodeURIComponent(batch.pickupAddresses || "Bundi Market");
      url = `https://www.google.com/maps/dir/?api=1&destination=${cleanAddress}`;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Maps open nahi ho paa raha hai.");
    });
  };

  // 4. Confirm Pickup Logic
  const handleConfirmPickup = async (batchId: number) => {
    // Live tracking ka loop band karo kyunki shop par pahunch gaye hain
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    await AsyncStorage.removeItem('activeBatchId');
    setActiveBatchId(null);
    Alert.alert("Pickup Confirmed", "Ab aap agla safar customer ke liye shuru kar sakte hain.");
  };

  const renderTask = ({ item }: any) => (
    <View style={styles.card}>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
      </View>
      
      <Text style={styles.batchTitle}>Batch #{item.id}</Text>
      
      <View style={styles.infoRow}>
        <Feather name="shopping-bag" size={16} color="#475569" />
        <Text style={styles.shopText} numberOfLines={1}>
          {item.pickupShops || "Unknown Shop"}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Feather name="map-pin" size={14} color="#64748b" />
        <Text style={styles.addressText} numberOfLines={2}>
          {item.pickupAddresses || "Address Not Available"}
        </Text>
      </View>

      <Text style={styles.orderCount}>📦 {item.totalSubOrders || item.orders?.length || 0} Orders to deliver</Text>

      <View style={styles.divider} />

      <View style={styles.actionRow}>
        {/* 🎯 RE-RENDER FIX: State aur Storage ke combination se button maintain rahega */}
        {activeBatchId === item.id ? (
          <TouchableOpacity 
            style={[styles.mapBtn, { backgroundColor: '#10b981' }]} 
            onPress={() => handleConfirmPickup(item.id)}
          >
            <Feather name="check-square" size={18} color="#fff" />
            <Text style={[styles.btnText, { color: '#fff' }]}>Confirm Pickup</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.mapBtn} 
            onPress={() => startJourney(item)}
          >
            <Feather name="navigation" size={18} color="#001B3A" />
            <Text style={styles.btnText}>Start Journey</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.detailBtn}
          onPress={() => navigation.navigate('BatchDetails', { 
            batchId: item.id,
            batchData: item 
          })}
        >
          <Text style={styles.detailText}>View Orders</Text>
        </TouchableOpacity>
      </View>

      {activeBatchId === item.id && (
        <View style={styles.liveIndicator}>
          <View style={styles.redDot} />
          <Text style={styles.liveText}>Live Tracking Active</Text>
        </View>
      )}
    </View>
  );

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
        ListEmptyComponent={
          <Text style={styles.empty}>Abhi aapne koi batch claim nahi kiya hai.</Text>
        }
      />
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
  mapBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D4AF37', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  btnText: { marginLeft: 8, fontWeight: 'bold', color: '#001B3A' },
  detailBtn: { justifyContent: 'center', paddingHorizontal: 15 },
  detailText: { color: '#001B3A', fontWeight: '600' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: '#fff1f2', padding: 8, borderRadius: 8 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 8 },
  liveText: { fontSize: 12, color: '#ef4444', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 100, color: '#94a3b8' }
});