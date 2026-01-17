export interface Message {
  user: string;
  text: string;
  timestamp: number;
}

export interface Room {
  passkey: string;
  messages: Message[];
}

// In-memory store for rooms, will be cleared on server restart.
export const rooms: Record<string, Room> = {};
