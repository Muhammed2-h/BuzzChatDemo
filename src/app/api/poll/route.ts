import { NextResponse } from 'next/server';
import { rooms } from '@/lib/rooms';

const INACTIVE_TIMEOUT_MS = 30 * 1000; // 30 seconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const passkey = searchParams.get('passkey');
    const since = searchParams.get('since');
    const username = searchParams.get('username');

    if (!roomId || !passkey || !username) {
      return NextResponse.json({ success: false, error: 'Room ID, passkey, and username are required.' }, { status: 400 });
    }

    const room = rooms[roomId];

    if (!room || room.passkey !== passkey) {
      return NextResponse.json({ success: false, error: 'Authentication failed. Invalid room or passkey.' }, { status: 403 });
    }

    const sinceTimestamp = since ? parseInt(since, 10) : 0;
    if (isNaN(sinceTimestamp)) {
        return NextResponse.json({ success: false, error: 'Invalid "since" timestamp.' }, { status: 400 });
    }

    const now = Date.now();

    // Update current user's lastSeen timestamp
    let userFound = false;
    room.users.forEach(user => {
      if (user.username === username) {
        user.lastSeen = now;
        userFound = true;
      }
    });

    // If user is polling but not in the list, add them. This can happen on server restart or if they were timed out incorrectly.
    if (!userFound) {
        room.users.push({ username, lastSeen: now });
        room.messages.push({
            user: 'System',
            text: `${username} has reconnected.`,
            timestamp: now
        });
    }
    
    // Check for timed out users
    const activeUsers = room.users.filter(user => now - user.lastSeen < INACTIVE_TIMEOUT_MS);
    const timedOutUsers = room.users.filter(user => now - user.lastSeen >= INACTIVE_TIMEOUT_MS);

    if (timedOutUsers.length > 0) {
      room.users = activeUsers;
      timedOutUsers.forEach(timedOutUser => {
        room.messages.push({
          user: 'System',
          text: `${timedOutUser.username} has left (timed out).`,
          timestamp: now,
        });
      });
    }

    const newMessages = room.messages.filter(
      (msg) => msg.timestamp > sinceTimestamp
    );

    return NextResponse.json({ success: true, messages: newMessages, users: room.users.map(u => u.username) });
  } catch (error) {
    console.error('[API/POLL] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
