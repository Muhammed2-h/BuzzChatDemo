import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId } from '@/lib/rooms';

export async function POST(request: Request) {
  try {
    const { roomId, passkey, username } = await request.json();

    if (!roomId || !passkey || !username) {
      return NextResponse.json({ success: false, error: 'Room ID, passkey, and username are required.' }, { status: 400 });
    }

    if (!rooms[roomId] || rooms[roomId].passkey !== passkey) {
      // Fail silently if room doesn't exist or passkey is wrong
      return NextResponse.json({ success: true });
    }

    const room = rooms[sanitizeId(roomId)];

    // Check if the user leaving is the creator
    if (room.creator === username) {
      // Delete the room entirely
      delete rooms[sanitizeId(roomId)];
      saveRooms();
      return NextResponse.json({ success: true, message: 'Room deleted by owner.' });
    }

    const userIndex = room.users.findIndex(user => user.username === username);
    if (userIndex !== -1) {
      room.users.splice(userIndex, 1);
      room.messages.push({
        user: 'System',
        text: `${username} left the room.`,
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
