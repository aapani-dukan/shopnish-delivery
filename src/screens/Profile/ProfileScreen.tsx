import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// अगर आपके प्रोजेक्ट में कस्टम एपीआई इंस्टेंस है तो उसे भी यूज़ कर सकते हैं भाई
import api from '../../services/api'; 

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [pincode, setPincode] = useState('');
  const [isUpdatingPincode, setIsUpdatingPincode] = useState(false);

  // 1. Fetch Profile Data (Total Earnings + Completed + Active Pincodes)
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['/delivery/profile'],
    queryFn: async () => {
      const response = await api.get('/api/delivery/profile'); 
      return response.data?.profile || response.data || {};
    },
    staleTime: 5 * 60 * 1000, 
  });

  // जब प्रोफाइल डेटा लोड हो जाए, तो उसका मौजूदा पिनकोड स्टेट में सेट कर दो भाई
  useEffect(() => {
    if (profile?.pincode || profile?.deliveryPincodes) {
      setPincode(String(profile.pincode || profile.deliveryPincodes || ''));
    }
  }, [profile]);

  // 2. 🎯 मास्टरस्ट्रोक: पिनकोड अपडेट करने का लाइव म्यूटेशन इंजन भाई!
  const handleUpdatePincode = async () => {
    if (!pincode || pincode.trim().length !== 6 || isNaN(Number(pincode))) {
      Alert.alert("रुको भाई!", "कृपया सही 6 अंकों का पिनकोड डालें।");
      return;
    }

    try {
      setIsUpdatingPincode(true);
      // ✅ बैकएंड के डिलीवरी प्रोफाइल पैच एंडपॉइंट पर हिट मारो भाई
      await api.patch('/api/delivery/profile/update', { 
        pincode: pincode.trim(),
        deliveryPincodes: pincode.trim() // बैकएंड के दोनों संभावित कॉलम सेफ्टी के लिए भाई
      });

      Alert.alert("सक्सेस ✅", "आपका वर्किंग पिनकोड अपडेट हो गया है भाई!", [
        { text: "कड़क!", onPress: () => queryClient.invalidateQueries({ queryKey: ['/delivery/profile'] }) }
      ]);
    } catch (err: any) {
      console.error("Pincode Update Error:", err?.response?.data || err.message);
      Alert.alert("Error ❌", "पिनकोड अपडेट नहीं हो पाया।");
    } finally {
      setIsUpdatingPincode(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Kya aap sach mein logout karna chahte hain?", [
      { text: "Nahi", style: "cancel" },
      { text: "Haan", onPress: logout }
    ]);
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Header / Avatar Section */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Feather name="user" size={50} color="#D4AF37" />
        </View>
        <Text style={styles.userName}>{user?.name || "Delivery Partner"}</Text>
        <Text style={styles.userPhone}>{user?.phoneNumber || user?.phone}</Text>
        <View style={styles.activeBadge}>
          <Text style={styles.activeText}>Active Partner</Text>
        </View>
      </View>

      {/* Earnings Card */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Earned</Text>
          <Text style={styles.statValue}>₹{profile?.totalEarnings || '0'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={styles.statValue}>{profile?.completedOrders || '0'}</Text>
        </View>
      </View>

      {/* Menu Options */}
      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconBox}>
            <Feather name="credit-card" size={20} color="#001B3A" />
          </View>
          <Text style={styles.menuText}>Bank Details</Text>
          <Feather name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconBox}>
            <Feather name="help-circle" size={20} color="#001B3A" />
          </View>
          <Text style={styles.menuText}>Support Help</Text>
          <Feather name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
          <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}>
            <Feather name="log-out" size={20} color="#ef4444" />
          </View>
          <Text style={[styles.menuText, { color: '#ef4444' }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Shopnish Delivery v1.0.26</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#001B3A', padding: 40, alignItems: 'center', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(212, 175, 55, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#D4AF37', marginBottom: 15 },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  userPhone: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  activeBadge: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 12 },
  activeText: { color: '#fff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: -30 },
  statCard: { backgroundColor: '#fff', width: '47%', padding: 20, borderRadius: 20, elevation: 5, alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#001B3A', marginTop: 5 },
  
  // नए पिनकोड सेक्शन की स्टाइलिंग भाई साहब
  pincodeSection: { backgroundColor: '#fff', margin: 20, marginBottom: 0, borderRadius: 20, padding: 16, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#001B3A', marginBottom: 4 },
  sectionSubtitle: { fontSize: 11, color: '#64748b', marginBottom: 12, lineHeight: 15 },
  pincodeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  pincodeInput: { flex: 1, height: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 15, fontSize: 16, color: '#0f172a', backgroundColor: '#f8fafc' },
  updateBtn: { backgroundColor: '#001B3A', height: 46, paddingHorizontal: 24, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  updateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  menuSection: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 10, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1e293b' },
  version: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginBottom: 30 }
});