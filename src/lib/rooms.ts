export interface Message {
  user: string;
  text: string;
  timestamp: number;
  replyTo?: {
    user: string;
    text: string;
  };
}

export interface User {
  username: string;
  lastSeen: number;
  isTyping?: boolean;
}

export interface Room {
  passkey: string;
  messages: Message[];
  users: User[];
  pinnedMessage?: Message | null;
  pinnedBy?: string | null;
}

// In-memory store for rooms, will be cleared on server restart.
export const rooms: Record<string, Room> = {};
