import { NextResponse } from 'next/server';
import { rooms, sanitizeId, addMessage } from '@/lib/rooms';

const INACTIVE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const passkey = searchParams.get('passkey');
    const since = searchParams.get('since');
    const username = searchParams.get('username');
    const isTyping = searchParams.get('isTyping') === 'true';

    if (!roomId || !passkey || !username) {
      return NextResponse.json({ success: false, error: 'Room ID, passkey, and username are required.' }, { status: 400 });
    }

    const room = rooms[sanitizeId(roomId)];

    if (room && room.isDeleted) {
      return NextResponse.json({ success: false, error: 'Room has been deleted.' }, { status: 410 });
    }

    if (!room || room.passkey !== passkey) {
      return NextResponse.json({ success: false, error: 'Authentication failed. Invalid room or passkey.' }, { status: 403 });
    }

    const sinceTimestamp = since ? parseInt(since, 10) : 0;
    if (isNaN(sinceTimestamp)) {
      return NextResponse.json({ success: false, error: 'Invalid "since" timestamp.' }, { status: 400 });
    }

    const now = Date.now();

    // Update current user's lastSeen timestamp and read receipts
    let userFound = false;
    room.users.forEach(user => {
      if (user.username === username) {
        user.lastSeen = now;
        user.isTyping = isTyping;
        user.lastReadTimestamp = now;
        userFound = true;
      }
    });

    // Mark messages as read by this user
    room.messages.forEach(msg => {
      if (!msg.readBy) msg.readBy = [];
      if (!msg.readBy.includes(username) && msg.timestamp <= now) {
        msg.readBy.push(username);
      }
    });

    // If user is polling but not in the list, add them. This can happen on server restart or if they were timed out incorrectly.
    // If user is polling but not in the list, it means they were kicked or timed out.
    // Do NOT automatically re-add them. 
    if (!userFound) {
      return NextResponse.json({ success: false, error: 'User not active. You may have been kicked or timed out.' }, { status: 401 });
    }

    // Check for timed out users
    const activeUsers = room.users.filter(user => now - user.lastSeen < INACTIVE_TIMEOUT_MS);
    const timedOutUsers = room.users.filter(user => now - user.lastSeen >= INACTIVE_TIMEOUT_MS);

    if (timedOutUsers.length > 0) {
      room.users = activeUsers;
      timedOutUsers.forEach(timedOutUser => {
        addMessage(room, {
          user: 'System',
          text: `${timedOutUser.username} has left (timed out).`,
          timestamp: now,
          id: crypto.randomUUID()
        });
      });
    }

    const newMessages = room.messages.filter(
      (msg) => msg.timestamp > sinceTimestamp || (msg.editedAt && msg.editedAt > sinceTimestamp)
    );

    const currentUser = room.users.find(u => u.username === username);
    const isCurrentUserAdmin = currentUser?.isAdmin || room.creator === username;

    return NextResponse.json({
      success: true,
      messages: newMessages,
      users: room.users.map(u => u.username),
      typingUsers: room.users.filter(u => u.isTyping && u.username !== username).map(u => u.username),
      pinnedMessage: room.pinnedMessage,
      pinnedBy: room.pinnedBy,
      creator: room.creator,
      admins: room.users.filter(u => u.isAdmin || u.username === room.creator).map(u => u.username),
      adminCode: isCurrentUserAdmin ? room.adminCode : undefined,
    });
  } catch (error) {
    console.error('[API/POLL] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
