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

  // Room list polling removed for privacy

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

            {/* Active Rooms list removed for privacy */}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
