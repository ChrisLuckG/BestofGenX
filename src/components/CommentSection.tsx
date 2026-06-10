"use client";

import { useState, useEffect } from "react";
import { Send, Trash2, MessageCircle, MoreHorizontal, Flag, Copy, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Comment {
  _id: string;
  articleId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  likes: number;
  createdAt: string;
}

interface CommentSectionProps {
  articleId: string;
  onShowLogin?: () => void;
}

// Format time ago
const timeAgo = (dateStr: string): string => {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return then.toLocaleDateString();
};

export default function CommentSection({ articleId, onShowLogin }: CommentSectionProps) {
  const { user, isLoggedIn } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
  }, [articleId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`);
      const data = await res.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (e) {
      console.error('Failed to fetch comments:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user?.id) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          content: newComment.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setComments([data.comment, ...comments]);
        setNewComment("");
      }
    } catch (e) {
      console.error('Failed to post comment:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user?.id) return;
    if (!confirm('Delete this comment?')) return;

    try {
      const res = await fetch(
        `/api/articles/${articleId}/comments?commentId=${commentId}&userId=${user.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setComments(comments.filter(c => c._id !== commentId));
      }
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  };

  const handleCopy = (commentId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(commentId);
    setOpenMenuId(null);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReport = (commentId: string) => {
    setOpenMenuId(null);
    alert('Comment reported. Thank you for helping keep our community safe!');
  };

  return (
    <div className="border-t border-warm pt-6 mt-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-[#D4873A]" />
        <h3 className="font-bold text-gray-900">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comment Input */}
      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="w-9 h-9 rounded-full bg-skeleton-light overflow-hidden flex-shrink-0 border border-warm">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#D4873A]/20 flex items-center justify-center text-[#D4873A] font-bold text-sm">
                  {(user?.username || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                maxLength={1000}
                className="flex-1 px-3 py-2 bg-cream border border-warm rounded-full text-sm text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-4 py-2 bg-[#D4873A] text-white rounded-full font-medium text-sm flex items-center gap-1 disabled:opacity-50 hover:bg-[#C4772A] transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-cream border border-warm rounded-xl text-center">
          <p className="text-sm text-gray-600 mb-2">Sign in to join the discussion</p>
          <button
            onClick={onShowLogin}
            className="px-4 py-2 bg-[#D4873A] text-white rounded-lg font-medium text-sm hover:bg-[#C4772A] transition-colors"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Comment List */}
      {loading ? (
        <div className="text-center py-6 text-gray-400 text-sm">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          Be the first to comment!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment._id} className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-skeleton-light overflow-hidden flex-shrink-0 border border-warm">
                {comment.userAvatar ? (
                  <img src={comment.userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#D4873A]/20 flex items-center justify-center text-[#D4873A] font-bold text-sm">
                    {comment.userName[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-cream border border-warm rounded-2xl px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-bold text-sm text-gray-900 truncate">
                      {comment.userName}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-400">
                        {timeAgo(comment.createdAt)}
                      </span>
                      {/* More options button */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === comment._id ? null : comment._id)}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {/* Dropdown menu */}
                        {openMenuId === comment._id && (
                          <div className="absolute right-0 top-7 bg-white border border-warm rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                            <button
                              onClick={() => handleCopy(comment._id, comment.content)}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              {copiedId === comment._id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              {copiedId === comment._id ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                              onClick={() => handleReport(comment._id)}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Flag className="w-4 h-4" />
                              Report
                            </button>
                            {user?.id === comment.userId && (
                              <button
                                onClick={() => { setOpenMenuId(null); handleDelete(comment._id); }}
                                className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 break-words">{comment.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
