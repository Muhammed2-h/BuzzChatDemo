import { NextResponse } from 'next/server';
import { rooms } from '@/lib/rooms';

const INACTIVE_TIMEOUT_MS = 10 * 1000; // 10 seconds

export async function POST(request: Request) {
  try {
    const { roomId, passkey, username } = await request.json();

    if (!roomId || !passkey || !username) {
      return NextResponse.json({ success: false, error: 'Room ID, passkey, and username are required.' }, { status: 400 });
    }

    const sanitizedRoomId = roomId.replace(/[^a-zA-Z0-9-]/g, '');
    if(!sanitizedRoomId) {
        return NextResponse.json({ success: false, error: 'Invalid Room ID format.' }, { status: 400 });
    }

    const now = Date.now();

    if (!rooms[sanitizedRoomId]) {
      // Room doesn't exist, create it.
      rooms[sanitizedRoomId] = {
        passkey: passkey,
        messages: [{
            user: 'System',
            text: `Room '${sanitizedRoomId}' created.`,
            timestamp: now
        }],
        users: [], // users will be added right after
      };
    }
    
    const room = rooms[sanitizedRoomId];

    // Room exists, validate the provided passkey.
    if (room.passkey !== passkey) {
      return NextResponse.json({ success: false, error: 'Invalid passkey.' }, { status: 403 });
    }

    // Clean up inactive users before checking for duplicates
    const activeUsers = room.users.filter(user => (now - user.lastSeen) < INACTIVE_TIMEOUT_MS);
    room.users = activeUsers;

    // Check if username is already in use
    if (room.users.some(user => user.username === username)) {
      return NextResponse.json({ success: false, error: 'Username is already taken in this room.' }, { status: 409 });
    }

    // Add user to the room
    room.users.push({ username, lastSeen: now });
    room.messages.push({
        user: 'System',
        text: `${username} has joined.`,
        timestamp: now
    });

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('[API/JOIN] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
