"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FolderKanban,
  FileText,
  Users,
  LogOut,
  Sparkles,
  ArrowRight,
  Loader2,
  Shield,
} from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  pageCount: number;
  memberCount: number;
  currentUserRole: string;
  updatedAt: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

        const wsRes = await fetch("/api/workspaces");
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          setWorkspaces(wsData.workspaces || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create workspace");

      setIsModalOpen(false);
      setNewWorkspaceName("");
      if (data.workspace?.id && data.firstPageId) {
        router.push(`/workspace/${data.workspace.id}/page/${data.firstPageId}`);
      } else {
        router.push(`/workspace/${data.workspace.id}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError("An error occurred");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfbfa]">
        <Loader2 className="w-6 h-6 animate-spin text-[#787774]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#2f3437]">
      <header className="border-b border-[#e9e9e8] bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-[#1a1a1a]">
                Collaborative Workspace
              </span>
              <span className="text-[11px] text-[#787774] block -mt-0.5">
                Real-Time Document Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold leading-tight">{user?.name}</div>
                <div className="text-[11px] text-[#787774] leading-tight">{user?.email}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-[#787774] hover:text-red-600 hover:bg-black/5 transition cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">
              Your Workspaces
            </h1>
            <p className="text-sm text-[#787774] mt-0.5">
              Select an existing workspace or create a new one to organize pages.
            </p>
          </div>

          <button
            id="create-workspace-btn"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2383e2] hover:bg-[#1d70c2] text-white text-sm font-medium shadow-sm transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workspace</span>
          </button>
        </div>

        {workspaces.length === 0 ? (
          <div className="bg-white border border-[#e9e9e8] rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[#1a1a1a] mb-1">
              No workspaces found
            </h3>
            <p className="text-sm text-[#787774] mb-6">
              Create your first workspace to start collaborating on shared documents.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2383e2] hover:bg-[#1d70c2] text-white text-sm font-medium transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workspace</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                id={`workspace-card-${ws.id}`}
                href={`/workspace/${ws.id}`}
                className="group bg-white border border-[#e9e9e8] hover:border-blue-400/80 rounded-xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      <Shield className="w-3 h-3" />
                      {ws.currentUserRole}
                    </span>
                  </div>

                  <h3 className="font-semibold text-base text-[#1a1a1a] group-hover:text-blue-600 transition truncate">
                    {ws.name}
                  </h3>
                </div>

                <div className="mt-6 pt-4 border-t border-[#f4f4f3] flex items-center justify-between text-xs text-[#787774]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {ws.pageCount} {ws.pageCount === 1 ? "page" : "pages"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {ws.memberCount} {ws.memberCount === 1 ? "member" : "members"}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#9b9a97] group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#e9e9e8] shadow-xl p-6 transition-all animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-[#1a1a1a] mb-1">
              Create New Workspace
            </h2>
            <p className="text-xs text-[#787774] mb-5">
              Workspaces are shared spaces where documents and members are organized.
            </p>

            {createError && (
              <div className="mb-4 p-2.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#787774] mb-1.5">
                  Workspace Name
                </label>
                <input
                  id="new-workspace-name-input"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Engineering Team, Marketing 2026"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#d3d1cb] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCreateError(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-[#787774] hover:bg-black/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="modal-confirm-create-workspace-btn"
                  type="submit"
                  disabled={isCreating || !newWorkspaceName.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2383e2] hover:bg-[#1d70c2] text-white text-sm font-medium shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
