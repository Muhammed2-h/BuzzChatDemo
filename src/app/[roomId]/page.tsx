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
import { Bell, BellOff, Users, X, Reply, Pin, Trash2, ArrowLeft, MoreVertical, LogOut, Eraser, Edit2, Megaphone, Check, CheckCheck, BarChart3 } from 'lucide-react';
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
  const [pinnedBy, setPinnedBy] = useState<string[]>([]);

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [creator, setCreator] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTimestamp = useRef<number>(0);
  const isDeleting = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const playNotificationSound = (frequency: number = 440) => {
    if (!isSoundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
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
      if (editingMessage) {
        console.log('[EDIT] Sending edit request for message:', editingMessage.id, 'New text:', currentMessage);
        // Edit existing message
        const res = await fetch('/api/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            passkey,
            username,
            messageId: editingMessage.id,
            newText: currentMessage,
          }),
        });
        const data = await res.json();
        console.log('[EDIT] Response:', data);
        if (!res.ok || !data.success) {
          console.error('Edit failed:', data.error);
          alert('Failed to edit message: ' + (data.error || 'Unknown error'));
          return;
        }
        console.log('[EDIT] Edit successful, clearing edit mode');
        setEditingMessage(null);
      } else {
        // Send new message
        await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            passkey,
            user: username,
            text: currentMessage,
            replyTo: replyTo ? { user: replyTo.user, text: replyTo.text, id: replyTo.id } : undefined,
            isAnnouncement: isAnnouncementMode,
          }),
        });
      }
      setCurrentMessage('');
      setReplyTo(null);
      setIsAnnouncementMode(false);
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

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleBeforeUnload = () => {
      // Send a beacon to notify the server we are leaving
      // keepalive: true ensures the request completes even after the tab closes
      fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey, username }),
        keepalive: true,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated, roomId, passkey, username]);

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

  const handleKick = async (targetUser: string) => {
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey, adminUser: username, targetUser, action: 'kick' }),
      });
    } catch (err) {
      console.error('Failed to kick user:', err);
    }
  };

  const handleDeleteRoom = async () => {
    if (!confirm('Are you sure you want to PERMANENTLY DELETE this room? All data will be lost forever.')) return;
    isDeleting.current = true;
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey, adminUser: username, action: 'deleteRoom' }),
      });
      // The room is deleted. The polling loop will catch the error/401 soon, 
      // or we can force redirect immediately.
      router.push('/');
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentMessage(value);

    // Detect @ mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentionDropdown(true);
      setMentionFilter('');
    } else if (lastAtIndex !== -1) {
      const afterAt = value.substring(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setShowMentionDropdown(true);
        setMentionFilter(afterAt);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleMentionSelect = (user: string) => {
    const lastAtIndex = currentMessage.lastIndexOf('@');
    const beforeAt = currentMessage.substring(0, lastAtIndex);
    setCurrentMessage(beforeAt + '@' + user + ' ');
    setShowMentionDropdown(false);
  };

  const handleEditMessage = (msg: Message) => {
    console.log('[EDIT] Starting edit for message:', msg.id, 'Text:', msg.text);
    setEditingMessage(msg);
    setCurrentMessage(msg.text);
    setReplyTo(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setCurrentMessage('');
  };

  const handleDeleteAnnouncement = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const res = await fetch('/api/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, passkey, username, messageId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert('Failed to delete announcement: ' + (data.error || 'Unknown error'));
      } else {
        // Immediately remove from local state for instant UI update
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const pollMessages = async () => {
      try {
        const isTyping = currentMessage.length > 0;
        const res = await fetch(`/api/poll?roomId=${roomId}&passkey=${passkey}&since=${lastMessageTimestamp.current}&username=${encodeURIComponent(username)}&isTyping=${isTyping}`);

        if (!isActive) return;

        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            // Stop if we are intentionally deleting the room
            if (isDeleting.current) return;

            // 403: Room missing (restart)
            // 401: User missing (restart/persistence lag)
            // Attempt to auto-rejoin in both cases.
            console.log(`Polling failed (${res.status}). Attempting to auto-rejoin...`);
            try {
              const joinRes = await fetch('/api/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, passkey, username }),
              });

              if (joinRes.ok) {
                console.log("Auto-rejoin successful! Resuming poll.");
                // Don't logout. Just retry polling in next cycle.
                timeoutId = setTimeout(pollMessages, 2000);
                return;
              }
            } catch (rejoinErr) {
              console.error("Auto-rejoin failed:", rejoinErr);
            }
          }

          const errData = await res.json().catch(() => ({}));
          setIsAuthenticated(false);
          setError(errData.error || 'Connection lost. Please re-join.');
          return; // Stop polling
        }

        const data = await res.json();
        if (data.success) {
          const receivedMessages: Message[] = data.messages;
          if (receivedMessages.length > 0) {
            const hasNewMessageFromOthers = receivedMessages.some(msg => msg.user !== username && msg.user !== 'System');
            const hasMention = receivedMessages.some(msg => msg.mentions?.includes(username));

            if (hasMention) {
              // Play distinct sound for mentions (higher pitch)
              playNotificationSound(880); // A5 note
            } else if (hasNewMessageFromOthers) {
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
          if (data.typingUsers) {
            setTypingUsers(data.typingUsers);
          }
          if (data.typingUsers) {
            setTypingUsers(data.typingUsers);
          }
          setPinnedMessage(data.pinnedMessage || null);
          setPinnedBy(data.pinnedBy || []);
          setCreator(data.creator || null);
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
  }, [isAuthenticated, roomId, passkey, username, currentMessage]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => router.push('/')}
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              Join Room: {roomId}
            </CardTitle>
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
    <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden fixed inset-0">
      <header className="p-3 sm:px-6 sm:py-4 border-b shrink-0 flex justify-between items-center bg-background/95 backdrop-blur-md z-10 shadow-sm">
        <div className="min-w-0 flex-1 pr-2">
          <h1 className="text-lg sm:text-2xl font-bold font-headline truncate tracking-tight text-primary">Room: {roomId}</h1>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate max-w-[100px] sm:max-w-none">{username}</span>
            </div>
            <span className="text-[10px] text-muted-foreground/40 border-l pl-3 hidden md:inline font-mono">ID: {passkey}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setIsSoundEnabled(!isSoundEnabled)} className="h-8 w-8 sm:h-10 sm:w-10 rounded-full hover:bg-muted" title={isSoundEnabled ? "Mute" : "Unmute"}>
            {isSoundEnabled ? <Bell className="h-4 w-4 sm:h-5 sm:w-5" /> : <BellOff className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={() => setShowUserList(!showUserList)} className="h-8 w-8 sm:h-10 sm:w-10 rounded-full hover:bg-muted relative">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-primary text-[8px] sm:text-[10px] text-primary-foreground font-bold border-2 border-background">
              {onlineUsers.length}
            </span>
          </Button>

          <div className="h-6 w-[1px] bg-border mx-1 hidden sm:block"></div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 sm:h-10 sm:w-auto sm:px-4 rounded-full sm:rounded-lg text-destructive hover:bg-destructive/10 p-0 sm:p-2">
                <Eraser className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline ml-2 text-sm font-medium">Clear</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all messages in this room. This action cannot be reversed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearChat} className={buttonVariants({ variant: "destructive" })}>Clear All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="ghost" onClick={handleDisconnect} className="h-8 w-8 sm:h-10 sm:w-auto sm:px-4 rounded-full sm:rounded-lg hover:bg-muted p-0 sm:p-2" title="Leave Room">
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline ml-2 text-sm font-medium">Leave</span>
          </Button>

          {creator === username && (
            <Button variant="destructive" onClick={handleDeleteRoom} className="h-8 w-8 sm:h-10 sm:w-auto sm:px-4 rounded-full sm:rounded-lg p-0 sm:p-2 shadow-sm" title="Delete Room Permanently">
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline ml-2 text-sm font-medium text-white">Delete</span>
            </Button>
          )}
        </div>
      </header>

      {pinnedMessage && (
        <div className="flex items-center justify-between bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <Pin className="h-4 w-4 text-green-600 shrink-0 fill-green-600" />
            <div className="flex flex-col truncate">
              <span className="font-bold text-yellow-700 text-xs">
                Pinned by {pinnedBy.length > 0 ? pinnedBy.join(', ') : '...'}
              </span>
              <span className="truncate text-foreground/80">{pinnedMessage.text}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-500/20" onClick={handleUnpin}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 p-2 sm:p-4 overflow-y-auto">
          <div className="space-y-4 sm:space-y-6">
            {messages.map((msg, index) => {
              if (msg.user === 'System') {
                return null;
              }

              // Announcement messages
              if (msg.isAnnouncement) {
                return (
                  <div key={index} id={msg.id} className="my-4">
                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-l-4 border-yellow-500 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Megaphone className="h-5 w-5 text-yellow-600" />
                        <span className="font-bold text-yellow-700">Announcement from {msg.user}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        {creator === username && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteAnnouncement(msg.id)}
                            title="Delete Announcement"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm font-medium">{msg.text}</p>
                    </div>
                  </div>
                );
              }

              // Highlight mentions
              const renderTextWithMentions = (text: string) => {
                const parts = text.split(/(@\w+)/g);
                return parts.map((part, i) => {
                  if (part.startsWith('@') && part.substring(1) === username) {
                    return <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50 px-1 rounded font-semibold">{part}</span>;
                  } else if (part.startsWith('@')) {
                    return <span key={i} className="text-primary font-semibold">{part}</span>;
                  }
                  return part;
                });
              };

              return (
                <div key={index} id={msg.id} className="flex items-start gap-2 sm:gap-4 group">
                  <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs sm:text-sm">{msg.user.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold truncate">{msg.user}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                        {msg.editedAt && <span className="ml-1 text-[10px]">(edited)</span>}
                      </span>
                      {pinnedMessage && pinnedMessage.timestamp === msg.timestamp && (
                        <Pin className="h-3 w-3 fill-green-500 text-green-500 ml-1" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setReplyTo(msg)}
                        title="Reply"
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                      {msg.user === username && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleEditMessage(msg)}
                          title="Edit"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handlePin(msg)}
                        title="Pin Message"
                      >
                        <Pin className={`h-3 w-3 ${pinnedMessage?.timestamp === msg.timestamp ? 'fill-green-500 text-green-500' : ''}`} />
                      </Button>
                    </div>
                    {(msg as any).replyTo && (
                      <div
                        className="text-xs text-muted-foreground border-l-2 pl-2 mb-1 opacity-80 cursor-pointer hover:bg-muted/50 rounded-r transition-colors"
                        onClick={() => {
                          const element = document.getElementById((msg as any).replyTo.id);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            element.classList.add('bg-muted/50');
                            setTimeout(() => element.classList.remove('bg-muted/50'), 2000);
                          }
                        }}
                      >
                        <span className="font-semibold">@{(msg as any).replyTo.user}: </span>
                        {(msg as any).replyTo.text.substring(0, 50)}{(msg as any).replyTo.text.length > 50 ? '...' : ''}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed break-words">{renderTextWithMentions(msg.text)}</p>
                    {msg.user === username && (
                      <div className="flex items-center gap-1 mt-1">
                        {!msg.readBy || msg.readBy.length === 0 ? (
                          <Check className="h-3 w-3 text-muted-foreground" />
                        ) : msg.readBy.length === 1 ? (
                          <Check className="h-3 w-3 text-blue-500" />
                        ) : (
                          <CheckCheck className="h-3 w-3 text-blue-500" />
                        )}
                      </div>
                    )}
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
          <div className="w-full sm:w-72 border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 overflow-y-auto absolute inset-y-0 right-0 z-20 shadow-xl transition-all duration-300 ease-in-out flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
              <div className="flex gap-1">
                <Button
                  variant={!showStats && !showLogs ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { setShowStats(false); setShowLogs(false); }}
                  className="h-8 text-xs"
                >
                  <Users className="h-4 w-4 mr-1" />
                  Users
                </Button>
                <Button
                  variant={showStats ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { setShowStats(true); setShowLogs(false); }}
                  className="h-8 text-xs"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Stats
                </Button>
                <Button
                  variant={showLogs ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { setShowStats(false); setShowLogs(true); }}
                  className="h-8 text-xs"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Logs
                </Button>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => setShowUserList(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!showStats && !showLogs ? (
              <>
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
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          {creator === u ? <span className="text-yellow-600 font-semibold">👑 Owner</span> : 'Online'}
                        </span>
                      </div>
                      {u !== username && u !== creator && (
                        <Button variant="ghost" size="icon" className="ml-auto h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleKick(u)} title="Kick User">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-4 border-t text-center text-xs text-muted-foreground">
                  <p>Passkey: <span className="font-mono bg-muted px-1 rounded">{passkey}</span></p>
                </div>
              </>
            ) : showStats ? (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Room Statistics
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Messages:</span>
                      <span className="font-semibold">{messages.filter(m => m.user !== 'System').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Users:</span>
                      <span className="font-semibold">{onlineUsers.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room Age:</span>
                      <span className="font-semibold">
                        {messages.length > 0
                          ? Math.floor((Date.now() - messages[0].timestamp) / 1000 / 60) + ' min'
                          : 'New'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Most Active:</span>
                      <span className="font-semibold">
                        {messages.filter(m => m.user !== 'System').length > 0
                          ? Object.entries(
                            messages.reduce((acc: Record<string, number>, msg) => {
                              if (msg.user !== 'System') {
                                acc[msg.user] = (acc[msg.user] || 0) + 1;
                              }
                              return acc;
                            }, {})
                          ).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : showLogs ? (
              <div className="flex-1 overflow-y-auto space-y-2">
                <div className="space-y-2">
                  {messages
                    .filter(msg => msg.user === 'System')
                    .map((msg, index) => (
                      <div key={index} className="bg-muted/30 p-3 rounded-lg border border-muted">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-muted-foreground flex-1">{msg.text}</p>
                          <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  {messages.filter(msg => msg.user === 'System').length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-10">
                      No system logs yet
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      <footer className="p-2 sm:p-4 border-t shrink-0 bg-background">
        {editingMessage && (
          <div className="flex items-center justify-between bg-blue-500/10 p-2 rounded-t-md text-sm border-x border-t mx-1 border-blue-500/20">
            <div className="flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-blue-600">Editing message</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
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
        <form onSubmit={handleSend} className="flex gap-2 relative">
          {typingUsers.length > 0 && (
            <div className="absolute -top-6 left-0 text-xs text-muted-foreground animate-pulse">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          {showMentionDropdown && (
            <div className="absolute bottom-full left-0 mb-2 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto w-48 z-50">
              {onlineUsers
                .filter(u => u.toLowerCase().includes(mentionFilter.toLowerCase()) && u !== username)
                .map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleMentionSelect(u)}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                  >
                    <span className="font-medium">@{u}</span>
                  </button>
                ))}
            </div>
          )}
          {creator === username && (
            <Button
              type="button"
              variant={isAnnouncementMode ? "default" : "ghost"}
              size="icon"
              onClick={() => setIsAnnouncementMode(!isAnnouncementMode)}
              className="shrink-0"
              title="Announcement Mode"
            >
              <Megaphone className="h-4 w-4" />
            </Button>
          )}
          <Input
            placeholder={editingMessage ? "Edit your message..." : isAnnouncementMode ? "📢 Announcement..." : "Type a message..."}
            value={currentMessage}
            onChange={handleMessageInputChange}
            disabled={!isAuthenticated || isSending}
            autoComplete="off"
            maxLength={1000}
          />
          <Button type="submit" disabled={!isAuthenticated || !currentMessage.trim() || isSending}>
            {isSending ? 'Sending...' : editingMessage ? 'Save' : 'Send'}
          </Button>
        </form>
      </footer>
    </div>
  );
}
