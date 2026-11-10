"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import {
  FileText,
  Plus,
  Calendar,
  User,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface PageItem {
  id: string;
  title: string;
  icon?: string | null;
  content?: string | null;
  parentId?: string | null;
  updatedAt: string;
  author?: {
    name: string;
    avatarUrl?: string | null;
  };
}

interface WorkspaceData {
  id: string;
  name: string;
  ownerId: string;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export default function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const resolvedParams = use(params);
  const workspaceId = resolvedParams.workspaceId;
  const router = useRouter();

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  useEffect(() => {
    async function loadWorkspaceData() {
      try {
        const userRes = await fetch("/api/auth/me");
        if (!userRes.ok) {
          router.push("/login");
          return;
        }
        const userData = await userRes.json();
        setUser(userData.user);

        const pagesRes = await fetch(`/api/workspaces/${workspaceId}/pages`);
        if (!pagesRes.ok) {
          if (pagesRes.status === 403 || pagesRes.status === 401) {
            router.push("/dashboard");
            return;
          }
          throw new Error("Failed to fetch pages");
        }
        const pagesData = await pagesRes.json();
        setPages(pagesData.pages || []);

        const wsRes = await fetch("/api/workspaces");
        if (wsRes.ok) {
          const wsList = await wsRes.json();
          const current = wsList.workspaces?.find(
            (w: { id: string }) => w.id === workspaceId
          );
          if (current) {
            setWorkspace({
              id: current.id,
              name: current.name,
              ownerId: current.ownerId,
            });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspaceData();
  }, [workspaceId, router]);

  const handleCreateNewPage = async () => {
    setIsCreatingPage(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/pages`, {
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

      router.push(`/workspace/${workspaceId}/page/${data.page.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingPage(false);
    }
  };

  if (isLoading || !workspace || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfbfa]">
        <Loader2 className="w-6 h-6 animate-spin text-[#787774]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#fbfbfa] text-[#2f3437] overflow-hidden">
      <WorkspaceSidebar
        currentWorkspace={workspace}
        pages={pages}
        currentUser={user}
        onPageCreated={(newPage) => setPages((prev) => [newPage, ...prev])}
      />

      <div className="flex-1 overflow-y-auto">
        <header className="h-14 border-b border-[#e9e9e8] px-8 flex items-center justify-between bg-white/70 backdrop-blur-xs sticky top-0 z-10">
          <div className="flex items-center gap-2 text-xs text-[#787774]">
            <Link href="/dashboard" className="hover:text-[#2f3437] transition">
              Workspaces
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#2f3437]">{workspace.name}</span>
          </div>

          <button
            id="workspace-overview-new-page-btn"
            onClick={handleCreateNewPage}
            disabled={isCreatingPage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2383e2] hover:bg-[#1d70c2] text-white text-xs font-medium shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {isCreatingPage ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>New Page</span>
          </button>
        </header>

        <main className="max-w-4xl mx-auto px-8 py-10">
          <div className="mb-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-sm mb-4">
              {workspace.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">
              {workspace.name}
            </h1>
            <p className="text-sm text-[#787774] mt-1">
              Collaborative workspace containing {pages.length}{" "}
              {pages.length === 1 ? "page" : "pages"}.
            </p>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#787774]">
              Workspace Pages
            </h2>
            <button
              onClick={handleCreateNewPage}
              disabled={isCreatingPage}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add a page</span>
            </button>
          </div>

          {pages.length === 0 ? (
            <div className="bg-white border border-[#e9e9e8] rounded-xl p-10 text-center">
              <FileText className="w-8 h-8 text-[#9b9a97] mx-auto mb-3" />
              <p className="text-sm font-medium text-[#2f3437] mb-1">
                No pages created yet
              </p>
              <p className="text-xs text-[#787774] mb-4">
                Start adding notes, documents, or team specs to this workspace.
              </p>
              <button
                onClick={handleCreateNewPage}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2383e2] text-white text-xs font-medium hover:bg-[#1d70c2] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Page</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#e9e9e8] rounded-xl divide-y divide-[#f1f1ef] shadow-xs">
              {pages.map((p) => (
                <Link
                  key={p.id}
                  id={`page-row-${p.id}`}
                  href={`/workspace/${workspaceId}/page/${p.id}`}
                  className="group flex items-center justify-between p-4 hover:bg-[#fbfbfa] transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{p.icon || ""}</span>
                    <div>
                      <div className="text-sm font-semibold text-[#1a1a1a] group-hover:text-blue-600 transition">
                        {p.title || "Untitled"}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#9b9a97] mt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {p.author?.name || "Member"}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(p.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#9b9a97] group-hover:text-blue-600 group-hover:translate-x-1 transition" />
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
