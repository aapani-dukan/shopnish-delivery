import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import { apiRequest } from '../../services/queryClient';
import axios from 'axios';
export default function BatchDetailsScreen({ route, navigation }: any) {
  const { batchId } = route.params;
  const queryClient = useQueryClient();

  // 1. Batch ke andar ke saare orders fetch karein
  const { data: batch, isLoading } = useQuery({
    queryKey: [`/delivery/batch-details/${batchId}`],
    queryFn: async () => {
      const response = await axios.get(`/api/delivery/batch-details/${batchId}`);
      return response.data;
    }
  });

  // 2. Mark as Delivered Mutation
  const completeMutation = useMutation({
    mutationFn: (orderId: number) => apiRequest('POST', `/delivery/complete-order/${orderId}`),
    onSuccess: () => {
      Alert.alert("Success", "Order delivered successfully!");
      queryClient.invalidateQueries({ queryKey: [`/delivery/batch-details/${batchId}`] });
    },
  });

  const renderOrder = ({ item }: any) => (
    <View style={styles.orderCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.customerName}>{item.customerName || 'Customer Name'}</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.customerPhone}`)}>
          <View style={styles.callIcon}>
            <Feather name="phone" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.addressText}>📍 {item.shippingAddress}</Text>
      
      <View style={styles.divider} />
      
      <View style={styles.footer}>
        <Text style={styles.amount}>Payable: ₹{item.totalAmount}</Text>
        <TouchableOpacity 
          style={[styles.deliverBtn, item.status === 'delivered' && styles.disabledBtn]}
          onPress={() => completeMutation.mutate(item.id)}
          disabled={item.status === 'delivered'}
        >
          <Text style={styles.deliverBtnText}>
            {item.status === 'delivered' ? "Completed" : "Mark Delivered"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={(batch as { orders: any[] })?.orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 15 }}
        ListHeaderComponent={<Text style={styles.title}>Orders in Batch #{batchId}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  title: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 15 },
  orderCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  customerName: { fontSize: 18, fontWeight: '700', color: '#001B3A' },
  callIcon: { backgroundColor: '#10b981', padding: 10, borderRadius: 12 },
  addressText: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  deliverBtn: { backgroundColor: '#001B3A', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8 },
  deliverBtnText: { color: '#D4AF37', fontWeight: 'bold' },
  disabledBtn: { backgroundColor: '#e2e8f0' }
});