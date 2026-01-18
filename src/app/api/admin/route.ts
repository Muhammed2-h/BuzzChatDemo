import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId } from '@/lib/rooms';

export async function POST(request: Request) {
    try {
        const { roomId, passkey, adminUser, targetUser, action } = await request.json();

        if (!roomId || !passkey || !adminUser || !targetUser || !action) {
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
            if (targetIndex !== -1) {
                room.users.splice(targetIndex, 1);
                room.messages.push({
                    user: 'System',
                    text: `${adminUser} kicked ${targetUser}.`,
                    timestamp: Date.now(),
                    id: crypto.randomUUID()
                });
            }
        } else if (action === 'ban') {
            if (targetIndex !== -1) {
                room.users.splice(targetIndex, 1);
            }

            if (!room.bannedUsers) room.bannedUsers = [];
            if (!room.bannedUsers.includes(targetUser)) {
                room.bannedUsers.push(targetUser);
            }

            room.messages.push({
                user: 'System',
                text: `${adminUser} banned ${targetUser}.`,
                timestamp: Date.now(),
                id: crypto.randomUUID()
            });
        }

        saveRooms();
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API/ADMIN] Error:', error);
        return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
    }
}
