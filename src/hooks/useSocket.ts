import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Sound from 'react-native-sound';
import { Alert } from 'react-native';
import auth from '@react-native-firebase/auth'; // Consistency ke liye @react-native-firebase/auth use kiya
import { useAuth } from '../context/AuthContext'; // Maan kar chal raha hoon aapke paas delivery app mein bhi AuthContext hai

const SOCKET_URL = "https://api.shopnish.com";

// 🔔 Sound Setup
Sound.setCategory('Playback');
const siren = new Sound('siren.mp3', Sound.MAIN_BUNDLE, (error) => {
  if (error) {
    console.log('🔔 [SOUND ERROR]: Siren load nahi ho saki. Check res/raw folder.', error);
  } else {
    console.log('✅ [SOUND READY]: Siren file successfully load ho chuki hai.');
  }
});

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth(); // Delivery boy details ke liye

  // 🛑 Siren Stop Function (Seller App Style)
  const stopSiren = () => {
    try {
      if (siren && siren.isLoaded()) {
        siren.pause(); 
        siren.setCurrentTime(0);
        console.log('✅ Siren Shanti: Stopped and Reset');
      }
    } catch (err) {
      console.log('❌ Stop Error bypassed:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initSocket = async () => {
      try {
        const token = await auth().currentUser?.getIdToken(true);
        if (!token) return;

        if (socketRef.current) {
          socketRef.current.disconnect();
        }

        socketRef.current = io(SOCKET_URL, {
          transports: ['polling', 'websocket'], // Robustness ke liye dono
          secure: true,
          reconnection: true,
          auth: { token: `Bearer ${token}` },
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
          if (!isMounted) return;
          console.log('✅ [DELIVERY SOCKET CONNECTED]: ID ->', socket.id);
          setIsConnected(true);

          if (user?.id) {
            // Room join karein (Future targeted alerts ke liye)
            const uRoom = `user_room_${user.id}`;
            socket.emit('join-room', uRoom);
            
            // 🚨 SIREN LOGIC FOR ALL DELIVERY BOYS (Broadcasting)
            // Seller app jab "Ready for Pickup" karegi, toh ye event fire hoga
            const globalDeliveryEvent = 'new-available-delivery';
            
            socket.off(globalDeliveryEvent);

            // 📢 Alert handling logic
            const handleDeliveryAlert = (data: any) => {
              console.log('🔥 [NEW BATCH AVAILABLE]:', data);

              // CRITICAL FIX: Crash-safe play logic
              if (siren && siren.isLoaded()) {
                try {
                  siren.pause();
                  siren.setCurrentTime(0);
                  
                  setTimeout(() => {
                    siren.setNumberOfLoops(-1); // Loop chalta rahega jab tak action na le
                    siren.setVolume(1.0);
                    siren.play((success) => {
                      if (!success) siren.reset();
                    });
                  }, 50); // Android safety delay
                } catch (e) {
                  console.log("Siren Play Error:", e);
                }
              }

              Alert.alert(
                "Naya Task Available! 🚚",
                `Batch #${data.deliveryBatchId}\n📍 Pickup: ${data.pickupLocation || 'N/A'}\n👤 To: ${data.customerName || 'Customer'}`,
                [
                  { 
                    text: "View Batch", 
                    onPress: () => {
                      stopSiren(); // User action par siren band
                    } 
                  },
                  {
                    text: "Ignore",
                    onPress: () => stopSiren(),
                    style: 'cancel'
                  }
                ],
                { cancelable: false }
              );
            };

            // Listen for available batches
            socket.on(globalDeliveryEvent, handleDeliveryAlert);
          }
        });

        socket.on('connect_error', (err) => {
          console.log('❌ [CONNECTION ERROR]:', err.message);
          if (isMounted) setIsConnected(false);
        });

        socket.on('disconnect', () => {
          if (isMounted) setIsConnected(false);
          stopSiren();
        });

      } catch (err) {
        console.log('❌ [INIT ERROR]:', err);
      }
    };

    if (user?.id) {
      initSocket();
    }

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.off('new-available-delivery');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      stopSiren();
    };
  }, [user?.id]);

  const emitLocation = useCallback((batchId: number, lat: number, lng: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('deliveryBoy:location_update', { batchId, lat, lng });
    }
  }, []);

  return { isConnected, emitLocation, stopSiren, socket: socketRef.current };
};