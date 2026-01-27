import fs from 'fs';
import path from 'path';

export interface Message {
  user: string;
  text: string;
  timestamp: number;
  replyTo?: {
    user: string;
    text: string;
    id?: string;
  };
  id: string;
  isAnnouncement?: boolean;
  editedAt?: number;
  readBy?: string[];
  mentions?: string[];
}

export interface User {
  username: string;
  lastSeen: number;
  isTyping?: boolean;
  sessionToken?: string; // Secret token to verify identity
  isAdmin?: boolean; // Is this user an admin?
  joinedAt?: number; // Timestamp when user joined
}

export interface Room {
  passkey: string;
  messages: Message[];
  users: User[];
  pinnedMessage?: Message | null;
  pinnedBy?: string[];
  bannedUsers?: string[];
  creator?: string;
  isDeleted?: boolean;
  deletionScheduledAt?: number;
  ownerToken?: string; // Token of the true owner/creator
  adminCode?: string; // Secret code for creator recovery
}

// Helper to sanitize Room IDs consistently
export const sanitizeId = (id: string) => {
  return id.replace(/[^a-zA-Z0-9-]/g, '');
};

// Persistence Logic
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error("Failed to create data directory:", e);
  }
}

// Load initial data
let loadedRooms: Record<string, Room> = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    loadedRooms = JSON.parse(fileContent);
    console.log("Loaded persistent room data.");
  } catch (e) {
    console.error("Failed to load room data:", e);
  }
}

export const rooms: Record<string, Room> = loadedRooms;

// Persistence: Save immediately (Sync) to avoid Next.js serverless timeout issues
export const saveRooms = () => {
  try {
    const data = JSON.stringify(rooms);
    console.log(`[Persistence] Saving ${Object.keys(rooms).length} rooms to ${DATA_FILE}`);
    fs.writeFileSync(DATA_FILE, data);
  } catch (e) {
    console.error("[Persistence] Failed to save rooms:", e);
  }
};

// Helper: Add message with pruning to prevent memory bloating
export const addMessage = (room: Room, message: Message) => {
  if (!room.messages) room.messages = [];
  room.messages.push(message);

  // Senior Professional Logic: Cap messages at 100 to prevent server crashes
  if (room.messages.length > 100) {
    room.messages = room.messages.slice(-100);
  }
};
