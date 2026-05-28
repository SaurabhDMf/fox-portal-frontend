import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { MessageSquare } from 'lucide-react';
import ChatRoomList from '@/components/chat/ChatRoomList';
import ChatMessageArea from '@/components/chat/ChatMessageArea';
import ChatRoomInfo from '@/components/chat/ChatRoomInfo';
import ChatPinnedPanel from '@/components/chat/ChatPinnedPanel';
import CreateGroupModal from '@/components/chat/CreateGroupModal';
import CreateDMModal from '@/components/chat/CreateDMModal';
import toast from 'react-hot-toast';

export default function Chat() {
  const qc = useQueryClient();
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateDM, setShowCreateDM] = useState(false);

  const { data: rooms = [] } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => api.get('/chat/rooms').then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || d?.rooms || [];
    }),
    refetchInterval: 15000,
  });

  const activeRoomData = (rooms as any[]).find((r: any) => r.id === activeRoom);
  const activeRoomName = activeRoomData?.type === '1-to-1'
    ? (activeRoomData.dm_other_user_name ?? 'Direct Message')
    : (activeRoomData?.name ?? 'Chat');

  return (
    <div className="!p-0 h-[calc(100vh-3.5rem)] flex overflow-hidden">
      {/* Left: Room List */}
      <div className={`w-full md:w-72 border-r border-border bg-card flex-shrink-0 ${activeRoom ? 'hidden md:block' : 'block'}`}>
        <ChatRoomList
          activeRoom={activeRoom}
          onSelectRoom={(id) => { setActiveRoom(id); setShowInfo(false); setShowPinned(false); }}
          onCreateGroup={() => setShowCreateGroup(true)}
          onCreateDM={() => setShowCreateDM(true)}
        />
      </div>

      {/* Center: Messages */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeRoom ? 'hidden md:flex' : 'flex'}`}>
        {activeRoom ? (
          <ChatMessageArea
            roomId={activeRoom}
            roomName={activeRoomName}
            memberCount={activeRoomData?.member_count}
            onBack={() => setActiveRoom(null)}
            onDeleteRoom={() => {
              api.delete(`/chat/rooms/${activeRoom}`).then(() => {
                qc.invalidateQueries({ queryKey: ['chat-rooms'] });
                setActiveRoom(null);
                toast.success('Conversation deleted');
              }).catch(() => toast.error('Failed to delete conversation'));
            }}
            onToggleInfo={() => { setShowInfo(!showInfo); setShowPinned(false); }}
            onTogglePinned={() => { setShowPinned(!showPinned); setShowInfo(false); }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs mt-1">or start a new one</p>
          </div>
        )}
      </div>

      {/* Right: Info / Pinned Panel */}
      {activeRoom && (showInfo || showPinned) && (
        <div className="hidden md:block w-80 border-l border-border bg-card flex-shrink-0">
          {showPinned ? (
            <ChatPinnedPanel roomId={activeRoom} onClose={() => setShowPinned(false)} />
          ) : (
            <ChatRoomInfo roomId={activeRoom} onClose={() => setShowInfo(false)} />
          )}
        </div>
      )}

      {/* Modals */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(id) => setActiveRoom(id)}
        />
      )}
      {showCreateDM && (
        <CreateDMModal
          onClose={() => setShowCreateDM(false)}
          onCreated={(id) => setActiveRoom(id)}
        />
      )}
    </div>
  );
}
