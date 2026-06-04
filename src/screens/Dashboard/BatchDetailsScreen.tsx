import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Feather from 'react-native-vector-icons/Feather';
import { apiRequest } from '../../services/queryClient';
import axios from 'axios';
import api from '../../services/api';

export default function BatchDetailsScreen({ route, navigation }: any) {
  // 🎯 MyTasksScreen से भेजा हुआ पूरा डेटा निकालें
  const { batchId, batchData } = route.params || {};
  const queryClient = useQueryClient();

  // 1. 🎯 फिक्स 1: यहाँ स्ट्रिंग बैकटिक (`) लगाया भाई ताकि 'batchId' वेरिएबल सही से रीड हो सके
  const { data: batchFromServer, isLoading } = useQuery({
    queryKey: [`/delivery/batch-details/${batchId}`],
    queryFn: async () => {
      const response = await api.get(`/api/delivery/batch-details/${batchId}`);
      return response.data;
    }
  });

  // 🎯 2. फिक्स 2: यहाँ भी क्वेरी की और यूआरएल दोनों को बैकटिक में लॉक किया भाई
  const { data: priceData } = useQuery({
    queryKey: [`/delivery/batch-price/${batchId}`],
    queryFn: async () => {
      const response = await api.get(`/api/delivery/batch-price/${batchId}`);
      return response.data;
    }
  });

  // 🎯 सेफ्टी फ़ॉलबैक: डेटा कम्बाइन कर लें भाई
  const currentBatch = batchData || batchFromServer;

  // 2. 🎯 फिक्स 3: म्यूटेशन यूआरएल को भी बैकटिक (`) देकर सुधारा भाई!
  const completeMutation = useMutation({
    mutationFn: (orderId: number) => api.post(`/api/delivery/complete-order/${orderId}`),
    onSuccess: () => {
      Alert.alert("सफलता", "ऑर्डर सफलतापूर्वक डिलीवर हो गया भाई! 🎉");
      queryClient.invalidateQueries({ queryKey: [`/delivery/batch-details/${batchId}`] });
      queryClient.invalidateQueries({ queryKey: ['/delivery/my-tasks'] });
    },
    onError: (error: any) => {
      console.error("❌ Delivery Completion Failed:", error);
      Alert.alert("Error", error.response?.data?.error || "Order complete karne mein dikkat aayi.");
    }
  });

  // 🎯 फिक्स 4: लिस्ट डेटा को नए सब-ऑर्डर्स आर्किटेक्चर के हिसाब से मैप किया भाई
  const listData = batchFromServer?.subOrders || batchFromServer?.orders || [currentBatch].filter(Boolean);

  // 🛍️ SELLER / SHOP SECTION RENDERING
  const renderHeaderDetails = () => {
    const shopPhone = currentBatch?.pickupPoints?.[0]?.phone || "N/A";

    return (
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Batch #{batchId} की पूरी जानकारी</Text>
        
        {/* 🏪 सेलर/दुकान की जानकारी का तगड़ा कार्ड */}
        <View style={styles.sellerCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconTitleRow}>
              <Feather name="shopping-bag" size={20} color="#D4AF37" />
              <Text style={styles.sectionTitle}>Pickup From (दुकान)</Text>
            </View>
            
            {shopPhone !== "N/A" && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${shopPhone}`)}>
                {/* 🎯 फिक्स 5: टेक्स्ट का रंग साफ़ चमकाने के लिए इनलाइन कलर सुधारा भाई */}
                <View style={[styles.callIcon, { backgroundColor: '#001B3A' }]}>
                  <Feather name="phone" size={16} color="#D4AF37" />
                  <Text style={[styles.callText, { color: '#D4AF37' }]}>Call Shop</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.shopName}>{currentBatch?.pickupShops || "Unknown Shop"}</Text>
          <Text style={styles.shopAddress}>📍 {currentBatch?.pickupAddresses || "Address Not Available"}</Text>
        </View>

        <Text style={[styles.title, { marginTop: 15, fontSize: 18 }]}>Customer Details & Actions</Text>
      </View>
    );
  };

  const renderOrder = ({ item }: any) => {
    const bData = item || currentBatch || {};

    const displayCustomerName = bData.customerName || 'Customer';
    const displayCustomerPhone = bData.customerPhone || '';
    const displayDeliveryAddress = bData.shippingAddress || bData.deliveryAddress || 'Local Address';
    const displayCity = bData.deliveryCity || 'Bundi';
    const displayNearBy = bData.nearBy || ''; 

    return (
      <View style={styles.orderCard}>
        {/* 👤 कस्टमर का कार्ड हेडर */}
        <View style={styles.cardHeader}>
          <View style={styles.iconTitleRow}>
            <Feather name="user" size={18} color="#001B3A" />
            <Text style={styles.customerName}>{displayCustomerName}</Text>
          </View>
          
          {displayCustomerPhone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${displayCustomerPhone}`)}>
              <View style={styles.callIcon}>
                <Feather name="phone" size={16} color="#fff" />
                <Text style={[styles.callText, { color: '#fff' }]}>Call Customer</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 🏠 कस्टमर का पूरा पता */}
        <Text style={styles.addressText}>🏠 {displayDeliveryAddress}, {displayCity}</Text>
        
        {/* 🎯 NEAR BY FIELD: पीले बॉक्स में */}
        {displayNearBy && displayNearBy !== "Not Provided" && displayNearBy !== "null" && (
          <View style={{ 
            backgroundColor: '#fef3c7', 
            padding: 8, 
            borderRadius: 6, 
            marginTop: 8, 
            flexDirection: 'row', 
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#fde68a'
          }}>
            <Feather name="compass" size={14} color="#b45309" style={{ marginRight: 6 }} />
            <Text style={{ color: '#b45309', fontSize: 13, fontWeight: '500' }}>
              <Text style={{ fontWeight: 'bold' }}>Nearby: </Text>
              {displayNearBy}
            </Text>
          </View>
        )}
        
        <View style={styles.divider} />
        
        <View style={styles.footer}>
          <Text style={[styles.amount, { color: '#ef4444' }]}>
            Payable Amount: {priceData?.totalToCollect !== undefined ? `₹${Number(priceData.totalToCollect).toFixed(2)}` : "कैलकुलेट हो रहा है..."}
          </Text>
          
          <TouchableOpacity 
            style={[styles.deliverBtn, item?.status === 'delivered' && styles.disabledBtn]}
            onPress={() => completeMutation.mutate(item?.id || batchId)}
            disabled={item?.status === 'delivered'}
          >
            <Text style={styles.deliverBtnText}>
              {item?.status === 'delivered' ? "Completed" : "Mark Delivered"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // 🎯 फिक्स 6: रिस्पॉन्स के एरे को सेफ़ली फॉलबैक के साथ सिंक किया भाई
  const dataToRender = Array.isArray(listData) ? listData : [];

  return (
    <View style={styles.container}>
      <FlatList
        data={dataToRender}
        renderItem={renderOrder}
        keyExtractor={(item, index) => (item?.id || index).toString()}
        contentContainerStyle={{ padding: 15 }}
        ListHeaderComponent={renderHeaderDetails}
        ListEmptyComponent={
          <Text style={styles.emptyText}>इस बैच की डिटेल्स लोड हो रही हैं...</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerContainer: { marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  
  sellerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 5, borderLeftColor: '#D4AF37', elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginLeft: 6 },
  shopName: { fontSize: 18, fontWeight: '800', color: '#001B3A', marginBottom: 4 },
  shopAddress: { fontSize: 13, color: '#475569', lineHeight: 18 },
  
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 15, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#10b981' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customerName: { fontSize: 18, fontWeight: '700', color: '#001B3A', marginLeft: 6 },
  callIcon: { backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  callText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4, color: '#fff' },
  addressText: { fontSize: 14, color: '#475569', lineHeight: 20, paddingLeft: 4 },
  
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  deliverBtn: { backgroundColor: '#001B3A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  deliverBtnText: { color: '#D4AF37', fontWeight: 'bold', fontSize: 13 },
  disabledBtn: { backgroundColor: '#cbd5e1' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8' }
});