import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId } from '@/lib/rooms';

export async function POST(request: Request) {
    try {
        const { roomId, passkey, adminUser, targetUser, action } = await request.json();

        if (!roomId || !passkey || !adminUser || !action) {
            return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
        }

        const room = rooms[sanitizeId(roomId)];

        if (!room || room.passkey !== passkey) {
            return NextResponse.json({ success: false, error: 'Authentication failed.' }, { status: 403 });
        }

        // Simplistic Admin Auth: Use the same passkey logic. 
        // In a real app, 'adminUser' would need better proof. 
        // For now, anyone with the passkey is effectively an admin peer.

        // Find if target exists
        const targetIndex = room.users.findIndex(u => u.username === targetUser);

        if (action === 'kick') {
            if (adminUser !== room.creator) {
                return NextResponse.json({ success: false, error: 'Only the room creator can kick users.' }, { status: 403 });
            }

            if (targetUser === room.creator) {
                return NextResponse.json({ success: false, error: 'Cannot kick the room owner.' }, { status: 403 });
            }
            if (targetIndex !== -1) {
                // Ban the user
                if (!room.bannedUsers) room.bannedUsers = [];
                if (!room.bannedUsers.includes(targetUser)) {
                    room.bannedUsers.push(targetUser);
                }

                room.users.splice(targetIndex, 1);
                room.messages.push({
                    user: 'System',
                    text: `${adminUser} kicked (and banned) ${targetUser}.`,
                    timestamp: Date.now(),
                    id: crypto.randomUUID()
                });
            }
        } else if (action === 'deleteRoom') {
            if (room.creator !== adminUser) {
                return NextResponse.json({ success: false, error: 'Only the room creator can delete the room.' }, { status: 403 });
            }
            // Soft delete: Mark as deleted so other users polling get a 410 Gone.
            room.isDeleted = true;
            room.users = []; // Remove all users immediately
            saveRooms();

            // Hard delete after 30 seconds to allow time for polls to catch the 410
            setTimeout(() => {
                const id = sanitizeId(roomId);
                if (rooms[id] && rooms[id].isDeleted) {
                    delete rooms[id];
                    saveRooms();
                }
            }, 30000);

            return NextResponse.json({ success: true, message: 'Room deleted.' });
        }

        saveRooms();
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API/ADMIN] Error:', error);
        return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
    }
}
