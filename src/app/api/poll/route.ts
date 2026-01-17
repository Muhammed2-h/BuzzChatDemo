import { NextResponse } from 'next/server';
import { rooms } from '@/lib/rooms';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const passkey = searchParams.get('passkey');
    const since = searchParams.get('since');

    if (!roomId || !passkey) {
      return NextResponse.json({ success: false, error: 'Room ID and passkey are required.' }, { status: 400 });
    }

    if (!rooms[roomId] || rooms[roomId].passkey !== passkey) {
      return NextResponse.json({ success: false, error: 'Authentication failed. Invalid room or passkey.' }, { status: 403 });
    }

    const sinceTimestamp = since ? parseInt(since, 10) : 0;
    if (isNaN(sinceTimestamp)) {
        return NextResponse.json({ success: false, error: 'Invalid "since" timestamp.' }, { status: 400 });
    }

    const newMessages = rooms[roomId].messages.filter(
      (msg) => msg.timestamp > sinceTimestamp
    );

    return NextResponse.json({ success: true, messages: newMessages });
  } catch (error) {
    console.error('[API/POLL] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
