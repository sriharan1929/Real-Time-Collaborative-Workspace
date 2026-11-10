"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, Shield, Trash2, X, Loader2 } from "lucide-react";

interface Member {
  id: string;
  role: "OWNER" | "EDITOR" | "COMMENTER" | "VIEWER";
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

interface ManageMembersModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
  };
}

export function ManageMembersModal({
  workspaceId,
  isOpen,
  onClose,
  currentUser,
}: ManageMembersModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "COMMENTER" | "VIEWER">("EDITOR");
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadMembers() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/members`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members || []);
          setIsOwner(data.isOwner || false);
        }
      } catch (err) {
        console.error("Failed to load members:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMembers();
  }, [workspaceId, isOpen]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || isInviting) return;

    setIsInviting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to invite member");
      }

      setMembers((prev) => [...prev, data.member]);
      setInviteEmail("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to invite member");
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId ? { ...m, role: newRole as Member["role"] } : m
          )
        );
      }
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this member from workspace?")) return;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      }
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-[#e9e9e8] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-[#1a1a1a]">Workspace Members & Roles</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/5 text-[#787774] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {errorMsg}
          </div>
        )}

        {isOwner && (
          <form onSubmit={handleInvite} className="mb-6 p-4 bg-[#fbfbfa] border border-[#e9e9e8] rounded-xl">
            <h3 className="text-xs font-semibold text-[#1a1a1a] mb-2 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              <span>Invite New Member</span>
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 text-xs px-3 py-2 bg-white border border-[#d3d1cb] rounded-lg focus:outline-none focus:border-blue-500"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "EDITOR" | "COMMENTER" | "VIEWER")}
                className="text-xs px-2.5 py-2 bg-white border border-[#d3d1cb] rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="EDITOR">Editor</option>
                <option value="COMMENTER">Commenter</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={isInviting || !inviteEmail.trim()}
                className="px-3.5 py-2 bg-[#2383e2] hover:bg-[#1d70c2] text-white text-xs font-medium rounded-lg disabled:opacity-50 transition cursor-pointer"
              >
                {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Invite"}
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 max-h-72 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#787774]" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#9b9a97]">
              No other members yet. Invite team members above!
            </div>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-xl border border-[#e9e9e8] bg-white text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                    {m.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-[#1a1a1a]">{m.user.name}</div>
                    <div className="text-[11px] text-[#787774]">{m.user.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isOwner && m.user.id !== currentUser.id ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="text-xs px-2 py-1 bg-[#fbfbfa] border border-[#d3d1cb] rounded-md focus:outline-none"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="EDITOR">Editor</option>
                      <option value="COMMENTER">Commenter</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[10px]">
                      <Shield className="w-3 h-3" />
                      {m.role}
                    </span>
                  )}

                  {(isOwner || m.user.id === currentUser.id) && (
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="p-1 rounded hover:bg-red-50 text-[#787774] hover:text-red-600 transition"
                      title={m.user.id === currentUser.id ? "Leave workspace" : "Remove member"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
