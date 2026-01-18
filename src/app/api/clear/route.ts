
import { NextResponse } from 'next/server';
import { rooms, type Message, saveRooms, sanitizeId } from '@/lib/rooms';

export async function POST(request: Request) {
  try {
    const { roomId, passkey } = await request.json();

    if (!roomId || !passkey) {
      return NextResponse.json({ success: false, error: 'Room ID and passkey are required.' }, { status: 400 });
    }

    const sanitizedRoomId = sanitizeId(roomId);

    if (!rooms[sanitizedRoomId] || rooms[sanitizedRoomId].passkey !== passkey) {
      return NextResponse.json({ success: false, error: 'Authentication failed. Invalid room or passkey.' }, { status: 403 });
    }

    const clearMessage: Message = {
      user: 'System',
      text: `Chat history cleared.`,
      timestamp: Date.now(),
      id: crypto.randomUUID()
    };
    rooms[sanitizedRoomId].messages = [clearMessage];
    saveRooms();

    return NextResponse.json({ success: true, message: clearMessage });
  } catch (error) {
    console.error('[API/CLEAR] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
