import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId, addMessage } from '@/lib/rooms';

export async function POST(request: Request) {
  try {
    const { roomId, passkey, username, explicit } = await request.json();

    if (!roomId || !passkey || !username) {
      return NextResponse.json({ success: false, error: 'Room ID, passkey, and username are required.' }, { status: 400 });
    }

    const id = sanitizeId(roomId);
    if (!rooms[id] || rooms[id].passkey !== passkey) {
      // Fail silently if room doesn't exist or passkey is wrong
      return NextResponse.json({ success: true });
    }

    const room = rooms[id];

    const userIndex = room.users.findIndex(user => user.username === username);
    if (userIndex !== -1) {
      room.users.splice(userIndex, 1);

      let messageText = `${username} left the room.`;

      // Succession Protocol: Seniority Rule
      if (explicit && room.creator === username) {
        if (room.users.length > 0) {
          // room.users[0] is the user who joined earliest among survivors
          // (since we append new users to the end)
          const newOwner = room.users[0].username;
          room.creator = newOwner;
          messageText = `${username} left. Ownership transferred to ${newOwner}.`;
        }
      }

      addMessage(room, {
        user: 'System',
        text: messageText,
        timestamp: Date.now(),
        id: crypto.randomUUID()
      });
    }

    saveRooms();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/LEAVE] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
