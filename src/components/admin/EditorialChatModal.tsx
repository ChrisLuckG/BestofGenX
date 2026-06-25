"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, FileText, ExternalLink, Brain, Pencil } from "lucide-react";

interface ReporterUser {
  _id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface Reporter {
  _id: string;
  userId: string;
  slug: string;
  role: string;
  nationality: string;
  responsibilities: string;
  writingStyle?: string;
  personality?: string;
  memories: string[];
  user: ReporterUser;
}

interface ConversationMessage {
  role: 'user' | 'reporter';
  reporterName?: string;
  content: string;
  articleDraftId?: string;
  timestamp: string | Date;
}

interface EditorialChatModalProps {
  reporter: Reporter;
  onClose: () => void;
  onGoToArticles?: () => void;
}

export default function EditorialChatModal({ reporter, onClose, onGoToArticles }: EditorialChatModalProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showMemories, setShowMemories] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const reporterName = reporter.user?.displayName || reporter.user?.username || 'Reporter';

  useEffect(() => {
    loadHistory();
  }, [reporter.userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/editorial/chat?reporterUserId=${reporter.userId}`);
      const data = await res.json();
      if (data.success && data.conversation) {
        setConversationId(data.conversation._id);
        setMessages(data.conversation.messages || []);
      }
    } catch { /* silent */ }
    finally { setLoadingHistory(false); }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    const userMsg: ConversationMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/editorial/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterUserId: reporter.userId,
          message: text,
          conversationId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConversationId(data.conversationId);
        const reporterMsg: ConversationMessage = {
          role: 'reporter',
          reporterName: data.reporterName,
          content: data.response,
          articleDraftId: data.articleDraftId || undefined,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, reporterMsg]);
      } else {
        setMessages(prev => [...prev, {
          role: 'reporter',
          reporterName,
          content: 'Something went wrong. Try again.',
          timestamp: new Date(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'reporter',
        reporterName,
        content: 'Connection error.',
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts: string | Date) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatContent = (content: string) => {
    return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  const roleLabel = reporter.role.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-2xl h-[85vh] flex flex-col border border-gray-700 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-3">
            {reporter.user?.avatar ? (
              <img src={reporter.user.avatar} alt={reporterName} className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#D4873A 0%,#a86b2b 100%)' }}>
                {reporterName[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-semibold text-white text-sm">{reporterName}</div>
              <div className="text-[10px] text-gray-400">{roleLabel} · {reporter.nationality}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMemories(!showMemories)}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${showMemories ? 'bg-[#D4873A]/20 text-[#D4873A]' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
              title="Reporter memories"
            >
              <Brain className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Memories panel */}
        {showMemories && (
          <div className="bg-gray-800/60 border-b border-gray-700 px-4 py-3 max-h-32 overflow-y-auto">
            <div className="text-[10px] text-[#D4873A] font-semibold mb-1.5 uppercase tracking-wider">
              {reporterName}'s Memories ({reporter.memories?.length || 0})
            </div>
            {reporter.memories?.length > 0 ? (
              <ul className="space-y-0.5">
                {reporter.memories.map((m, i) => (
                  <li key={i} className="text-[11px] text-gray-300">· {m}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-gray-500">No memories yet. Tell {reporterName} to remember something.</p>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loadingHistory ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'linear-gradient(135deg,#D4873A 0%,#a86b2b 100%)' }}>
                {reporterName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white font-medium">{reporterName}</p>
                <p className="text-gray-400 text-xs mt-0.5">{reporter.responsibilities.slice(0, 80)}...</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-sm">
                {[
                  'Write an article about...',
                  'What should be on the homepage?',
                  'Give me 5 article ideas',
                  'Review this headline: ...',
                ].map(hint => (
                  <button
                    key={hint}
                    onClick={() => setInput(hint)}
                    className="text-left px-3 py-2 bg-gray-800 rounded-lg text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                {msg.role === 'reporter' && (
                  reporter.user?.avatar ? (
                    <img src={reporter.user.avatar} alt={reporterName} className="w-7 h-7 rounded-lg object-cover flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mt-0.5"
                      style={{ background: 'linear-gradient(135deg,#D4873A 0%,#a86b2b 100%)' }}>
                      {reporterName[0]?.toUpperCase()}
                    </div>
                  )
                )}

                <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#D4873A] text-white rounded-tr-sm'
                      : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                  }`}>
                    <p dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                  </div>

                  {/* Article draft link */}
                  {msg.articleDraftId && (
                    <button
                      onClick={() => { onClose(); onGoToArticles?.(); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-xs hover:bg-green-500/20 transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      <span>View draft in Articles</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}

                  <span className="text-[9px] text-gray-600 px-1">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#D4873A 0%,#a86b2b 100%)' }}>
                {reporterName[0]?.toUpperCase()}
              </div>
              <div className="px-3 py-2.5 bg-gray-800 rounded-xl rounded-tl-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-800">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${reporterName}... (Enter to send, Shift+Enter for newline)`}
              rows={1}
              className="flex-1 bg-gray-700 text-white text-sm px-3 py-2 rounded-lg resize-none outline-none focus:ring-1 focus:ring-[#D4873A] placeholder:text-gray-500 max-h-32"
              style={{ minHeight: '38px' }}
              autoFocus
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-[#D4873A] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#C4772A] transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-1.5">
            Say "write an article about X" → {reporterName} drafts it directly in Articles tab
          </p>
        </div>
      </div>
    </div>
  );
}
