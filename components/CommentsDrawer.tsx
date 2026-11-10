"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Check, X, Trash2, Send, Loader2 } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  resolved: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

interface CommentsDrawerProps {
  pageId: string;
  currentUser: {
    id: string;
    name: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function CommentsDrawer({
  pageId,
  currentUser,
  isOpen,
  onClose,
}: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchComments() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/pages/${pageId}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(data.comments || []);
        }
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchComments();
  }, [pageId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [data.comment, ...prev]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleResolve = async (commentId: string, currentResolved: boolean) => {
    try {
      const res = await fetch(`/api/pages/${pageId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !currentResolved }),
      });

      if (res.ok) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, resolved: !currentResolved } : c
          )
        );
      }
    } catch (err) {
      console.error("Failed to toggle resolve:", err);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/pages/${pageId}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-white border-l border-[#e9e9e8] shadow-2xl z-40 flex flex-col transition-transform animate-in slide-in-from-right duration-200">
      <div className="h-14 border-b border-[#e9e9e8] px-5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-sm text-[#1a1a1a]">Comments & Discussions</h3>
          <span className="text-xs bg-[#f1f1ef] px-2 py-0.5 rounded-full font-medium text-[#787774]">
            {comments.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-black/5 text-[#787774] hover:text-[#1a1a1a] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 animate-spin text-[#787774]" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12 text-[#9b9a97]">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No comments yet</p>
            <p className="text-xs mt-1">Start a discussion or leave feedback below.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-3.5 rounded-xl border text-sm transition ${
                comment.resolved
                  ? "bg-[#fbfbfa] border-[#e9e9e8] opacity-75"
                  : "bg-white border-[#e9e9e8] shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
                    {comment.author.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-[#1a1a1a]">
                      {comment.author.name}
                    </span>
                    <span className="text-[10px] text-[#9b9a97] block">
                      {new Date(comment.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleResolve(comment.id, comment.resolved)}
                    className={`p-1 rounded hover:bg-black/5 transition text-xs flex items-center gap-1 ${
                      comment.resolved ? "text-emerald-600" : "text-[#787774]"
                    }`}
                    title={comment.resolved ? "Re-open comment" : "Resolve comment"}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  {comment.author.id === currentUser.id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 rounded hover:bg-red-50 text-[#787774] hover:text-red-600 transition"
                      title="Delete comment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className={`text-xs leading-relaxed ${comment.resolved ? "line-through text-[#9b9a97]" : "text-[#2f3437]"}`}>
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-[#e9e9e8] bg-white">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment or feedback..."
            className="flex-1 text-xs px-3.5 py-2.5 bg-[#fbfbfa] border border-[#d3d1cb] rounded-lg focus:outline-none focus:border-blue-500 transition"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="p-2.5 bg-[#2383e2] hover:bg-[#1d70c2] text-white rounded-lg disabled:opacity-50 transition shadow-xs cursor-pointer"
            title="Post comment"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
