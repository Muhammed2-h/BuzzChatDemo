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
import { Bell, BellOff, Users, X, Reply, Pin } from 'lucide-react';
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
  const [showUserList, setShowUserList] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);

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
        body: JSON.stringify({
          roomId,
          passkey,
          user: username,
          text: currentMessage,
          replyTo: replyTo ? { user: replyTo.user, text: replyTo.text } : undefined
        }),
      });
      setCurrentMessage('');
      setReplyTo(null);
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

  const handlePin = async (msg: Message) => {
    try {
      await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey, message: msg, action: 'pin', username }),
      });
    } catch (err) {
      console.error('Failed to pin message:', err);
    }
  };

  const handleUnpin = async () => {
    try {
      await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey, action: 'unpin', username }),
      });
    } catch (err) {
      console.error('Failed to unpin message:', err);
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
          setPinnedMessage(data.pinnedMessage || null);
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
      <header className="p-4 border-b shrink-0 flex justify-between items-start bg-background/95 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold font-headline">Room: {roomId}</h1>
          <p className="text-sm text-muted-foreground">Welcome, {username}!</p>

          <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted p-1 rounded-md inline-block">Passkey: {passkey}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setIsSoundEnabled(!isSoundEnabled)} className="h-9 w-9">
            {isSoundEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            <span className="sr-only">Toggle sound</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowUserList(!showUserList)} className="h-9 w-9 relative">
            <Users className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
              {onlineUsers.length}
            </span>
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

      {/* Pinned Message Banner */}
      {pinnedMessage && (
        <div className="flex items-center justify-between bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <Pin className="h-4 w-4 text-yellow-600 shrink-0 fill-yellow-600" />
            <div className="flex flex-col truncate">
              <span className="font-bold text-yellow-700 text-xs">Pinned by {pinnedMessage.user}</span>
              <span className="truncate text-foreground/80">{pinnedMessage.text}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-500/20" onClick={handleUnpin}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-6">
            {messages.map((msg, index) => {
              if (msg.user === 'System') {
                return (
                  <div key={index} className="flex justify-center my-2">
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              return (
                <div key={index} className="flex items-start gap-4 group">
                  <Avatar className="w-10 h-10 border shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">{msg.user.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold truncate">{msg.user}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setReplyTo(msg)}
                        title="Reply"
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handlePin(msg)}
                        title="Pin Message"
                      >
                        <Pin className="h-3 w-3" />
                      </Button>
                    </div>
                    {(msg as any).replyTo && (
                      <div className="text-xs text-muted-foreground border-l-2 pl-2 mb-1 opacity-80">
                        <span className="font-semibold">@{(msg as any).replyTo.user}: </span>
                        {(msg as any).replyTo.text.substring(0, 50)}{(msg as any).replyTo.text.length > 50 ? '...' : ''}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-10">No messages yet. Say hello!</div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Active User Sidebar */}
        {showUserList && (
          <div className="w-72 border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 overflow-y-auto absolute inset-y-0 right-0 z-20 shadow-xl transition-all duration-300 ease-in-out flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <div>
                <h2 className="font-bold text-lg">Active Users</h2>
                <p className="text-xs text-muted-foreground">{onlineUsers.length} online</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => setShowUserList(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ul className="space-y-3 flex-1">
              {onlineUsers.map((u) => (
                <li key={u} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                  <div className="relative">
                    <Avatar className="h-8 w-8 border bg-muted">
                      <AvatarFallback className="text-xs font-bold">{u.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background"></span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${u === username ? "text-primary" : ""}`}>
                      {u} {u === username && "(You)"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Online</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-4 border-t text-center text-xs text-muted-foreground">
              <p>Passkey: <span className="font-mono bg-muted px-1 rounded">{passkey}</span></p>
            </div>
          </div>
        )}
      </main>

      <footer className="p-4 border-t shrink-0 bg-background">
        {replyTo && (
          <div className="flex items-center justify-between bg-muted/50 p-2 rounded-t-md text-sm border-x border-t mx-1">
            <div className="flex items-center gap-2 truncate">
              <Reply className="h-4 w-4" />
              <span className="font-semibold">Replying to {replyTo.user}:</span>
              <span className="text-muted-foreground truncate max-w-[200px]">{replyTo.text}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
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
