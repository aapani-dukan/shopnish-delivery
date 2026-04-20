import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { auth } from '../services/firebaseConfig';

const SOCKET_URL = "https://api.shopnish.com";

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const initSocket = async () => {
      // 1. Firebase se fresh token lein (Backend Auth ke liye)
      const token = await auth.currentUser?.getIdToken();

      socketRef.current = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: { token: `Bearer ${token}` }, // 🚩 Backend middleware ke liye zaroori
        reconnection: true,
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Socket Connected: Ready to stream location');
        setIsConnected(true);
        
        // Admin updates aur naye orders ke liye client register karein
        socketRef.current?.emit('register-client', { 
          role: 'delivery-boy', 
          userId: auth.currentUser?.uid 
        });
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
      });
    };

    initSocket();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  // 🚀 Function: Live location bhejne ke liye
  const emitLocation = useCallback((batchId: number, lat: number, lng: number) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('deliveryBoy:location_update', {
        batchId,
        lat,
        lng,
      });
    }
  }, [isConnected]);

  return { isConnected, emitLocation, socket: socketRef.current };
};