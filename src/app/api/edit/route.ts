import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId } from '@/lib/rooms';

export async function POST(request: Request) {
    try {
        const { roomId, passkey, username, messageId, newText } = await request.json();

        if (!roomId || !passkey || !username || !messageId || !newText) {
            return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
        }

        const room = rooms[sanitizeId(roomId)];

        if (!room || room.passkey !== passkey) {
            return NextResponse.json({ success: false, error: 'Authentication failed.' }, { status: 403 });
        }

        // Find the message
        const message = room.messages.find(m => m.id === messageId);

        if (!message) {
            return NextResponse.json({ success: false, error: 'Message not found.' }, { status: 404 });
        }

        // Only the message author can edit
        if (message.user !== username) {
            return NextResponse.json({ success: false, error: 'You can only edit your own messages.' }, { status: 403 });
        }

        // Update the message
        message.text = newText;
        message.editedAt = Date.now();

        saveRooms();
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API/EDIT] Error:', error);
        return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
    }
}
