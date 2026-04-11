import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { X, Pin } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  roomId: string;
  onClose: () => void;
}

export default function ChatPinnedPanel({ roomId, onClose }: Props) {
  const qc = useQueryClient();

  const { data: pinned = [] } = useQuery({
    queryKey: ['chat-pinned', roomId],
    queryFn: () => api.get(`/chat/rooms/${roomId}/pinned`).then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || [];
    }),
  });

  const unpinMut = useMutation({
    mutationFn: (id: string) => api.delete(`/chat/messages/${id}/pin`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-pinned', roomId] });
      qc.invalidateQueries({ queryKey: ['chat-messages', roomId] });
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Pin className="h-4 w-4 text-primary" /> Pinned Messages
        </h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
      </div>
      <ScrollArea className="flex-1">
        {(pinned as any[]).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Pin className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs">No pinned messages</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {(pinned as any[]).map((msg: any) => (
              <div key={msg.id} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{msg.sender_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {msg.created_at ? new Date(msg.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
                <button onClick={() => unpinMut.mutate(msg.id)}
                  className="mt-2 text-[10px] text-destructive hover:underline">Unpin</button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
