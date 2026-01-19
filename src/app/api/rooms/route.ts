import { NextResponse } from 'next/server';
import { rooms } from '@/lib/rooms';

export async function GET() {
    try {
        const activeRooms = Object.values(rooms).map(room => {
            // Find the key (roomId) for this room object
            const roomId = Object.keys(rooms).find(key => rooms[key] === room);

            return {
                id: roomId || 'Unknown',
                userCount: room.users.length,
                hasPin: !!room.passkey
            };
        }).filter(room => room.id !== 'Unknown');

        return NextResponse.json({ success: true, rooms: activeRooms });
    } catch (error) {
        console.error('[API/ROOMS] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch rooms' }, { status: 500 });
    }
}
