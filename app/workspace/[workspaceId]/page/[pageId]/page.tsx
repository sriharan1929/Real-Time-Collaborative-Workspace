"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { CollaborativeEditor } from "@/components/CollaborativeEditor";
import { CollaborativeWhiteboard } from "@/components/CollaborativeWhiteboard";
import { CommentsDrawer } from "@/components/CommentsDrawer";
import { VersionHistoryModal } from "@/components/VersionHistoryModal";
import { ManageMembersModal } from "@/components/ManageMembersModal";
import {
  Check,
  Loader2,
  Trash2,
  Clock,
  User,
  MessageSquare,
  History,
  Users,
  Share2,
  FileText,
  PenTool,
} from "lucide-react";

interface PageDetail {
  id: string;
  title: string;
  icon?: string | null;
  content?: string | null;
  workspaceId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  workspace: {
    id: string;
    name: string;
    ownerId: string;
  };
  author: {
    name: string;
    avatarUrl?: string | null;
  };
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export default function WorkspacePageEditor({
  params,
}: {
  params: Promise<{ workspaceId: string; pageId: string }>;
}) {
  const resolvedParams = use(params);
  const { workspaceId, pageId } = resolvedParams;
  const router = useRouter();

  const [page, setPage] = useState<PageDetail | null>(null);
  const [workspacePages, setWorkspacePages] = useState<
    Array<{ id: string; title: string; icon?: string | null; updatedAt: string }>
  >([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const contentRef = useRef("");
  const [restoreKey, setRestoreKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [viewMode, setViewMode] = useState<"document" | "whiteboard">("document");

  useEffect(() => {
    async function loadData() {
      try {
        const userRes = await fetch("/api/auth/me");
        if (!userRes.ok) {
          router.push("/login");
          return;
        }
        const userData = await userRes.json();
        setUser(userData.user);

        const pageRes = await fetch(`/api/pages/${pageId}`);
        if (!pageRes.ok) {
          router.push(`/workspace/${workspaceId}`);
          return;
        }
        const pageData = await pageRes.json();
        setPage(pageData.page);
        setTitle(pageData.page.title || "Untitled");
        setContent(pageData.page.content || "");
        contentRef.current = pageData.page.content || "";

        const wsPagesRes = await fetch(`/api/workspaces/${workspaceId}/pages`);
        if (wsPagesRes.ok) {
          const wsPagesData = await wsPagesRes.json();
          setWorkspacePages(wsPagesData.pages || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [workspaceId, pageId, router]);

  const triggerSave = useCallback(
    (newTitle: string, newContent: string) => {
      setSaveStatus("saving");
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/pages/${pageId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: newTitle.trim() || "Untitled",
              content: newContent,
            }),
          });

          if (res.ok) {
            setSaveStatus("saved");
            setWorkspacePages((prev) =>
              prev.map((p) =>
                p.id === pageId ? { ...p, title: newTitle.trim() || "Untitled" } : p
              )
            );
          } else {
            setSaveStatus("unsaved");
          }
        } catch (err) {
          console.error(err);
          setSaveStatus("unsaved");
        }
      }, 700);
    },
    [pageId]
  );

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerSave(val, contentRef.current);
  };

  const handleEditorContentChange = (newHtml: string) => {
    contentRef.current = newHtml;
    triggerSave(title, newHtml);
  };

  const handleRestoreVersion = (restoredContent: string) => {
    contentRef.current = restoredContent;
    setContent(restoredContent);
    setRestoreKey((prev) => prev + 1);
    triggerSave(title, restoredContent);
  };

  const handleDeletePage = async () => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    try {
      const res = await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/workspace/${workspaceId}`);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading || !page || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfbfa]">
        <Loader2 className="w-6 h-6 animate-spin text-[#787774]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#fbfbfa] text-[#2f3437] overflow-hidden">
      <WorkspaceSidebar
        currentWorkspace={page.workspace}
        pages={workspacePages}
        currentUser={user}
        onPageCreated={(newPage) => setWorkspacePages((prev) => [newPage, ...prev])}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        <header className="h-12 border-b border-[#e9e9e8] px-6 flex items-center justify-between bg-white select-none shrink-0 z-20">
          <div className="flex items-center gap-2 text-xs text-[#787774]">
            <Link
              href={`/workspace/${workspaceId}`}
              className="hover:text-[#2f3437] transition flex items-center gap-1 font-medium"
            >
              <span>{page.workspace.name}</span>
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#2f3437] truncate max-w-xs">
              {title || "Untitled"}
            </span>
          </div>

          {/* Segmented Document / Whiteboard View Switcher */}
          <div className="flex items-center bg-[#f4f4f3] p-0.5 rounded-lg border border-[#e9e9e8]">
            <button
              id="view-mode-doc-btn"
              type="button"
              onClick={() => setViewMode("document")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition cursor-pointer ${
                viewMode === "document"
                  ? "bg-white text-[#1a1a1a] shadow-xs font-semibold"
                  : "text-[#787774] hover:text-[#1a1a1a]"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Document</span>
            </button>
            <button
              id="view-mode-whiteboard-btn"
              type="button"
              onClick={() => setViewMode("whiteboard")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition cursor-pointer ${
                viewMode === "whiteboard"
                  ? "bg-white text-purple-600 shadow-xs font-semibold"
                  : "text-[#787774] hover:text-[#1a1a1a]"
              }`}
            >
              <PenTool className="w-3.5 h-3.5 text-purple-600" />
              <span>Whiteboard</span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#787774]">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                  <span>Saving...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700">Saved</span>
                </>
              )}
              {saveStatus === "unsaved" && (
                <span className="text-amber-600">Unsaved changes</span>
              )}
            </div>

            <div className="h-4 w-px bg-[#e9e9e8] mx-1" />

            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-black/5 text-[#787774] hover:text-[#1a1a1a] text-xs font-medium transition cursor-pointer"
              title="Version History & Restore"
            >
              <History className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden md:inline">History</span>
            </button>

            <button
              onClick={() => setIsCommentsOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-black/5 text-[#787774] hover:text-[#1a1a1a] text-xs font-medium transition cursor-pointer"
              title="Comments & Discussions"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline">Comments</span>
            </button>

            <button
              onClick={() => setIsMembersOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-black/5 text-[#787774] hover:text-[#1a1a1a] text-xs font-medium transition cursor-pointer"
              title="Workspace Members"
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">Members</span>
            </button>

            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(window.location.href);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-blue-50 text-blue-600 hover:text-blue-700 text-xs font-medium transition cursor-pointer"
              title="Copy Direct Page Link to Share"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden md:inline">Share Link</span>
                </>
              )}
            </button>

            <div className="h-4 w-px bg-[#e9e9e8] mx-0.5" />

            <button
              onClick={handleDeletePage}
              className="p-1.5 rounded hover:bg-red-50 text-[#787774] hover:text-red-600 transition cursor-pointer"
              title="Delete Page"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {viewMode === "document" ? (
          <div className="flex-1 overflow-y-auto px-6 py-10 md:px-20 lg:px-36">
            <div className="max-w-3xl mx-auto">
              <div className="mb-6 group">
                <div className="text-4xl mb-3 select-none cursor-default">
                  {page.icon || ""}
                </div>

                <input
                  id="page-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Untitled"
                  className="w-full text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a1a] placeholder:text-[#d3d1cb] border-none outline-none bg-transparent focus:ring-0 p-0"
                />

                <div className="flex items-center gap-3 mt-3 text-xs text-[#9b9a97]">
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>Created by {page.author.name}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(page.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#f4f4f3] my-4" />

              <CollaborativeEditor
                key={`${pageId}-${restoreKey}`}
                pageId={pageId}
                initialContent={content}
                currentUser={user}
                onContentChange={handleEditorContentChange}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
            <CollaborativeWhiteboard pageId={pageId} currentUser={user} />
          </div>
        )}
      </div>

      <CommentsDrawer
        pageId={pageId}
        currentUser={user}
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
      />

      <VersionHistoryModal
        pageId={pageId}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRestore={handleRestoreVersion}
      />

      <ManageMembersModal
        workspaceId={workspaceId}
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        currentUser={user}
      />
    </div>
  );
}
