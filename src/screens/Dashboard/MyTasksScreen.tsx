import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import { apiRequest } from '../../services/queryClient';
import { useSocket } from '../../hooks/useSocket';

export default function MyTasksScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { emitLocation, isConnected } = useSocket();
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);

  // 1. Apne accepted batches fetch karein
  const { data: myTasks, isLoading } = useQuery({
    queryKey: ['/delivery-boys/my-tasks'],
  });

  // 2. Start Journey Logic (Socket Start karega)
  const startJourney = (batch: any) => {
    setActiveBatchId(batch.id);
    Alert.alert("Journey Started", "Aapka live location ab customers ko dikh raha hai.");
    
    // Yahan hum Google Maps khol sakte hain pickup location ke liye
    const url = `https://www.google.com/maps/dir/?api=1&destination=Bundi+Main+Market`;
    Linking.openURL(url);
  };

  const renderTask = ({ item }: any) => (
    <View style={styles.card}>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
      </View>
      
      <Text style={styles.batchTitle}>Batch #{item.id}</Text>
      <Text style={styles.orderCount}>{item.orders?.length} Orders to deliver</Text>

      <View style={styles.divider} />

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.mapBtn} 
          onPress={() => startJourney(item)}
        >
          <Feather name="navigation" size={18} color="#001B3A" />
          <Text style={styles.btnText}>Start Journey</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.detailBtn}
          onPress={() => navigation.navigate('BatchDetails', { batchId: item.id })}
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
  batchTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  orderCount: { color: '#64748b', marginTop: 4 },
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