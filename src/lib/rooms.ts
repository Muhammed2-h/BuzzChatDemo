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
  lastReadTimestamp?: number;
}

export interface Room {
  passkey: string;
  messages: Message[];
  users: User[];
  pinnedMessage?: Message | null;
  pinnedBy?: string[];
  bannedUsers?: string[];
  creator?: string;
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

export const saveRooms = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2));
  } catch (e) {
    console.error("Failed to save room data:", e);
  }
};
