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

    const room = rooms[roomId];

    if (!room || room.passkey !== passkey) {
      return NextResponse.json({ success: false, error: 'Authentication failed. Invalid room or passkey.' }, { status: 403 });
    }

    // Update user's lastSeen timestamp
    const sendingUser = room.users.find(u => u.username === user);
    if (sendingUser) {
        sendingUser.lastSeen = Date.now();
    }

    const message: Message = {
      user,
      text,
      timestamp: Date.now(),
    };

    room.messages.push(message);

    // To prevent memory leaks on a long-running server, cap messages per room.
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('[API/SEND] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
