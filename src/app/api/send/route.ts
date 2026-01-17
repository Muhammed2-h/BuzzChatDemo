import { NextResponse } from 'next/server';
import { rooms, type Message } from '@/lib/rooms';

export async function POST(request: Request) {
  try {
    const { roomId, passkey, user, text } = await request.json();

    if (!roomId || !passkey || !user || !text) {
      return NextResponse.json({ success: false, error: 'Missing required fields: roomId, passkey, user, and text.' }, { status: 400 });
    }
    
    if (text.length > 1000) {
        return NextResponse.json({ success: false, error: 'Message is too long.' }, { status: 400 });
    }

    if (!rooms[roomId] || rooms[roomId].passkey !== passkey) {
      return NextResponse.json({ success: false, error: 'Authentication failed. Invalid room or passkey.' }, { status: 403 });
    }

    const message: Message = {
      user,
      text,
      timestamp: Date.now(),
    };

    rooms[roomId].messages.push(message);

    // To prevent memory leaks on a long-running server, cap messages per room.
    if (rooms[roomId].messages.length > 100) {
      rooms[roomId].messages = rooms[roomId].messages.slice(-100);
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('[API/SEND] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
