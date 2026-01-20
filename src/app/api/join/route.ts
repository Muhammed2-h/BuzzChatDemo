import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId } from '@/lib/rooms';

const INACTIVE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request: Request) {
  try {
    const { roomId, passkey, username } = await request.json();

    if (!roomId || !passkey || !username) {
      return NextResponse.json({ success: false, error: 'Room ID, passkey, and username are required.' }, { status: 400 });
    }

    const sanitizedRoomId = sanitizeId(roomId);
    if (!sanitizedRoomId) {
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
          timestamp: now,
          id: crypto.randomUUID()
        }],
        users: [], // users will be added right after
        creator: username
      };
    }

    const room = rooms[sanitizedRoomId];
    if (!room.creator) {
      room.creator = username;
    }

    // Room exists, validate the provided passkey.
    if (room.passkey !== passkey) {
      return NextResponse.json({ success: false, error: 'Invalid passkey.' }, { status: 403 });
    }

    if (room.bannedUsers && room.bannedUsers.includes(username)) {
      return NextResponse.json({ success: false, error: 'You have been banned from this room.' }, { status: 403 });
    }

    // Clean up inactive users before checking for duplicates
    const activeUsers = room.users.filter(user => (now - user.lastSeen) < INACTIVE_TIMEOUT_MS);
    room.users = activeUsers;

    // Check if username is already in use
    const existingUserIndex = room.users.findIndex(user => user.username === username);

    if (existingUserIndex !== -1) {
      // User Reclaiming Session:
      // Since they provided the correct room passkey, we allow them to take over this username.
      // This solves the issue of users getting locked out if they disconnect without a clean exit.
      room.users[existingUserIndex].lastSeen = now;
      
      room.messages.push({
        user: 'System',
        text: `${username} reconnected.`,
        timestamp: now,
        id: crypto.randomUUID()
      });
      
      saveRooms();
      return NextResponse.json({ success: true });
    }

    // Add new user to the room
    room.users.push({ username, lastSeen: now });
    room.messages.push({
      user: 'System',
      text: `${username} has joined.`,
      timestamp: now,
      id: crypto.randomUUID()
    });

    saveRooms();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API/JOIN] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
