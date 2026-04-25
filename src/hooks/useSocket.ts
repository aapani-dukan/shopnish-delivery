import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { auth } from '../services/firebaseConfig';

const SOCKET_URL = "https://api.shopnish.com";

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initSocket = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // ✅ IMPORTANT: Fresh token lein taaki Socket Auth fail na ho
        const token = await user.getIdToken(true); 

        socketRef.current = io(SOCKET_URL, {
          transports: ['websocket'],
          auth: { token: `Bearer ${token}` }, // Backend hamesha Bearer mangta hai
          reconnection: true,
          reconnectionAttempts: 5,
        });

        socketRef.current.on('connect', () => {
          if (isMounted) {
            console.log('✅ Socket Connected');
            setIsConnected(true);
            
            // Client register karein
            socketRef.current?.emit('register-client', { 
              role: 'delivery-boy', 
              userId: user.uid 
            });
          }
        });

        socketRef.current.on('connect_error', (err) => {
          console.error("❌ Socket Connection Error:", err.message);
          // Agar auth error hai toh token refresh karke dubara try karein
          if (err.message.includes("Authentication")) {
             setIsConnected(false);
          }
        });

        socketRef.current.on('disconnect', () => {
          if (isMounted) setIsConnected(false);
        });

      } catch (err) {
        console.error("❌ Socket Initialization Error:", err);
      }
    };

    initSocket();

    return () => {
      isMounted = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emitLocation = useCallback((batchId: number, lat: number, lng: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('deliveryBoy:location_update', { batchId, lat, lng });
    }
  }, []);

  return { isConnected, emitLocation, socket: socketRef.current };
};