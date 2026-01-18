import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId } from '@/lib/rooms';

export async function POST(request: Request) {
    try {
        const { roomId, passkey, username, messageId } = await request.json();

        if (!roomId || !passkey || !username || !messageId) {
            return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
        }

        const room = rooms[sanitizeId(roomId)];

        if (!room || room.passkey !== passkey) {
            return NextResponse.json({ success: false, error: 'Authentication failed.' }, { status: 403 });
        }

        // Find the message
        const messageIndex = room.messages.findIndex(m => m.id === messageId);

        if (messageIndex === -1) {
            return NextResponse.json({ success: false, error: 'Message not found.' }, { status: 404 });
        }

        const message = room.messages[messageIndex];

        // Only the room creator can delete announcements
        if (message.isAnnouncement && room.creator !== username) {
            return NextResponse.json({ success: false, error: 'Only the room owner can delete announcements.' }, { status: 403 });
        }

        // Remove the message
        room.messages.splice(messageIndex, 1);

        saveRooms();
        console.log('[API/DELETE-MESSAGE] Message deleted successfully by', username);
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API/DELETE-MESSAGE] Error:', error);
        return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
    }
}
