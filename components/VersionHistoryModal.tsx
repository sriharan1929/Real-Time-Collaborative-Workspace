"use client";

import { useState, useEffect } from "react";
import { History, Clock, RotateCcw, Plus, X, Loader2 } from "lucide-react";

interface Snapshot {
  id: string;
  title: string;
  content: string | null;
  createdAt: string;
}

interface VersionHistoryModalProps {
  pageId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (content: string) => void;
}

export function VersionHistoryModal({
  pageId,
  isOpen,
  onClose,
  onRestore,
}: VersionHistoryModalProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadSnapshots() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/pages/${pageId}/snapshots`);
        if (res.ok) {
          const data = await res.json();
          setSnapshots(data.snapshots || []);
          if (data.snapshots && data.snapshots.length > 0) {
            setSelectedSnapshot(data.snapshots[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load snapshots:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSnapshots();
  }, [pageId, isOpen]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setSnapshots((prev) => [data.snapshot, ...prev]);
        setSelectedSnapshot(data.snapshot);
        setNewTitle("");
      }
    } catch (err) {
      console.error("Failed to create snapshot:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedSnapshot) return;
    if (!confirm(`Are you sure you want to restore snapshot "${selectedSnapshot.title}"? Current document content will be backed up.`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/snapshots/${selectedSnapshot.id}/restore`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        onRestore(data.restoredContent || "");
        onClose();
      }
    } catch (err) {
      console.error("Failed to restore snapshot:", err);
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full h-[600px] border border-[#e9e9e8] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        <div className="h-14 border-b border-[#e9e9e8] px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-sm font-bold text-[#1a1a1a]">Version History & Recovery</h2>
              <p className="text-[11px] text-[#787774]">Preview previous document snapshots and restore earlier states</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/5 text-[#787774] hover:text-[#1a1a1a] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 border-r border-[#e9e9e8] flex flex-col bg-[#fbfbfa]">
            <form onSubmit={handleCreateSnapshot} className="p-3 border-b border-[#e9e9e8] flex gap-1.5">
              <input
                type="text"
                placeholder="Snapshot name..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-[#d3d1cb] rounded-lg focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={!newTitle.trim() || isCreating}
                className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition cursor-pointer"
                title="Create Named Snapshot"
              >
                {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </form>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-[#787774]" />
                </div>
              ) : snapshots.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#9b9a97]">
                  No snapshots recorded yet. Create one above to preserve a version.
                </div>
              ) : (
                snapshots.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSnapshot(s)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition cursor-pointer ${
                      selectedSnapshot?.id === s.id
                        ? "bg-purple-50 text-purple-900 border border-purple-200 font-medium"
                        : "hover:bg-black/5 text-[#2f3437]"
                    }`}
                  >
                    <div className="font-semibold truncate">{s.title}</div>
                    <div className="text-[10px] text-[#9b9a97] flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(s.createdAt).toLocaleString()}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white">
            {selectedSnapshot ? (
              <>
                <div className="h-12 border-b border-[#e9e9e8] px-6 flex items-center justify-between bg-[#fbfbfa]/50">
                  <span className="text-xs font-semibold text-[#1a1a1a] truncate">
                    Previewing: {selectedSnapshot.title}
                  </span>
                  <button
                    onClick={handleRestore}
                    disabled={isRestoring}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isRestoring ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Restore This Version</span>
                  </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                  {selectedSnapshot.content ? (
                    <div
                      className="prose prose-sm max-w-none text-[#2f3437]"
                      dangerouslySetInnerHTML={{ __html: selectedSnapshot.content }}
                    />
                  ) : (
                    <div className="text-xs text-[#9b9a97] italic">Snapshot content is empty.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#9b9a97]">
                Select a snapshot from the list to preview and restore
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
