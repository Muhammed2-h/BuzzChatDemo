"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function HomePage() {
  const [roomId, setRoomId] = useState('');
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        const data = await res.json();
        if (data.success) {
          setActiveRooms(data.rooms);
        }
      } catch (err) {
        console.error('Failed to fetch rooms', err);
      }
    };
    fetchRooms();
  }, []);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      router.push(`/${roomId.trim().replace(/\s+/g, '-')}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Buzz Chat</CardTitle>
          <CardDescription>
            Create or join a room. The first person to join sets the passkey.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleJoinRoom}>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="room-id">Room ID</Label>
              <Input
                id="room-id"
                placeholder="e.g., my-secret-room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
                className="text-base"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full">
              Go to Room
            </Button>

            <div className="w-full border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Active Rooms</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {activeRooms.length > 0 ? (
                  activeRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => router.push(`/${room.id}`)}
                      className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-sm transition-colors text-left group"
                    >
                      <span className="font-medium group-hover:text-primary transition-colors">{room.id}</span>
                      <span className="text-xs text-muted-foreground bg-muted-foreground/10 px-2 py-0.5 rounded-full">
                        {room.userCount} users
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">No active rooms found.</p>
                )}
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
