import React, { useEffect } from 'react'; // 👈 React ke sath useEffect le liya
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Alert
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import { apiRequest } from '../../services/queryClient';
import api from '../../services/api';
import * as Location from 'expo-location'; // 👈 1. GPS Tracking ke liye library import ki

export default function AvailableBatchesScreen({ navigation }: any) {
  const queryClient = useQueryClient();

  // ================= 🎯 AUTOMATIC GPS SIGNAL LOOP (BINA BUTTON KE) =================
  useEffect(() => {
    let locationWatcher: any = null;

    const startAutomaticLocationSync = async () => {
      try {
        // A. Phone se GPS data lene ki permission maangein
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('📌 [GPS APP]: User ne permission nahi di, isiliye null hi rahega.');
          return;
        }

        console.log('📌 [GPS APP]: Automatic background tracking loop initialized.');

        // B. Silent continuous position tracking loop shuru karein
        locationWatcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000,   // ⏱️ Har 1 minute (60000ms) mein hit karega
            distanceInterval: 15,  // 🗺️ Ya fir agar 15 meter ka movement ho toh update karega
          },
          async (location) => {
            const { latitude, longitude } = location.coords;

            // 🚀 Phone bina bataye chupchaap backend route par latitude/longitude bhejega
            try {
              // Kyunki aap 'api.get' use kar rahe hain, iska matlab token axios interceptor/api instance me pehle se set hai!
              await api.put('/api/delivery/update-location', { latitude, longitude });
              console.log(`📍 [GPS APP]: Signal Sent Successfully -> (${latitude}, ${longitude})`);
            } catch (err) {
              console.error('❌ [GPS APP]: Backend location sync failed:', err);
            }
          }
        );
      } catch (error) {
        console.error('Error in location sync execution:', error);
      }
    };

    startAutomaticLocationSync();

    // Cleanup hook: Screen se hatne par ya app band hone par GPS tracking band ho jaye
    return () => {
      if (locationWatcher) {
        locationWatcher.remove();
        console.log('📌 [GPS APP]: Watcher cleanly removed.');
      }
    };
  }, []);
  // ==================================== END ====================================


  // 1. Fetch Available Batches
  const { data: batches, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['/delivery/available-batches'],
    queryFn: async () => {
      const res = await api.get("/api/delivery/available-batches");
      return res.data;
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
  // 🎯 FLAT DATA EXTRACTION: Backend se direct mapped properties aa rahi hain bhai
  const customerName = item.customerName || 'Customer';
  const deliveryAddress = item.deliveryAddress || 'Address Not Provided';
  const deliveryCity = item.deliveryCity || '';
  const customerPhone = item.customerPhone || 'N/A';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {/* API response mein 'id' ya 'batchNumber' dono use kar sakte hain */}
        <Text style={styles.batchId}>{item.batchNumber || `Batch #${item.id}`}</Text>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>₹{item.deliveryCharge}</Text>
        </View>
      </View>

      {/* 🏪 Shop Details */}
      <View style={styles.infoRow}>
        <Feather name="shopping-bag" size={14} color="#D4AF37" />
        <Text style={styles.infoText}>
          <Text style={{ fontWeight: 'bold' }}>Pickup: </Text>
          {item.pickupShops || 'Unknown Shop'}
        </Text>
      </View>
      <View style={[styles.infoRow, { marginLeft: 20 }]}>
        <Text style={[styles.infoText, { fontSize: 12, color: '#64748b' }]}>
          📍 {item.pickupAddresses || 'Address Not Available'}
        </Text>
      </View>

      <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 }} />

      {/* 👤 Customer Details (🎯 FLAT PROPERTIES USED HERE) */}
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
          {deliveryAddress}{deliveryCity ? `, ${deliveryCity}` : ''}
        </Text>
      </View>
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

      <FlatList
        data={(batches as any)?.batches || []}
        renderItem={renderBatchItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#D4AF37" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="coffee" size={50} color="#94a3b8" />
            <Text style={styles.emptyText}>Abhi koi naya batch available nahi hai. Refresh karein!</Text>
          </View>
        }
      />
    </View>
  );
}

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