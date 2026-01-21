import { NextResponse } from 'next/server';
import { rooms, saveRooms, sanitizeId, addMessage } from '@/lib/rooms';

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

        // Check Admin Status
        const requester = room.users.find(u => u.username === adminUser);
        const isAdmin = requester?.isAdmin || room.creator === adminUser;

        if (action === 'kick') {
            if (!isAdmin) {
                return NextResponse.json({ success: false, error: 'Only admins can kick users.' }, { status: 403 });
            }

            const targetObj = room.users[targetIndex];
            if ((targetObj && targetObj.isAdmin) || targetUser === room.creator) {
                return NextResponse.json({ success: false, error: 'Cannot kick another Admin/Owner.' }, { status: 403 });
            }
            if (targetIndex !== -1) {
                // Ban the user
                if (!room.bannedUsers) room.bannedUsers = [];
                if (!room.bannedUsers.includes(targetUser)) {
                    room.bannedUsers.push(targetUser);
                }

                room.users.splice(targetIndex, 1);
                addMessage(room, {
                    user: 'System',
                    text: `${adminUser} kicked (and banned) ${targetUser}.`,
                    timestamp: Date.now(),
                    id: crypto.randomUUID()
                });
            }
        } else if (action === 'deleteRoom') {
            if (!isAdmin) {
                return NextResponse.json({ success: false, error: 'Only admins can delete the room.' }, { status: 403 });
            }
            // Scheduled delete: Notify users, lock entry, actual delete in 60s
            room.deletionScheduledAt = Date.now() + 60000;
            room.users = []; // KICK EVERYONE IMMEDIATELY
            // Note: We can't really "notify" them via addMessage if we kick them,
            // because api/poll checks strictly for user presence now.
            // BUT api/poll returns 401 if user not found. Frontend handles 401.
            // So they get "User not active" or similar.
            // If we want a nicer "Room Deleted" message, we should probably Keep them ??
            // User said: "users also gets removed ... room stays ... for 60s".
            // If I remove them, they can't see the "Closing in 60s" message.
            // But they get "Exits".
            // I'll stick to removing them.

            saveRooms();

            // Hard delete after 60 seconds
            setTimeout(() => {
                const id = sanitizeId(roomId);
                if (rooms[id]) {
                    delete rooms[id];
                    saveRooms();
                    console.log(`Room ${id} deleted per schedule.`);
                }
            }, 60000);

            return NextResponse.json({ success: true, message: 'Room deletion scheduled in 1 minute.' });
        }

        saveRooms();
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API/ADMIN] Error:', error);
        return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
    }
}
