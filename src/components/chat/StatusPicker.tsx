import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import StatusDot from './StatusDot';
import api from '@/lib/api';
import { getSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/stores/authStore';

const presets = [
  { emoji: '🟢', label: 'Online', status: 'online' },
  { emoji: '🌙', label: 'Away', status: 'away' },
  { emoji: '🔴', label: 'Do Not Disturb', status: 'busy' },
  { emoji: '☕', label: 'On a Break', status: 'break' },
  { emoji: '⚫', label: 'Appear Offline', status: 'offline' },
];

const quickEmojis = ['😊', '🍕', '🏠', '🎧', '💻', '🏃', '📅', '✈️'];

interface Props {
  currentStatus?: string;
  currentStatusText?: string;
  currentStatusEmoji?: string;
  onStatusChange: (status: string, statusText: string, statusEmoji: string) => void;
  children: React.ReactNode;
}

export default function StatusPicker({ currentStatus, currentStatusText, currentStatusEmoji, onStatusChange, children }: Props) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customEmoji, setCustomEmoji] = useState('😊');
  const accessToken = useAuthStore(s => s.accessToken);

  const applyStatus = (status: string, text = '', emoji = '') => {
    onStatusChange(status, text, emoji);
    // Fire API + socket in parallel
    api.patch('/users/me/status', { status, status_text: text, status_emoji: emoji }).catch(() => {});
    if (accessToken) {
      try {
        const socket = getSocket(accessToken);
        socket.emit('set_status', { status, status_text: text, status_emoji: emoji });
      } catch {}
    }
    setOpen(false);
    setShowCustom(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        {!showCustom ? (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Set status</p>
            {presets.map(p => (
              <button
                key={p.status}
                onClick={() => applyStatus(p.status)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-secondary transition-colors ${currentStatus === p.status ? 'bg-secondary' : ''}`}
              >
                <StatusDot status={p.status} />
                <span>{p.emoji} {p.label}</span>
              </button>
            ))}
            <div className="border-t border-border my-1" />
            <button
              onClick={() => setShowCustom(true)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-secondary transition-colors"
            >
              <StatusDot status="custom" />
              <span>✏️ Custom...</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 p-1">
            <p className="text-xs font-medium text-muted-foreground">Custom status</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const idx = quickEmojis.indexOf(customEmoji);
                  setCustomEmoji(quickEmojis[(idx + 1) % quickEmojis.length]);
                }}
                className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center text-lg hover:bg-secondary/80"
              >
                {customEmoji}
              </button>
              <input
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder="What's your status?"
                className="flex-1 px-3 py-1.5 rounded-md bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && customText.trim() && applyStatus('custom', customText, customEmoji)}
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {quickEmojis.map(e => (
                <button key={e} onClick={() => setCustomEmoji(e)}
                  className={`w-7 h-7 rounded text-sm hover:bg-secondary ${customEmoji === e ? 'bg-secondary ring-1 ring-primary' : ''}`}>
                  {e}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCustom(false)}
                className="flex-1 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary">Back</button>
              <button
                onClick={() => customText.trim() && applyStatus('custom', customText, customEmoji)}
                disabled={!customText.trim()}
                className="flex-1 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >Save</button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
