import { NextResponse } from 'next/server';
import { rooms } from '@/lib/rooms';

export async function POST(request: Request) {
  try {
    const { roomId, passkey } = await request.json();

    if (!roomId || !passkey) {
      return NextResponse.json({ success: false, error: 'Room ID and passkey are required.' }, { status: 400 });
    }

    if (!rooms[roomId] || rooms[roomId].passkey !== passkey) {
      return NextResponse.json({ success: false, error: 'Authentication failed. Invalid room or passkey.' }, { status: 403 });
    }

    const clearMessage = {
        user: 'System',
        text: `Chat history cleared.`,
        timestamp: Date.now()
    };
    rooms[roomId].messages = [clearMessage];

    return NextResponse.json({ success: true, message: clearMessage });
  } catch (error) {
    console.error('[API/CLEAR] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
