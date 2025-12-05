import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://frontend:3000'],
    credentials: true,
  },
  namespace: '/ws',
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe:scan')
  handleSubscribeScan(
    @MessageBody() data: { scanId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`scan:${data.scanId}`);
    console.log(`Client ${client.id} subscribed to scan:${data.scanId}`);
    return { event: 'subscribed', data: { scanId: data.scanId } };
  }

  @SubscribeMessage('unsubscribe:scan')
  handleUnsubscribeScan(
    @MessageBody() data: { scanId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`scan:${data.scanId}`);
    console.log(`Client ${client.id} unsubscribed from scan:${data.scanId}`);
    return { event: 'unsubscribed', data: { scanId: data.scanId } };
  }

  @SubscribeMessage('subscribe:domain')
  handleSubscribeDomain(
    @MessageBody() data: { domainId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`domain:${data.domainId}`);
    return { event: 'subscribed', data: { domainId: data.domainId } };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  /**
   * Emit scan progress update
   */
  emitScanUpdate(scanId: string, data: {
    status?: string;
    progress?: number;
    currentStep?: string;
    error?: string;
    results?: any;
  }) {
    this.server.to(`scan:${scanId}`).emit('scan:update', {
      scanId,
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit new vulnerability found
   */
  emitVulnerabilityFound(vulnerability: any) {
    this.server.emit('vulnerability:new', {
      vulnerability,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit new subdomain discovered
   */
  emitSubdomainFound(domainId: string, subdomain: string) {
    this.server.to(`domain:${domainId}`).emit('subdomain:new', {
      domainId,
      subdomain,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit scan completed
   */
  emitScanComplete(scanId: string, results: any) {
    this.server.to(`scan:${scanId}`).emit('scan:complete', {
      scanId,
      results,
      timestamp: Date.now(),
    });

    // Also emit globally
    this.server.emit('scan:completed', {
      scanId,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit notification to all clients
   */
  emitNotification(notification: any) {
    this.server.emit('notification', {
      ...notification,
      timestamp: Date.now(),
    });
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Broadcast to all clients
   */
  broadcast(event: string, data: any) {
    this.server.emit(event, {
      ...data,
      timestamp: Date.now(),
    });
  }
}

