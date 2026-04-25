import React from 'react';
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
export default function AvailableBatchesScreen({ navigation }: any) {
  const queryClient = useQueryClient();

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
    // 💡 Backend Logic: Humne Controller mein PATCH use kiya tha, wahi yahan rakhein
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

  const renderBatchItem = ({ item }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.batchId}>Batch #{item.id}</Text>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>₹{item.deliveryCharge || item.delivery_charge || '40'}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Feather name="package" size={14} color="#64748b" />
        <Text style={styles.infoText}>{item.totalSubOrders || 0} Shop(s) to visit</Text>
      </View>

      <View style={styles.infoRow}>
        <Feather name="shopping-bag" size={14} color="#64748b" />
        <Text style={styles.infoText} numberOfLines={2}>
          Pickup: {item.pickupShops || "Unknown Shop"}
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
  ); // ✅ Bracket yahan sahi band hua hai

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