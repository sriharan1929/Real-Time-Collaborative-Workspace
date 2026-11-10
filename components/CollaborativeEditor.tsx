"use client";

import { useEffect, useState, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Wifi,
  WifiOff,
} from "lucide-react";

interface Collaborator {
  clientId: number;
  user: {
    name: string;
    color: string;
  };
}

interface CollaborativeEditorProps {
  pageId: string;
  initialContent?: string | null;
  currentUser: {
    id: string;
    name: string;
    email: string;
  };
  canEdit?: boolean;
  onContentChange?: (content: string) => void;
}

const USER_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#d97706",
  "#9333ea",
];

function getRandomColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export function CollaborativeEditor(props: CollaborativeEditorProps) {
  const { pageId } = props;

  const wsUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      const envWs = process.env.NEXT_PUBLIC_COLLAB_WS_URL;
      // If configured for an external domain, preserve it
      if (envWs && !envWs.includes("localhost") && !envWs.includes("127.0.0.1")) {
        return envWs;
      }
      const host = window.location.hostname;
      const port = process.env.NEXT_PUBLIC_COLLAB_PORT || "1234";
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${host}:${port}`;
    }
    return process.env.NEXT_PUBLIC_COLLAB_WS_URL || "ws://localhost:1234";
  }, []);

  const [collab, setCollab] = useState<{ doc: Y.Doc; provider: WebsocketProvider } | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, `page/${pageId}`, doc, {
      connect: true,
    });
    setCollab({ doc, provider });

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [pageId, wsUrl]);

  if (!collab) {
    return (
      <div className="w-full min-h-[450px] flex items-center justify-center text-[#9b9a97] text-xs">
        Connecting to collaborative session...
      </div>
    );
  }

  return (
    <CollaborativeEditorInner
      {...props}
      key={`${pageId}-${collab.doc.guid}`}
      doc={collab.doc}
      provider={collab.provider}
    />
  );
}

interface CollaborativeEditorInnerProps extends CollaborativeEditorProps {
  doc: Y.Doc;
  provider: WebsocketProvider;
}

function CollaborativeEditorInner({
  doc,
  provider,
  initialContent,
  currentUser,
  canEdit = true,
  onContentChange,
}: CollaborativeEditorInnerProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">(
    provider.wsconnected ? "connected" : "connecting"
  );

  const userColor = useMemo(
    () => getRandomColor(currentUser.email || currentUser.id),
    [currentUser.email, currentUser.id]
  );

  // Sync awareness field for user profile
  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: currentUser.name,
      color: userColor,
    });
  }, [provider, currentUser.name, userColor]);

  // Provider status and awareness listeners lifecycle
  useEffect(() => {
    const updateCollaborators = () => {
      const states = provider.awareness.getStates();
      const active: Collaborator[] = [];
      states.forEach((state, clientId) => {
        if (state.user) {
          active.push({
            clientId,
            user: state.user,
          });
        }
      });
      setCollaborators(active);
    };

    const statusHandler = ({ status }: { status: "connecting" | "connected" | "disconnected" }) => {
      setConnectionStatus(status);
    };

    provider.on("status", statusHandler);
    provider.awareness.on("change", updateCollaborators);

    if (provider.wsconnected) {
      setConnectionStatus("connected");
    }

    return () => {
      provider.off("status", statusHandler);
      provider.awareness.off("change", updateCollaborators);
    };
  }, [provider]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: canEdit,
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Collaboration.configure({
          document: doc,
        }),
        CollaborationCursor.configure({
          provider,
          user: {
            name: currentUser.name,
            color: userColor,
          },
        }),
      ],
      // Do not pass content here so local state does not clash with incoming Yjs collaborative stream
      onUpdate: ({ editor }) => {
        if (onContentChange) {
          onContentChange(editor.getHTML());
        }
      },
      editorProps: {
        attributes: {
          class:
            "prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[500px] text-base leading-relaxed text-[#2f3437]",
        },
      },
    },
    [doc, provider]
  );

  // Hydrate initial content from database only if Y.Doc is empty after WebSocket sync
  useEffect(() => {
    if (!editor || !provider || !initialContent) return;

    const handleSync = (isSynced: boolean) => {
      if (!isSynced) return;

      // Only initialize content if the shared document is currently empty
      const isDocumentEmpty = editor.state.doc.textContent.trim().length === 0;
      if (isDocumentEmpty && initialContent) {
        editor.commands.setContent(initialContent, false);
      }
    };

    if (provider.synced) {
      handleSync(true);
    } else {
      provider.on("sync", handleSync);
    }

    return () => {
      provider.off("sync", handleSync);
    };
  }, [editor, provider, initialContent]);

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full flex flex-col">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs border-b border-[#f1f1ef] py-2 px-1 flex flex-wrap items-center justify-between gap-3 mb-6 select-none">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("bold") ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("italic") ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("strike") ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("code") ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Inline Code"
          >
            <Code className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-[#e9e9e8] mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("heading", { level: 1 }) ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("heading", { level: 2 }) ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("heading", { level: 3 }) ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-[#e9e9e8] mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("bulletList") ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("orderedList") ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded hover:bg-[#f1f1ef] transition ${
              editor.isActive("blockquote") ? "bg-[#e9e9e8] text-[#1a1a1a]" : "text-[#787774]"
            }`}
            title="Blockquote"
          >
            <Quote className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-1.5">
            {collaborators.map((c) => (
              <div
                key={c.clientId}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs border-2 border-white ring-1 ring-black/5"
                style={{ backgroundColor: c.user.color }}
                title={`${c.user.name} (Online)`}
              >
                {c.user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
              connectionStatus === "connected"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : connectionStatus === "connecting"
                ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {connectionStatus === "connected" ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-600" />
                <span>Live Sync Active</span>
              </>
            ) : connectionStatus === "connecting" ? (
              <>
                <Wifi className="w-3 h-3 text-blue-600" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-600" />
                <span>Standalone / Saving to DB</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="min-h-[450px] cursor-text"
        onClick={() => {
          if (editor && !editor.isFocused) {
            editor.commands.focus("end");
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
