import { WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { getLanIp } from '../../infrastructure/network';
import { validateToken } from '../auth/auth.service';
import { log } from '../../lib/logger';
import { WsSession } from './session';
import type { ConnectedClient } from '../../domain/types';
import {
  addClient,
  removeClient,
  getClient,
  addTransfer,
  getTransfer,
  removeTransfer,
  sendToClient,
  broadcastClients,
} from './client-registry';

// ─── Connection handler ──────────────────────────────────────────────

export function handleConnection(ws: WebSocket, req: IncomingMessage) {
  const clientId = crypto.randomUUID();
  const rawIp = (req.socket.remoteAddress || '').replace('::ffff:', '');
  const clientIp = (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '') ? getLanIp() : rawIp;
  log.debug('transfer.handler.ts', 'New WS connection', { clientIp });

  let client: ConnectedClient | null = null;
  let authenticated = false;
  const session = new WsSession();

  ws.on('message', async (data, isBinary) => {
    // ── Binary: decrypt if encrypted, then relay to receiver ──
    if (isBinary) {
      if (!authenticated) { ws.close(4401, 'Unauthorized'); return; }
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      let payload: Buffer;
      if (session.cipher) {
        try {
          payload = await session.cipher.decryptBinary(buf);
        } catch (err) {
          log.warn('transfer.handler.ts', 'Binary decryption failed', { error: String(err) });
          return;
        }
      } else {
        payload = buf;
      }

      const transferId = payload.subarray(0, 36).toString('ascii').trim();
      const transferSess = getTransfer(transferId);
      if (!transferSess) {
        log.warn('transfer.handler.ts', 'Binary chunk received for unknown transferId', { transferId });
        return;
      }
      const receiver = getClient(transferSess.receiverClientId);
      if (!receiver || receiver.ws.readyState !== WebSocket.OPEN) return;

      if (receiver.cipher) {
        void receiver.cipher.encryptBinary(payload).then((encrypted) => {
          if (receiver.ws.readyState === WebSocket.OPEN) {
            receiver.ws.send(encrypted, { binary: true });
          }
        });
      } else {
        receiver.ws.send(payload, { binary: true });
      }
      return;
    }

    // ── Text: JSON signaling ──
    let msg: any;
    try { msg = JSON.parse(data.toString()); } catch (err) {
      log.error('transfer.handler.ts', 'Mensaje WS no es JSON válido', { error: String(err) });
      return;
    }

    // ── Auth: must be the first message ──
    if (!authenticated) {
      if (msg.type !== 'auth') {
        log.warn('transfer.handler.ts', 'First WS message was not auth', { type: msg.type, clientIp });
        ws.close(4401, 'Unauthorized');
        return;
      }
      if (!validateToken(String(msg.token ?? ''))) {
        log.warn('transfer.handler.ts', 'WS auth failed — invalid token', { clientIp });
        ws.close(4401, 'Token inválido');
        return;
      }
      authenticated = true;
      log.debug('transfer.handler.ts', 'WS client authenticated', { clientIp });
      ws.send(JSON.stringify({ type: 'auth_ok' }));
      return;
    }

    // ── Decrypt if encrypted mode ──
    if (session.cipher && msg.type === 'encrypted') {
      try {
        const plaintext = await session.cipher.decryptJson(msg.iv as string, msg.data as string);
        msg = JSON.parse(plaintext);
      } catch (err) {
        log.warn('transfer.handler.ts', 'JSON decryption failed', { error: String(err) });
        return;
      }
    }

    // ── Key exchange ──
    if (msg.type === 'key-exchange') {
      try {
        const serverPubKeyB64 = await session.handleKeyExchange(String(msg.publicKey ?? ''));
        // Store cipher on the client record if already registered
        if (client) client.cipher = session.cipher;
        log.debug('transfer.handler.ts', 'Key exchange complete — encryption active', { clientIp });
        ws.send(JSON.stringify({ type: 'key-exchange', publicKey: serverPubKeyB64 }));
      } catch (err) {
        log.error('transfer.handler.ts', 'Key exchange failed', { error: String(err) });
      }
      return;
    }

    switch (msg.type) {
      case 'hello': {
        client = {
          ws,
          clientId,
          appName: msg.appName || 'Unknown',
          receiving: false,
          ip: clientIp,
          deviceType: msg.deviceType === 'mobile' ? 'mobile' : 'desktop',
          isServer: msg.isServer === true,
          cipher: session.cipher,
        };
        addClient(clientId, client);
        log.info('transfer.handler.ts', 'Client registered', { clientId, appName: client.appName, ip: clientIp, deviceType: client.deviceType, isServer: client.isServer, encrypted: !!client.cipher });
        sendToClient(ws, { type: 'welcome', clientId }, session.cipher);
        broadcastClients();
        break;
      }

      case 'set-receiving': {
        if (!client) return;
        client.receiving = !!msg.receiving;
        broadcastClients();
        break;
      }

      case 'rename': {
        if (!client) return;
        const newName = (msg.newName || '').trim();
        if (newName) {
          client.appName = newName;
          broadcastClients();
        }
        break;
      }

      case 'send-request': {
        if (!client) return;
        const { to, fileName, fileSize, mimeType, transferId } = msg;
        const receiver = getClient(to);
        if (!receiver || receiver.ws.readyState !== WebSocket.OPEN) {
          log.warn('transfer.handler.ts', 'Transfer target offline', { transferId, to, fileName });
          sendToClient(ws, { type: 'send-reject', transferId, reason: 'offline' }, session.cipher);
          return;
        }
        log.info('transfer.handler.ts', 'Transfer request relayed', { transferId, from: client.appName, to: receiver.appName, fileName, fileSize });
        addTransfer(transferId, {
          transferId,
          senderClientId: clientId,
          receiverClientId: to,
          fileName,
          fileSize,
          mimeType,
        });
        sendToClient(receiver.ws, {
          type: 'send-request',
          from: clientId,
          fromName: client.appName,
          fileName,
          fileSize,
          mimeType,
          transferId,
        }, receiver.cipher);
        break;
      }

      case 'send-accept': {
        if (!client) return;
        const transferSess = getTransfer(msg.transferId);
        if (!transferSess || transferSess.receiverClientId !== clientId) return;
        log.info('transfer.handler.ts', 'Transfer accepted', { transferId: msg.transferId, receiver: client.appName });
        const sender = getClient(transferSess.senderClientId);
        if (sender) sendToClient(sender.ws, { type: 'send-accept', transferId: msg.transferId }, sender.cipher);
        break;
      }

      case 'send-reject': {
        if (!client) return;
        const transferSess = getTransfer(msg.transferId);
        if (!transferSess || transferSess.receiverClientId !== clientId) return;
        log.info('transfer.handler.ts', 'Transfer rejected', { transferId: msg.transferId, receiver: client.appName });
        const sender = getClient(transferSess.senderClientId);
        if (sender) sendToClient(sender.ws, { type: 'send-reject', transferId: msg.transferId }, sender.cipher);
        removeTransfer(msg.transferId);
        break;
      }

      case 'send-cancel': {
        if (!client) return;
        const transferSess = getTransfer(msg.transferId);
        if (!transferSess) return;
        log.info('transfer.handler.ts', 'Transfer cancelled', { transferId: msg.transferId, by: client.appName });
        const otherId = transferSess.senderClientId === clientId
          ? transferSess.receiverClientId
          : transferSess.senderClientId;
        const other = getClient(otherId);
        if (other) sendToClient(other.ws, { type: 'send-cancel', transferId: msg.transferId }, other.cipher);
        removeTransfer(msg.transferId);
        break;
      }

      case 'send-complete': {
        if (!client) return;
        const transferSess = getTransfer(msg.transferId);
        if (!transferSess || transferSess.senderClientId !== clientId) return;
        log.info('transfer.handler.ts', 'Transfer complete', { transferId: msg.transferId, fileName: transferSess.fileName, fileSize: transferSess.fileSize });
        const receiver = getClient(transferSess.receiverClientId);
        if (receiver) sendToClient(receiver.ws, { type: 'send-complete', transferId: msg.transferId }, receiver.cipher);
        removeTransfer(msg.transferId);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (client) {
      log.info('transfer.handler.ts', 'Client disconnected', { clientId, appName: client.appName });
      removeClient(clientId);
      broadcastClients();
    } else {
      log.debug('transfer.handler.ts', 'Unauthenticated WS connection closed', { clientIp });
    }
  });
}
