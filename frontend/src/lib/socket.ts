import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(`${SOCKET_URL}/ws`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Re-emit all events to listeners
    this.socket.onAny((event, data) => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach((callback) => callback(data));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeScan(scanId: string) {
    this.socket?.emit('subscribe:scan', { scanId });
  }

  unsubscribeScan(scanId: string) {
    this.socket?.emit('unsubscribe:scan', { scanId });
  }

  subscribeDomain(domainId: string) {
    this.socket?.emit('subscribe:domain', { domainId });
  }

  subscribeToolExecution(executionId: string) {
    this.socket?.emit('subscribe:tool-execution', { executionId });
  }

  unsubscribeToolExecution(executionId: string) {
    this.socket?.emit('unsubscribe:tool-execution', { executionId });
  }

  // HexStrike AI process subscriptions
  subscribeHexStrikeProcesses() {
    this.socket?.emit('subscribe:hexstrike-processes');
  }

  unsubscribeHexStrikeProcesses() {
    this.socket?.emit('unsubscribe:hexstrike-processes');
  }

  subscribeHexStrikeProcess(pid: number) {
    this.socket?.emit('subscribe:hexstrike-process', { pid });
  }

  unsubscribeHexStrikeProcess(pid: number) {
    this.socket?.emit('unsubscribe:hexstrike-process', { pid });
  }

  // Check if socket is connected
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Force reconnect
  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    } else {
      this.connect();
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback);
  }
}

export const socketClient = new SocketClient();

// React hook for socket events
export function useSocket(event: string, callback: (data: any) => void) {
  const { useEffect } = require('react');

  useEffect(() => {
    socketClient.connect();
    const unsubscribe = socketClient.on(event, callback);

    return () => {
      unsubscribe();
    };
  }, [event, callback]);
}

