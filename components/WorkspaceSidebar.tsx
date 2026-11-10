"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  LogOut,
  FolderKanban,
  ChevronDown,
  LayoutDashboard,
  Loader2,
  Users,
  Check,
} from "lucide-react";
import { ManageMembersModal } from "./ManageMembersModal";

interface PageItem {
  id: string;
  title: string;
  icon?: string | null;
  parentId?: string | null;
  updatedAt: string;
}

interface WorkspaceSidebarProps {
  currentWorkspace: {
    id: string;
    name: string;
    ownerId?: string;
  };
  pages: PageItem[];
  currentUser: {
    id: string;
    name: string;
    email: string;
  };
  onPageCreated?: (page: PageItem) => void;
}

export function WorkspaceSidebar({
  currentWorkspace,
  pages,
  currentUser,
  onPageCreated,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [workspacesList, setWorkspacesList] = useState<Array<{ id: string; name: string }>>([]);

  const toggleWorkspaceDropdown = async () => {
    if (!isWorkspaceDropdownOpen && workspacesList.length === 0) {
      try {
        const res = await fetch("/api/workspaces");
        if (res.ok) {
          const data = await res.json();
          setWorkspacesList(data.workspaces || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    setIsWorkspaceDropdownOpen((prev) => !prev);
  };

  const handleCreatePage = async () => {
    setIsCreatingPage(true);
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled Page",
          icon: "",
          content: "",
        }),
      });

      if (!res.ok) throw new Error("Failed to create page");
      const data = await res.json();

      if (onPageCreated) {
        onPageCreated(data.page);
      }

      router.push(`/workspace/${currentWorkspace.id}/page/${data.page.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingPage(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error(err);
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="w-64 h-screen bg-[#f7f6f3] border-r border-[#e9e9e8] flex flex-col select-none shrink-0">
      <div className="p-3 border-b border-[#e9e9e8]/70 relative">
        <button
          onClick={toggleWorkspaceDropdown}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 transition text-sm font-semibold text-[#2f3437] truncate cursor-pointer text-left"
          title="Switch Workspace"
        >
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {currentWorkspace.name.charAt(0).toUpperCase()}
          </div>
          <span className="truncate flex-1">{currentWorkspace.name}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#9b9a97] shrink-0 transition-transform ${
              isWorkspaceDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isWorkspaceDropdownOpen && (
          <div className="absolute top-full left-2 right-2 mt-1 bg-white border border-[#e9e9e8] rounded-xl shadow-lg py-2 z-50">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9b9a97]">
              Switch Workspace
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {workspacesList.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setIsWorkspaceDropdownOpen(false);
                    router.push(`/workspace/${w.id}`);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#f7f6f3] transition text-left cursor-pointer ${
                    w.id === currentWorkspace.id
                      ? "font-semibold text-blue-600 bg-blue-50/50"
                      : "text-[#2f3437]"
                  }`}
                >
                  <span className="truncate flex-1">{w.name}</span>
                  {w.id === currentWorkspace.id && (
                    <Check className="w-3.5 h-3.5 shrink-0 text-blue-600 ml-2" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-[#f1f1ef] my-1" />
            <Link
              href="/dashboard"
              onClick={() => setIsWorkspaceDropdownOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#5f6368] hover:bg-[#f7f6f3] hover:text-[#1a1a1a] transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#787774]" />
              <span>All Workspaces (Dashboard)</span>
            </Link>
          </div>
        )}
      </div>

      <div className="px-3 pt-3 pb-2 space-y-0.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#5f6368] hover:bg-black/5 hover:text-[#2f3437] transition"
        >
          <LayoutDashboard className="w-4 h-4 text-[#787774]" />
          <span>Dashboard</span>
        </Link>
        <Link
          href={`/workspace/${currentWorkspace.id}`}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#5f6368] hover:bg-black/5 hover:text-[#2f3437] transition"
        >
          <FolderKanban className="w-4 h-4 text-[#787774]" />
          <span>Workspace Overview</span>
        </Link>
        <button
          onClick={() => setIsMembersModalOpen(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#5f6368] hover:bg-black/5 hover:text-[#2f3437] transition text-left cursor-pointer"
        >
          <Users className="w-4 h-4 text-[#787774]" />
          <span>Members & Roles</span>
        </button>
      </div>

      <ManageMembersModal
        workspaceId={currentWorkspace.id}
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        currentUser={currentUser}
      />

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="flex items-center justify-between px-2 mb-1.5">
          <span className="text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wider">
            Pages
          </span>
          <button
            id="sidebar-create-page-btn"
            onClick={handleCreatePage}
            disabled={isCreatingPage}
            className="p-1 rounded hover:bg-black/10 text-[#787774] hover:text-[#2f3437] transition cursor-pointer"
            title="Create New Page"
          >
            {isCreatingPage ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="space-y-0.5">
          {pages.length === 0 ? (
            <div className="px-2 py-3 text-xs text-[#9b9a97] italic">
              No pages yet. Click + to add one.
            </div>
          ) : (
            pages.map((p) => {
              const active = pathname.includes(`/page/${p.id}`);
              return (
                <Link
                  key={p.id}
                  id={`page-link-${p.id}`}
                  href={`/workspace/${currentWorkspace.id}/page/${p.id}`}
                  className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition ${
                    active
                      ? "bg-black/8 font-medium text-[#2f3437]"
                      : "text-[#5f6368] hover:bg-black/5 hover:text-[#2f3437]"
                  }`}
                >
                  <span className="text-sm shrink-0">{p.icon || ""}</span>
                  <span className="truncate flex-1">{p.title || "Untitled"}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <div className="p-3 border-t border-[#e9e9e8] bg-[#f7f6f3]">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 truncate">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-[#2f3437] truncate">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-[#9b9a97] truncate">
                {currentUser.email}
              </div>
            </div>
          </div>

          <button
            id="sidebar-logout-btn"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="p-1.5 rounded-md hover:bg-black/10 text-[#787774] hover:text-red-600 transition cursor-pointer"
            title="Sign out"
          >
            {isLoggingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
