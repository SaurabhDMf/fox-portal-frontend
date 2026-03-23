import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Send, Plus, MessageSquare } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export default function Chat() {
  const user = useAuthStore(s => s.user);
  const accessToken = useAuthStore(s => s.accessToken);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [realtimeMessages, setRealtimeMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: rooms = [] } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => api.get('/chat/rooms').then(r => r.data?.rooms || r.data || []),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', activeRoom],
    queryFn: () => activeRoom ? api.get(`/chat/rooms/${activeRoom}/messages`).then(r => r.data?.messages || r.data || []) : Promise.resolve([]),
    enabled: !!activeRoom,
  });

  useEffect(() => {
    if (!activeRoom || !accessToken) return;
    socket = io('https://ubp-backend-production.up.railway.app', { auth: { token: accessToken } });
    socket.emit('join_room', activeRoom);
    socket.on('new_message', (msg) => setRealtimeMessages(prev => [...prev, msg]));
    return () => { socket?.disconnect(); setRealtimeMessages([]); };
  }, [activeRoom, accessToken]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, realtimeMessages]);

  const sendMut = useMutation({
    mutationFn: (content: string) => api.post(`/chat/rooms/${activeRoom}/messages`, { content, type: 'text' }),
    onSuccess: () => { setMessage(''); qc.invalidateQueries({ queryKey: ['chat-messages', activeRoom] }); },
  });

  const allMessages = [...(Array.isArray(messages) ? messages : []), ...realtimeMessages];
  const roomsArr = Array.isArray(rooms) ? rooms : [];

  return (
    <div className="page-container !p-0 h-[calc(100vh-0px)] md:h-screen flex">
      {/* Room list */}
      <div className={`w-full md:w-72 border-r border-border bg-card flex flex-col flex-shrink-0 ${activeRoom ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Chats</h2>
          <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {roomsArr.map((room: any) => (
            <button
              key={room.id}
              onClick={() => setActiveRoom(room.id)}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors ${activeRoom === room.id ? 'bg-secondary' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                {room.name?.[0] || '#'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{room.name}</div>
                <div className="text-xs text-muted-foreground truncate">{room.last_message || 'No messages'}</div>
              </div>
              {room.unread_count > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center flex-shrink-0">{room.unread_count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div className={`flex-1 flex flex-col ${!activeRoom ? 'hidden md:flex' : 'flex'}`}>
        {activeRoom ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <button onClick={() => setActiveRoom(null)} className="md:hidden p-1 rounded-md hover:bg-secondary text-muted-foreground">←</button>
              <h3 className="font-semibold text-sm">{roomsArr.find((r: any) => r.id === activeRoom)?.name || 'Chat'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {allMessages.map((msg: any, i: number) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div key={msg.id || i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-xl px-3 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                      {!isOwn && <div className="text-xs font-medium mb-0.5 text-muted-foreground">{msg.sender_name}</div>}
                      <p className="text-sm">{msg.content}</p>
                      <div className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && message.trim() && sendMut.mutate(message)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={() => message.trim() && sendMut.mutate(message)}
                  disabled={!message.trim()}
                  className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
