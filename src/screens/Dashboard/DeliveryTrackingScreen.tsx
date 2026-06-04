import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { io } from 'socket.io-client';

export default function DeliveryTrackingScreen() {
  const socket = useRef<any>(null);
  const [counter, setCounter] = useState(0);
  
  // 🎯 फिक्स 1: सिंगल orderId के बजाय अब हमारी नई फिक्स टेस्टिंग 'batchId' काम करेगी भाई
  const batchId = 45; // आपकी टेस्टिंग के हिसाब से असाइन की गई बैच आईडी
  const driverId = "driver_69";

  useEffect(() => {
    console.log("🏍️ [TEST MODE]: नया सॉकेट कनेक्शन शुरू...");
let trackingInterval: number;

    // 1. सॉकेट को फ्रेश तरीके से कनेक्ट करो भाई
    socket.current = io("https://api.shopnish.com", {
      transports: ['websocket'],
      forceNew: true
    });

    let mockLat = 25.4456101; // आपके लॉग्स से उठाई गई शुरुआती लोकेशन
    let mockLng = 75.6655329;

    socket.current.on('connect', () => {
      console.log("🔌 [TEST SOCKET CONNECTED]: ID ->", socket.current.id);
      
      // सर्वर पर डिलीवरी बॉय के रूप में रजिस्टर करो भाई
      socket.current.emit("register-client", { role: "delivery", userId: driverId });

      // 🎯 फिक्स 2: अब डिलीवरी बॉय को सीधे उस बैच के लाइव रूम में जॉइन करवाना अनिवार्य है भाई
      socket.current.emit("join-batch-room", { batchId: Number(batchId), role: "delivery" });
      console.log(`📦 [ROOM JOIN]: Joined room for Batch #${batchId}`);

      // 2. स्वतंत्र लूप जो हर 1.5 सेकंड में बिना रुके सिग्नल्स भेजेगा भाई
      trackingInterval = setInterval(() => {
        mockLat += 0.00005; // लोकेशन में लगातार प्रोग्रेसिव बदलाव ताकि मैप पर गाड़ी चलती दिखे

        setCounter(prev => {
          const nextCount = prev + 1;
          console.log(`⚡ [SIGNAL EMIT #${nextCount}] -> समय: ${new Date().toLocaleTimeString()} | New Lat: ${mockLat.toFixed(6)} | Batch: ${batchId}`);
          return nextCount;
        });

        // 🎯 फिक्स 3: पुराना "delivery:location-update" अब नए बैच पेलोड आर्किटेक्चर से बदल गया है भाई
        socket.current.emit("batch:location-update", {
          batchId: Number(batchId),
          driverId: driverId,
          latitude: mockLat,
          longitude: mockLng,
          heading: 90,
          speed: 15
        });

      }, 1500); // हर 1.5 सेकंड में परफेक्ट फायर
    });

    // 🧹 फिक्स 4: परफेक्ट क्लीनअप ताकि स्क्रीन बदलते ही सॉकेट के साथ-साथ इंटरवल भी तुरंत क्लियर हो भाई!
    return () => {
      console.log("🧹 [CLEANUP]: टेस्ट स्क्रीन बंद, सॉकेट डिस्कनेक्ट और इंटरवल साफ़।");
      if (trackingInterval) clearInterval(trackingInterval);
      socket.current?.disconnect();
    };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.text}>🏍️ Independent Batch Tester Active</Text>
      <Text style={styles.subText}>सॉकेट बैच रूम: #{batchId}</Text>
      <Text style={styles.counterText}>भेजे गए कुल सिग्नल्स: {counter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  text: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginTop: 15 },
  subText: { fontSize: 14, color: '#2563eb', marginTop: 5, fontWeight: '600' },
  counterText: { fontSize: 14, color: '#64748b', marginTop: 5, fontWeight: '500' }
});