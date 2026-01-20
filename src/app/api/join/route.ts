import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId } from '@/lib/rooms';

const INACTIVE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request: Request) {
  try {
    const { roomId, passkey, username, sessionToken } = await request.json();

    if (!roomId || !passkey || !username) {
      return NextResponse.json({ success: false, error: 'Room ID, passkey, and username are required.' }, { status: 400 });
    }

    const sanitizedRoomId = sanitizeId(roomId);
    if (!sanitizedRoomId) {
      return NextResponse.json({ success: false, error: 'Invalid Room ID format.' }, { status: 400 });
    }

    const now = Date.now();

    if (rooms[sanitizedRoomId] && rooms[sanitizedRoomId].isDeleted) {
      delete rooms[sanitizedRoomId];
    }

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
      const existingUser = room.users[existingUserIndex];

      // Security Check: Prevent Session Hijacking
      // If the active user has a session token, the request MUST provide the matching token.
      if (existingUser.sessionToken && existingUser.sessionToken !== sessionToken) {
        return NextResponse.json({ success: false, error: 'Username is taken. To rejoin as this user, you need your original session.' }, { status: 403 });
      }

      // If matching (or legacy user has no token), update session.
      const token = existingUser.sessionToken || crypto.randomUUID();
      existingUser.sessionToken = token;
      existingUser.lastSeen = now;

      room.messages.push({
        user: 'System',
        text: `${username} reconnected.`,
        timestamp: now,
        id: crypto.randomUUID()
      });

      saveRooms();
      return NextResponse.json({ success: true, sessionToken: token });
    }

    // Add new user to the room
    // Add new user to the room
    let finalToken = crypto.randomUUID();
    let isRestore = false;

    // 1. Check if the incoming user is the True Owner returning
    if (sessionToken && room.ownerToken && sessionToken === room.ownerToken) {
      finalToken = sessionToken; // Keep the King's Token
      room.creator = username;   // Restore Title
      isRestore = true;
    }

    // 2. If this is a fresh room (just created), set the Owner Token
    if (username === room.creator && !room.ownerToken) {
      room.ownerToken = finalToken;
    }

    room.users.push({ username, lastSeen: now, sessionToken: finalToken });

    const joinMsg = isRestore
      ? `${username} returned and reclaimed ownership!`
      : `${username} has joined.`;

    room.messages.push({
      user: 'System',
      text: joinMsg,
      timestamp: now,
      id: crypto.randomUUID()
    });

    saveRooms();

    return NextResponse.json({ success: true, sessionToken: finalToken });

  } catch (error) {
    console.error('[API/JOIN] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
