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

    const existingRoom = rooms[sanitizedRoomId];
    if (existingRoom && (existingRoom.isDeleted || (existingRoom.deletionScheduledAt && now > existingRoom.deletionScheduledAt))) {
      delete rooms[sanitizedRoomId];
      saveRooms();
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

    // Security: Check if this is a returning user with a valid session token
    const isReturningWithToken = sessionToken && room.users.some(u => u.username === username && u.sessionToken === sessionToken);

    // If not a returning session, or if a passkey IS provided, we must validate the passkey.
    if (!isReturningWithToken || (passkey && passkey !== room.passkey)) {
      if (room.passkey !== passkey) {
        return NextResponse.json({ success: false, error: 'Invalid passkey.' }, { status: 403 });
      }
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
    const HEARTBEAT_TIMEOUT = 30 * 1000; // 30 seconds to be considered "Present"

    if (existingUserIndex !== -1) {
      const existingUser = room.users[existingUserIndex];

      // Security Check: 
      // If the user provides the correct PASSKEY, they are the owner of the identity (in this simple app).
      // We allow them to overwrite the old session.
      // We ONLY block if they are trying to "sneak in" with a session token that is wrong AND no passkey.

      if (existingUser.sessionToken && existingUser.sessionToken !== sessionToken) {
        if (!passkey && !isAdminOverride) {
          // Trying to use a token to auto-login, but it's wrong.
          return NextResponse.json({ success: false, error: 'Session expired. Please re-enter passkey.' }, { status: 403 });
        }
        // If they provided the passkey (which we validated above), we ALLOW them to take over.
      }

      // If we are here, we are allowed to take over the session.
      let token = (isAdminOverride ? crypto.randomUUID() : (sessionToken || crypto.randomUUID()));
      existingUser.sessionToken = token;
      existingUser.lastSeen = now;

      if (isAdminOverride) {
        // room.creator = username; // Don't steal title
        if (!room.creator) room.creator = username;
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
    const isTrueOwner = (sessionToken && room.ownerToken && sessionToken === room.ownerToken);

    if ((isTrueOwner || isAdminOverride) && !isNewRoom) {
      if (isAdminOverride) {
        finalToken = crypto.randomUUID(); // Fresh token
        if (!room.ownerToken) room.ownerToken = finalToken;
      } else {
        finalToken = sessionToken!;
      }

      if (isTrueOwner || !room.creator) {
        room.creator = username;   // Restore Title only if True Owner
        isRestore = true;
      }
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
