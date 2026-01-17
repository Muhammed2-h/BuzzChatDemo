import { NextResponse } from 'next/server';
import { rooms } from '@/lib/rooms';

export async function POST(request: Request) {
  try {
    const { roomId, passkey } = await request.json();

    if (!roomId || !passkey) {
      return NextResponse.json({ success: false, error: 'Room ID and passkey are required.' }, { status: 400 });
    }

    // Sanitize roomId to prevent potential issues
    const sanitizedRoomId = roomId.replace(/[^a-zA-Z0-9-]/g, '');
    if(!sanitizedRoomId) {
        return NextResponse.json({ success: false, error: 'Invalid Room ID format.' }, { status: 400 });
    }

    if (!rooms[sanitizedRoomId]) {
      // Room doesn't exist, this user becomes the creator and sets the passkey.
      rooms[sanitizedRoomId] = {
        passkey: passkey,
        messages: [{
            user: 'System',
            text: `Room '${sanitizedRoomId}' created.`,
            timestamp: Date.now()
        }],
      };
      return NextResponse.json({ success: true });
    } else {
      // Room exists, validate the provided passkey.
      if (rooms[sanitizedRoomId].passkey === passkey) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ success: false, error: 'Invalid passkey.' }, { status: 403 });
      }
    }
  } catch (error) {
    console.error('[API/JOIN] Error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
