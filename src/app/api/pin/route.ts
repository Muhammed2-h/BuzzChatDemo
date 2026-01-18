import { NextResponse } from 'next/server';
import { rooms } from '@/lib/rooms';

export async function POST(request: Request) {
    try {
        const { roomId, passkey, message, action, username } = await request.json();

        if (!roomId || !passkey || !action || !username) {
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

            // Always set the pinned message to what is requested
            room.pinnedMessage = message;

            // Initialize pinnedBy array if logic suggests it is a new pin or empty
            if (!room.pinnedBy) {
                room.pinnedBy = [];
            }

            // Logic:
            // 1. If user ALREADY pinned this exact message? -> UNPIN (Toggle off)
            // 2. If user NOT in pinnedBy list? -> ADD to list.

            // Wait, but if the message content is DIFFERENT, we should probably reset/overwrite?
            // The prompt says: "if a user clicks pinned message button again if that message already pinned by thae same user then it's gets unpin"
            // AND "if another user clicks the same pinned message that alreasy pinned by other user then the pinned message section add 2 users name who pinned the message"

            // So we need to check if the currently pinned message is the SAME as the one being clicked.
            const isSameMessage = room.pinnedMessage && room.pinnedMessage.timestamp === message.timestamp && room.pinnedMessage.text === message.text;

            if (isSameMessage) {
                if (room.pinnedBy.includes(username)) {
                    // User is toggling OFF their pin
                    room.pinnedBy = room.pinnedBy.filter(u => u !== username);

                    room.messages.push({
                        user: 'System',
                        text: `${username} removed their pin.`,
                        timestamp: Date.now()
                    });

                    // If NO ONE is pinning it anymore, clear the message entirely
                    if (room.pinnedBy.length === 0) {
                        room.pinnedMessage = null;
                        room.messages.push({
                            user: 'System',
                            text: `Message unpinned (no more pinners).`,
                            timestamp: Date.now()
                        });
                    }
                } else {
                    // User is adding their pin to the SAME message
                    room.pinnedBy.push(username);
                    room.messages.push({
                        user: 'System',
                        text: `${username} also pinned the message.`,
                        timestamp: Date.now()
                    });
                }
            } else {
                // It is a DIFFERENT message. 
                // In generic chat apps, usually pinning a NEW message replaces the old one entirely.
                // Or works as a list. But our database only supports ONE pinnedMessage object.
                // Let's assume pinning a NEW message overwrites the old one and starts fresh with this user.
                room.pinnedMessage = message;
                room.pinnedBy = [username];
                room.messages.push({
                    user: 'System',
                    text: `${username} pinned a new message.`,
                    timestamp: Date.now()
                });
            }

        } else if (action === 'unpin') {
            // Explicit unpin action (e.g. from the Banner X button)
            // Logic: Remove this user from the pinnedBy list.
            if (!room.pinnedBy || !room.pinnedBy.includes(username)) {
                return NextResponse.json({ success: false, error: 'You have not pinned this message.' }, { status: 403 });
            }

            room.pinnedBy = room.pinnedBy.filter(u => u !== username);

            room.messages.push({
                user: 'System',
                text: `${username} unpinned the message.`,
                timestamp: Date.now()
            });

            if (room.pinnedBy.length === 0) {
                room.pinnedMessage = null;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API/PIN] Error:', error);
        return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
    }
}
