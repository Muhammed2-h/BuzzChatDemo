import { NextResponse } from 'next/server';
import { rooms } from '@/lib/rooms';

export async function POST(request: Request) {
    try {
        const { roomId, passkey, message, action } = await request.json();

        if (!roomId || !passkey || !action) {
            return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
        }

        const room = rooms[roomId];

        if (!room || room.passkey !== passkey) {
            return NextResponse.json({ success: false, error: 'Authentication failed.' }, { status: 403 });
        }

        if (action === 'pin') {
            if (!message) {
                return NextResponse.json({ success: false, error: 'Message required to pin.' }, { status: 400 });
            }
            room.pinnedMessage = message;
            // Notify via system message
            room.messages.push({
                user: 'System',
                text: `A message has been pinned.`,
                timestamp: Date.now()
            });
        } else if (action === 'unpin') {
            room.pinnedMessage = null;
            room.messages.push({
                user: 'System',
                text: `Message unpinned.`,
                timestamp: Date.now()
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API/PIN] Error:', error);
        return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
    }
}
