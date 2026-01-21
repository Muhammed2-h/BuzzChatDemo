import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId, addMessage } from '@/lib/rooms';

const INACTIVE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request: Request) {
  try {
    const { roomId, passkey, username, sessionToken, adminCode } = await request.json();

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

    let isNewRoom = false;

    if (!rooms[sanitizedRoomId]) {
      if (!adminCode) {
        return NextResponse.json({ success: false, error: 'To create a new room, you must provide an Admin Code.' }, { status: 400 });
      }
      // Room doesn't exist, create it.
      isNewRoom = true;
      rooms[sanitizedRoomId] = {
        passkey: passkey,
        messages: [{
          user: 'System',
          text: `Room '${sanitizedRoomId}' created.`,
          timestamp: now,
          id: crypto.randomUUID()
        }],
        users: [], // users will be added right after
        creator: username,
        adminCode: adminCode || undefined
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

    // 1. Check if Room is scheduled for deletion
    if (room.deletionScheduledAt) {
      return NextResponse.json({ success: false, error: 'Room is closing down.' }, { status: 410 });
    }

    // 2. Check Admin Presence (Strict Mode)
    // Regular users cannot join if no Admin is currently online.
    // Exception: The user joining IS the admin (creator or has adminCode).
    const isAnyAdminOnline = room.users.some(u => u.isAdmin || u.username === room.creator);
    const isJoiningUserAdmin = (username === room.creator) || (room.adminCode && adminCode === room.adminCode);

    if (!isAnyAdminOnline && !isJoiningUserAdmin) {
      return NextResponse.json({ success: false, error: 'Entry Restricted: An Admin must be present in the room.' }, { status: 403 });
    }

    // Check if username is already in use
    const existingUserIndex = room.users.findIndex(user => user.username === username);

    // Check for Admin Override
    const isAdminOverride = !!(room.adminCode && adminCode === room.adminCode);

    if (existingUserIndex !== -1) {
      // User Reclaiming Session:
      const existingUser = room.users[existingUserIndex];

      // Security Check: Prevent Session Hijacking
      // If the active user has a session token, the request MUST provide the matching token.
      if (existingUser.sessionToken && existingUser.sessionToken !== sessionToken) {
        if (!isAdminOverride) {
          return NextResponse.json({ success: false, error: 'Username is taken. To rejoin as this user, you need your original session.' }, { status: 403 });
        }
      }

      // If matching (or legacy user has no token), update session.
      // If Admin Override, we ensure we generate a FRESH token to take control.
      let token = (isAdminOverride ? crypto.randomUUID() : (existingUser.sessionToken || crypto.randomUUID()));
      existingUser.sessionToken = token;
      existingUser.lastSeen = now;

      if (isAdminOverride) {
        room.creator = username;
        if (!room.ownerToken) room.ownerToken = token;
        existingUser.isAdmin = true;
      }

      if (!existingUser.joinedAt) existingUser.joinedAt = now;

      addMessage(room, {
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

    // 1. Check if the incoming user is the True Owner returning OR Admin Override
    if (((sessionToken && room.ownerToken && sessionToken === room.ownerToken) || isAdminOverride) && !isNewRoom) {
      if (isAdminOverride) {
        finalToken = crypto.randomUUID(); // Fresh token
        if (!room.ownerToken) room.ownerToken = finalToken;
      } else {
        finalToken = sessionToken!;
      }
      room.creator = username;   // Restore Title
      isRestore = true;
    }

    // 2. If this is a fresh room (just created), set the Owner Token
    if (username === room.creator && !room.ownerToken) {
      room.ownerToken = finalToken;
    }

    room.users.push({
      username,
      lastSeen: now,
      sessionToken: finalToken,
      isAdmin: (username === room.creator || isAdminOverride),
      joinedAt: now
    });

    const joinMsg = isRestore
      ? `${username} returned and reclaimed ownership!`
      : `${username} has joined.`;

    addMessage(room, {
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
