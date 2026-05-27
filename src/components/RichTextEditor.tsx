import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, List, ListOrdered, Link2, Image as ImageIcon,
  Strikethrough, Code, Quote, Undo2, Redo2, Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  mentionUsers?: { id: string; name: string }[];
}

/**
 * Upload a file (image) to the backend and return its public URL.
 * Used by paste/drop handlers and the toolbar's "Insert image" button.
 */
async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/uploads', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.url || res.data?.path || '';
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Compose your message…',
  minHeight = 200,
  className = '',
  mentionUsers,
}: Props) {
  const uploadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // @ mention state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIdx, setMentionIdx] = useState(0);
  // Stable ref so handleKeyDown inside useEditor can access latest state
  const mentionRef = useRef({ active: false, filtered: [] as { id: string; name: string }[], idx: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'rte-image',
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate({ editor }) {
      onChange(editor.getHTML());
      if (mentionUsers?.length) {
        const { $from } = editor.state.selection;
        const before = $from.parent.textContent.slice(0, $from.parentOffset);
        const m = before.match(/@(\w*)$/);
        if (m) {
          const q = m[1];
          const filtered = (mentionUsers || [])
            .filter(u => u.name.toLowerCase().includes(q.toLowerCase()))
            .slice(0, 7);
          setMentionActive(true);
          setMentionQuery(q);
          setMentionIdx(0);
          mentionRef.current = { active: true, filtered, idx: 0 };
        } else {
          setMentionActive(false);
          mentionRef.current.active = false;
        }
      }
    },
    editorProps: {
      attributes: {
        class: `rte-content prose prose-sm max-w-none focus:outline-none px-4 py-3 ${className}`,
        style: `min-height: ${minHeight}px;`,
      },
      handleKeyDown(_view, event) {
        const s = mentionRef.current;
        if (!s.active || !s.filtered.length) return false;
        if (event.key === 'ArrowDown') { const ni = Math.min(s.idx + 1, s.filtered.length - 1); s.idx = ni; setMentionIdx(ni); return true; }
        if (event.key === 'ArrowUp') { const ni = Math.max(s.idx - 1, 0); s.idx = ni; setMentionIdx(ni); return true; }
        if (event.key === 'Escape') { s.active = false; setMentionActive(false); return true; }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const user = s.filtered[s.idx];
          if (user) { insertMentionUser(user); return true; }
        }
        return false;
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((i) => i.type.startsWith('image/'));
        if (!imageItem) return false;

        const file = imageItem.getAsFile();
        if (!file) return false;

        event.preventDefault();
        uploadAndInsertImage(file);
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files || []);
        const image = files.find((f) => f.type.startsWith('image/'));
        if (!image) return false;
        event.preventDefault();
        uploadAndInsertImage(image);
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  // Keep mention ref in sync with latest filtered list
  const mentionFiltered = (mentionUsers || [])
    .filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 7);

  useEffect(() => {
    mentionRef.current.filtered = mentionFiltered;
    mentionRef.current.idx = mentionIdx;
    mentionRef.current.active = mentionActive;
  });

  const uploadAndInsertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (uploadingRef.current) {
        toast.error('Upload already in progress — wait for it to finish');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image too large (max 10 MB)');
        return;
      }
      uploadingRef.current = true;
      const toastId = toast.loading('Uploading image…');
      try {
        const url = await uploadFile(file);
        if (!url) throw new Error('Upload returned no URL');
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        toast.success('Image inserted', { id: toastId });
      } catch (e: any) {
        toast.error(e?.response?.data?.error || e?.message || 'Upload failed', { id: toastId });
      } finally {
        uploadingRef.current = false;
      }
    },
    [editor]
  );

  const insertMentionUser = useCallback((user: { id: string; name: string }) => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const before = $from.parent.textContent.slice(0, $from.parentOffset);
    const m = before.match(/@(\w*)$/);
    const deleteLen = m ? m[0].length : 0;
    const from = $from.pos - deleteLen;
    const to = $from.pos;
    editor.chain().focus().deleteRange({ from, to }).insertContent(`@${user.name} `).run();
    setMentionActive(false);
    mentionRef.current.active = false;
  }, [editor]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('Link URL:', previousUrl);
    if (url === null) return; // user cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadAndInsertImage(file);
      e.target.value = ''; // allow re-picking the same file
    },
    [uploadAndInsertImage]
  );

  if (!editor) {
    return (
      <div
        className="rounded-lg border border-border bg-secondary/40 animate-pulse"
        style={{ minHeight }}
      />
    );
  }

  // Tiny helper for toolbar buttons — keeps the JSX below clean.
  const ToolbarBtn = ({
    onClick,
    active,
    title,
    children,
    disabled,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep focus in editor
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-30 ${
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border bg-secondary/30 flex-wrap">
        <ToolbarBtn
          title="Bold (Ctrl+B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic (Ctrl+I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Code"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code size={14} />
        </ToolbarBtn>

        <span className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Quote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={14} />
        </ToolbarBtn>

        <span className="w-px h-5 bg-border mx-1" />

        <ToolbarBtn title="Insert link" active={editor.isActive('link')} onClick={insertLink}>
          <Link2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn title="Insert image (or paste/drop)" onClick={triggerFilePicker}>
          {uploadingRef.current ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        </ToolbarBtn>

        <div className="flex-1" />

        <ToolbarBtn
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo2 size={14} />
        </ToolbarBtn>
      </div>

      {/* Editor surface + mention dropdown */}
      <div className="relative">
        <EditorContent editor={editor} />
        {mentionActive && mentionFiltered.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border bg-secondary/30">
              Mention
            </div>
            {mentionFiltered.map((user, i) => (
              <button
                key={user.id}
                type="button"
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                  i === mentionIdx ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'
                }`}
                onMouseDown={e => { e.preventDefault(); insertMentionUser(user); }}
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {user.name[0]?.toUpperCase()}
                </div>
                <span className="font-medium truncate">@{user.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input for the toolbar's image button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFilePicked}
        className="hidden"
      />
    </div>
  );
}
