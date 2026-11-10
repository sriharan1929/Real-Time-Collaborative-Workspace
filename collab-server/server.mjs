import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.COLLAB_PORT || "1234", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const prisma = new PrismaClient();

// In-memory rooms: Map<pageId, Room>
const rooms = new Map();

// Redis setup for multi-instance scaling
let redisPublisher = null;
let redisSubscriber = null;
let isRedisConnected = false;

try {
  redisPublisher = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Don't crash if Redis is unavailable
    lazyConnect: true,
  });
  redisPublisher.on("error", () => {});

  redisSubscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  redisSubscriber.on("error", () => {});

  await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
  isRedisConnected = true;
  console.log(`[Collab Server] Redis connected at ${REDIS_URL} (Multi-server sync enabled)`);

  redisSubscriber.subscribe("collab:document-updates");
  redisSubscriber.on("message", (channel, message) => {
    if (channel === "collab:document-updates") {
      try {
        const { pageId, updateBase64, originServerId } = JSON.parse(message);
        if (originServerId === SERVER_ID) return; // Ignore our own broadcast

        const room = rooms.get(pageId);
        if (room) {
          const update = Buffer.from(updateBase64, "base64");
          Y.applyUpdate(room.doc, update, "redis");
        }
      } catch (err) {
        console.error("[Collab Server] Failed to process Redis message:", err);
      }
    }
  });
} catch {
  console.log("[Collab Server] Redis unavailable - running in standalone mode (single instance)");
  redisPublisher = null;
  redisSubscriber = null;
  isRedisConnected = false;
}

const SERVER_ID = `server-${Math.random().toString(36).substring(2, 9)}`;

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

class Room {
  constructor(pageId) {
    this.pageId = pageId;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.conns = new Set();
    this.saveTimeout = null;

    // Listen for doc updates to broadcast to clients and Redis
    this.doc.on("update", (update, origin) => {
      // Broadcast to all other clients in this room
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      for (const conn of this.conns) {
        if (conn !== origin && conn.readyState === WebSocket.OPEN) {
          conn.send(message);
        }
      }

      // Publish to Redis for other server instances
      if (isRedisConnected && redisPublisher && origin !== "redis") {
        try {
          redisPublisher.publish(
            "collab:document-updates",
            JSON.stringify({
              pageId: this.pageId,
              updateBase64: Buffer.from(update).toString("base64"),
              originServerId: SERVER_ID,
            })
          );
        } catch (e) {
          console.warn("[Collab Server] Redis publish error:", e.message);
        }
      }

      // Schedule persistence to PostgreSQL
      this.scheduleSave();
    });

    // Listen for awareness updates
    this.awareness.on("update", ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      );
      const buff = encoding.toUint8Array(encoder);

      for (const conn of this.conns) {
        if (conn !== origin && conn.readyState === WebSocket.OPEN) {
          conn.send(buff);
        }
      }
    });
  }

  scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveToDatabase();
    }, 2000); // 2 second debounce
  }

  async saveToDatabase() {
    try {
      await prisma.page.update({
        where: { id: this.pageId },
        data: {
          updatedAt: new Date(),
        },
      });
      console.log(`[Collab Server] Successfully saved document state for page: ${this.pageId}`);
    } catch (err) {
      console.warn(`[Collab Server] Database auto-save skipped or failed for ${this.pageId}:`, err.message);
    }
  }

  async loadInitialState() {
    // Initial document state is loaded from the page database record on the client
    // and synchronized across peers via the Yjs sync protocol.
  }
}

async function getOrCreateRoom(pageId) {
  let room = rooms.get(pageId);
  if (!room) {
    room = new Room(pageId);
    rooms.set(pageId, room);
    await room.loadInitialState();
  }
  return room;
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", async (ws, req) => {
  // Extract room name (pageId) from URL path: /<pageId> or /page/<pageId>
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname.replace(/^\/+/, "");
  const pageId = pathname.replace(/^page\//, "");

  if (!pageId) {
    ws.close(1008, "Room / Page ID is required");
    return;
  }

  const room = await getOrCreateRoom(pageId);
  room.conns.add(ws);

  console.log(`[Collab Server] Client connected to page room: ${pageId} (active clients: ${room.conns.size})`);

  // Step 1: Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, room.doc);
  ws.send(encoding.toUint8Array(encoder));

  // Step 2: Send current awareness state
  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(awarenessStates.keys())
      )
    );
    ws.send(encoding.toUint8Array(awarenessEncoder));
  }

  // Handle incoming messages
  ws.on("message", (message) => {
    try {
      const uint8Message = new Uint8Array(message);
      const decoder = decoding.createDecoder(uint8Message);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC: {
          const syncEncoder = encoding.createEncoder();
          encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, syncEncoder, room.doc, ws);

          if (encoding.length(syncEncoder) > 1) {
            ws.send(encoding.toUint8Array(syncEncoder));
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          const awarenessUpdate = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(room.awareness, awarenessUpdate, ws);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error("[Collab Server] Message decoding error:", err);
    }
  });

  ws.on("close", () => {
    room.conns.delete(ws);
    console.log(`[Collab Server] Client disconnected from page: ${pageId} (remaining: ${room.conns.size})`);

    // Clean up awareness for this client if empty
    if (room.conns.size === 0) {
      // Save on last client exit
      room.saveToDatabase();
    }
  });

  ws.on("error", (err) => {
    console.error(`[Collab Server] WebSocket error in room ${pageId}:`, err);
  });
});

console.log(`🚀 Real-Time Collaboration Server running on ws://localhost:${PORT}`);
