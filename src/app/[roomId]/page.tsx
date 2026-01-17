"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bell, BellOff } from 'lucide-react';
import type { Message } from '@/lib/rooms';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [passkey, setPasskey] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTimestamp = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const playNotificationSound = () => {
    if (!isSoundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.error("Could not play sound", e);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !passkey.trim()) {
      setError('Username and passkey are required.');
      return;
    }

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey, username }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
      } else {
        setError(data.error || 'Failed to join room.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey, user: username, text: currentMessage }),
      });
      setCurrentMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey, username }),
      });
    } catch (err) {
        console.error('Failed to notify server of disconnection:', err);
    } finally {
        router.push('/');
    }
  };

  const handleClearChat = async () => {
    try {
      const res = await fetch('/api/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages([data.message]);
        lastMessageTimestamp.current = data.message.timestamp;
      }
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const pollMessages = async () => {
        try {
            const res = await fetch(`/api/poll?roomId=${roomId}&passkey=${passkey}&since=${lastMessageTimestamp.current}&username=${encodeURIComponent(username)}`);
            
            if (!isActive) return;

            if (!res.ok) {
                setIsAuthenticated(false);
                setError('Session expired or passkey became invalid. Please re-join.');
                return; // Stop polling
            }

            const data = await res.json();
            if (data.success) {
                const receivedMessages: Message[] = data.messages;
                if (receivedMessages.length > 0) {
                    const hasNewMessageFromOthers = receivedMessages.some(msg => msg.user !== username && msg.user !== 'System');
                    if (hasNewMessageFromOthers) {
                        playNotificationSound();
                    }
                    
                    setMessages(prev => {
                        const combined = [...prev, ...receivedMessages];
                        const uniqueMessages = Array.from(new Map(combined.map(m => [m.timestamp, m])).values());
                        return uniqueMessages.sort((a, b) => a.timestamp - b.timestamp);
                    });
                    
                    const sortedReceived = [...receivedMessages].sort((a, b) => a.timestamp - b.timestamp);
                    lastMessageTimestamp.current = sortedReceived[sortedReceived.length - 1].timestamp;
                }
                if (data.users) {
                    setOnlineUsers(data.users);
                }
            }
        } catch (error) {
            if (isActive) {
                console.error('Polling error:', error);
            }
        } finally {
            if (isActive) {
                timeoutId = setTimeout(pollMessages, 2000);
            }
        }
    };

    pollMessages();

    return () => {
        isActive = false;
        clearTimeout(timeoutId);
    };
}, [isAuthenticated, roomId, passkey, username]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="font-headline">Join Room: {roomId}</CardTitle>
            <CardDescription>
              Enter a username and the room's passkey. If the room is new, your passkey will set it.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleJoin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passkey">Passkey</Label>
                <Input
                  id="passkey"
                  type="password"
                  placeholder="Room's secret passkey"
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">Join Chat</Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 border-b shrink-0 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold font-headline">Room: {roomId}</h1>
          <p className="text-sm text-muted-foreground">Welcome, {username}!</p>
          <p className="text-sm text-muted-foreground mt-1">Online: {onlineUsers.join(', ')}</p>
          <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted p-1 rounded-md inline-block">Passkey: {passkey}</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsSoundEnabled(!isSoundEnabled)} className="h-9 w-9">
                {isSoundEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                <span className="sr-only">Toggle sound</span>
            </Button>
          <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Clear Chat</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently clear the chat history for this room. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearChat} className={buttonVariants({ variant: "destructive" })}>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          <Button variant="outline" onClick={handleDisconnect}>Disconnect</Button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className="flex items-start gap-4">
              <Avatar className="w-10 h-10 border">
                <AvatarFallback className="bg-secondary text-secondary-foreground">{msg.user.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">{msg.user}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
             <div className="text-center text-muted-foreground py-10">No messages yet. Say hello!</div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 border-t shrink-0 bg-background">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            disabled={!isAuthenticated || isSending}
            autoComplete="off"
            maxLength={1000}
          />
          <Button type="submit" disabled={!isAuthenticated || !currentMessage.trim() || isSending}>
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </footer>
    </div>
  );
}
