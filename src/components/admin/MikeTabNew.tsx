"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Search, ChevronRight, Sparkles, FileText, Bug, Smartphone, 
  Server, Layout, CreditCard, Gamepad2, FileEdit, Settings, Brain, 
  Rocket, Send, Loader2, Trash2, Edit3, Save, X, RefreshCw,
  MessageCircle, User, Paperclip, Play, Plus, Filter, Clock,
  CheckCircle2, Circle, ArrowRight, MoreHorizontal, Mic, MicOff, Copy, Check
} from "lucide-react";

interface ChatMessage {
  role: 'user' | 'mike';
  content: string;
  timestamp: string;
}

interface Task {
  _id: string;
  ticketNumber?: number;
  title: string;
  description: string;
  originalRequest: string;
  chatHistory: string;
  chatMessages: ChatMessage[];
  category: string;
  priority: string;
  status: string;
  complexity: string;
  notes: string;
  aiSuggestions: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  'Feed/Welcome Reel', 'Arcade', 'Shop', 'Rankings', 'Articles', 'Battles', 'Trivia', 'Predictions', 'TV', 'Radio', 'Profile',
  'UI/UX', 'Bug Fix', 'Mobile', 'Desktop', 'Backend', 'Frontend', 'Payments', 'Gamification', 'Content', 'Admin', 'AI', 'System Prompt', 'Future Features'
];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low', 'Future Idea'];
const STATUSES = ['Draft', 'Review', 'Approved', 'In Progress', 'Testing', 'Completed', 'Rejected'];

const STATUS_FLOW = ['Draft', 'Review', 'Approved', 'In Progress', 'Testing', 'Completed'];

const PRIORITY_COLORS: Record<string, string> = {
  'Critical': 'text-red-400',
  'High': 'text-orange-400',
  'Medium': 'text-yellow-400',
  'Low': 'text-blue-400',
  'Future Idea': 'text-purple-400',
};

const COMPLEXITY_COST: Record<string, number> = {
  'Trivial': 15, 'Simple': 25, 'Medium': 75, 'Complex': 200, 'Epic': 600
};

export default function MikeTabNew() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'activity'>('overview');
  const [editMode, setEditMode] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [manualTicket, setManualTicket] = useState<Partial<Task>>({
    title: '',
    description: '',
    category: 'Future Features',
    priority: 'Medium',
    status: 'Draft',
    complexity: 'Medium',
    notes: '',
  });
  
  // Chat state - per ticket pending messages
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Record<string, ChatMessage[]>>({}); // Per ticket
  const chatEndRef = useRef<HTMLDivElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cascadePromptCopied, setCascadePromptCopied] = useState(false);
  
  // Parse chatHistory - only show NEW chat (after "Here's the ticket")
  const parseHistory = (history: string): ChatMessage[] => {
    if (!history) return [];
    // Find where the new chat starts (after ticket creation)
    const ticketMarker = "Here's the ticket I've prepared:";
    const idx = history.lastIndexOf(ticketMarker);
    const newChat = idx >= 0 ? history.slice(idx + ticketMarker.length) : history;
    
    const lines = newChat.split('\n').filter(l => l.trim());
    const msgs: ChatMessage[] = [];
    for (const line of lines) {
      // Skip JSON action lines
      if (line.includes('"action":')) continue;
      
      if (line.startsWith('User:')) {
        const content = line.replace(/^User:\s*/, '');
        if (content && !content.startsWith('{')) {
          msgs.push({ role: 'user', content, timestamp: '' });
        }
      } else if (line.startsWith('Mike:')) {
        const content = line.replace(/^Mike:\s*/, '');
        // Skip if it's just JSON
        if (content && !content.startsWith('{')) {
          msgs.push({ role: 'mike', content, timestamp: '' });
        }
      }
    }
    return msgs;
  };
  
  const dbChat = selectedTask ? parseHistory(selectedTask.chatHistory || '') : [];
  const ticketPending = selectedTask ? (pendingMessages[selectedTask._id] || []) : (pendingMessages['new'] || []);
  const currentChat: ChatMessage[] = [...dbChat, ...ticketPending];

  // Cascade state
  const [cascadeStatus, setCascadeStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [cascadeStep, setCascadeStep] = useState({ current: 0, total: 0, description: '' });

  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'de-DE'; // German, change to 'en-US' for English
      
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsRecording(false);
      };
      
      rec.onerror = () => {
        setIsRecording(false);
      };
      
      rec.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(rec);
    }
  }, []);

  const toggleVoiceInput = async () => {
    if (!recognition) {
      alert('Speech recognition not supported in this browser. Use Chrome or Edge.');
      return;
    }
    
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      try {
        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognition.start();
        setIsRecording(true);
      } catch (err) {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
        console.error('Mic error:', err);
      }
    }
  };

  useEffect(() => { fetchTasks(); }, []);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat]);

  // Auto-reload every 5 seconds to catch status changes (e.g., when Cascade sets "In Progress")
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTasks();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll cascade queue for responses and status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/mike/queue');
        const data = await res.json();
        
        // Check for Cascade response in chat
        if (data.cascadeResponse && selectedTask && data.cascadeResponse.ticketId === selectedTask._id) {
          const responseTime = data.cascadeResponse.respondedAt;
          const cascadeMsg: ChatMessage = { 
            role: 'mike',
            content: data.cascadeResponse.message, // Already has [CASCADE] prefix
            timestamp: responseTime 
          };
          // Add if this specific response isn't already shown
          setPendingMessages(prev => {
            const existing = prev[selectedTask._id] || [];
            if (!existing.some(m => m.timestamp === responseTime)) {
              return { ...prev, [selectedTask._id]: [...existing, cascadeMsg] };
            }
            return prev;
          });
        }
        
        if (cascadeStatus === 'working') {
          if (data.status === 'completed' || data.status === 'idle') {
            setCascadeStatus('done');
            fetchTasks();
          } else if (data.status === 'working') {
            setCascadeStep({
              current: data.currentStep || 0,
              total: data.totalSteps || 1,
              description: data.stepDescription || 'Working...'
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [cascadeStatus]);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/admin/mike/tasks');
      const data = await res.json();
      if (data.success) setTasks(data.tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput;
    const ticketId = selectedTask?._id || 'new';
    setChatInput('');
    
    // Show user message immediately (optimistic)
    const userMsg: ChatMessage = { role: 'user', content: userMessage, timestamp: new Date().toISOString() };
    setPendingMessages(prev => ({
      ...prev,
      [ticketId]: [...(prev[ticketId] || []), userMsg]
    }));
    setChatLoading(true);
    
    try {
      const res = await fetch('/api/admin/mike/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage, 
          history: currentChat,
          ticketId: selectedTask?._id || null  // null for new ticket
        }),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        console.error('Chat failed:', data.error);
        return;
      }
      
      // Show Mike's response immediately (optimistic)
      if (data.response) {
        const mikeMsg: ChatMessage = { role: 'mike', content: data.response, timestamp: new Date().toISOString() };
        setPendingMessages(prev => ({
          ...prev,
          [ticketId]: [...(prev[ticketId] || []), mikeMsg]
        }));
      }
      
      if (data.ticket) {
        await createTicket(data.ticket);
        // Clear new ticket chat after creating
        setPendingMessages(prev => ({ ...prev, new: [] }));
      }
      
      // Refresh to get updated chat from DB
      try {
        const refreshRes = await fetch('/api/admin/mike/tasks');
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setTasks(refreshData.tasks);
          const updatedTask = refreshData.tasks.find((t: Task) => t._id === ticketId);
          if (updatedTask) {
            // Only clear pending if DB actually has the messages
            if (updatedTask.chatMessages && updatedTask.chatMessages.length > 0) {
              setPendingMessages(prev => ({ ...prev, [ticketId]: [] }));
            }
            setSelectedTask({...updatedTask});
          }
        }
      } catch (refreshError) {
        console.error('Refresh failed:', refreshError);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setChatLoading(false);
    }
  };

  const createTicket = async (ticket: any) => {
    try {
      const res = await fetch('/api/admin/mike/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchTasks();
        // Auto-select the new ticket
        if (data.task) {
          setSelectedTask(data.task);
        }
      }
    } catch (error) {
      console.error('Create ticket error:', error);
    }
  };

  const createManualTicket = async () => {
    if (!manualTicket.title?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/mike/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualTicket),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTasks();
        setSelectedTask(data.task);
        setShowManualCreate(false);
        setManualTicket({
          title: '',
          description: '',
          category: 'Future Features',
          priority: 'Medium',
          status: 'Draft',
          complexity: 'Medium',
          notes: '',
        });
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    setSaving(true);
    
    // Immediately update selectedTask for instant UI feedback
    if (selectedTask && selectedTask._id === id) {
      setSelectedTask({ ...selectedTask, ...updates } as Task);
    }
    
    try {
      const res = await fetch(`/api/admin/mike/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      
      // Update with server response
      if (data.success && data.task) {
        setSelectedTask(data.task);
      }
      
      fetchTasks();
      setEditMode(false);
    } catch (error) {
      console.error('Update error:', error);
      // Revert on error
      fetchTasks();
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this ticket?')) return;
    try {
      await fetch(`/api/admin/mike/tasks/${id}`, { method: 'DELETE' });
      setSelectedTask(null);
      fetchTasks();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editedTask._id) return;
    
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.url) {
        const currentAttachments = editedTask.attachments || [];
        setEditedTask({ ...editedTask, attachments: [...currentAttachments, data.url] });
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploadingImage(false);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    const currentAttachments = editedTask.attachments || [];
    setEditedTask({ ...editedTask, attachments: currentAttachments.filter((_, i) => i !== index) });
  };

  const startCascade = async (task: Task) => {
    setCascadeStatus('working');
    setCascadeStep({ current: 0, total: 5, description: 'Starting...' });
    
    try {
      await fetch('/api/admin/mike/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pending',
          tasks: [{
            id: task._id,
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            complexity: task.complexity,
            aiSuggestions: task.aiSuggestions,
          }],
        }),
      });
    } catch (e) {
      console.error(e);
      setCascadeStatus('idle');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const getStatusIndex = (status: string) => STATUS_FLOW.indexOf(status);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#E36B11]" />
            Mike <span className="text-gray-500 font-normal text-sm">Dev Manager & Product Owner</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={() => {
              navigator.clipboard.writeText('Check Mike-Tickets und arbeite das nächste offene Ticket ab. Zeig mir zuerst was du vorhast.');
              setCascadePromptCopied(true);
              setTimeout(() => setCascadePromptCopied(false), 2000);
            }}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition-colors ${
              cascadePromptCopied 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Copy Cascade prompt to clipboard"
          >
            {cascadePromptCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {cascadePromptCopied ? 'Copied!' : 'Cascade Prompt'}
          </button>
          <button 
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="px-3 py-1.5 bg-[#E36B11] text-white text-sm rounded-lg hover:bg-[#C4772A] flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </button>
          {showNewMenu && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 min-w-[150px]">
              <button
                onClick={() => { setShowManualCreate(true); setShowNewMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" /> Manual
              </button>
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setChatInput('');
                  setShowNewMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
              >
                <Brain className="w-4 h-4 text-[#E36B11]" /> With Mike
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left: Ticket List */}
        <div className="w-80 flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          {/* Search & Filter */}
          <div className="p-3 border-b border-gray-700 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-[#E36B11] outline-none"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2 py-0.5 text-xs rounded ${filterStatus === 'all' ? 'bg-[#E36B11] text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                All {tasks.length}
              </button>
              {['Draft', 'In Progress', 'Testing', 'Review'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2 py-0.5 text-xs rounded ${filterStatus === s ? 'bg-[#E36B11] text-white' : 'bg-gray-700 text-gray-400'}`}
                >
                  {s} {statusCounts[s] || 0}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#E36B11] mx-auto" /></div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No tickets</div>
            ) : (
              filteredTasks.map(task => (
                <div
                  key={task._id}
                  onClick={() => { setSelectedTask(task); setEditMode(false); setActiveTab('overview'); }}
                  className={`p-3 border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/30 transition-colors ${
                    selectedTask?._id === task._id ? 'bg-gray-700/50 border-l-2 border-l-[#E36B11]' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 ${
                      task.priority === 'Critical' ? 'bg-red-500' :
                      task.priority === 'High' ? 'bg-orange-500' :
                      task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          task.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                          task.status === 'In Progress' ? 'bg-[#E36B11]/20 text-[#E36B11]' :
                          task.status === 'Testing' ? 'bg-blue-500/20 text-blue-400' :
                          task.status === 'Draft' ? 'bg-gray-500/20 text-gray-400' :
                          task.status === 'Review' ? 'bg-purple-500/20 text-purple-400' :
                          task.status === 'Approved' ? 'bg-cyan-500/20 text-cyan-400' :
                          'bg-gray-600 text-gray-300'
                        }`}>
                          {task.status}
                        </span>
                        <span className="text-[10px] text-gray-500">{task.category}</span>
                      </div>
                      <p className="text-sm text-white truncate">
                        {task.ticketNumber && <span className="text-[#E36B11] font-mono mr-1">#{task.ticketNumber}</span>}
                        {task.title}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Middle: Ticket Detail */}
        <div className="flex-1 flex flex-col bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          {selectedTask ? (
            <>
              {/* Ticket Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      selectedTask.category.includes('Bug') ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {selectedTask.category.includes('Bug') ? 'BUG' : 'FEATURE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditMode(true); setEditedTask(selectedTask); }} className="p-1.5 hover:bg-gray-700 rounded">
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button onClick={() => deleteTask(selectedTask._id)} className="p-1.5 hover:bg-gray-700 rounded">
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">
                  {selectedTask.ticketNumber && <span className="text-[#E36B11] font-mono mr-2">#{selectedTask.ticketNumber}</span>}
                  {selectedTask.title}
                </h2>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedTask.status}
                    onChange={(e) => updateTask(selectedTask._id, { status: e.target.value })}
                    className={`text-xs px-2 py-1 rounded-lg font-medium border-0 cursor-pointer ${
                      selectedTask.status === 'Completed' ? 'bg-green-500 text-white' :
                      selectedTask.status === 'In Progress' ? 'bg-[#E36B11] text-white' :
                      selectedTask.status === 'Testing' ? 'bg-blue-500 text-white' :
                      selectedTask.status === 'Review' ? 'bg-purple-500 text-white' :
                      selectedTask.status === 'Approved' ? 'bg-cyan-500 text-white' :
                      'bg-gray-600 text-white'
                    }`}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-700">
                {(['overview', 'requirements', 'activity'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium capitalize ${
                      activeTab === tab ? 'text-[#E36B11] border-b-2 border-[#E36B11]' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Description */}
                    <div>
                      <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">Description</h3>
                      <p className="text-sm text-gray-300">{selectedTask.description || 'No description'}</p>
                    </div>

                    {/* Progress Timeline */}
                    <div>
                      <h3 className="text-xs font-medium text-gray-400 uppercase mb-3">Progress</h3>
                      <div className="flex items-center gap-2">
                        {STATUS_FLOW.map((status, i) => {
                          const currentIndex = getStatusIndex(selectedTask.status);
                          const isCompleted = i < currentIndex;
                          const isCurrent = i === currentIndex;
                          const isLastAndCompleted = status === 'Completed' && selectedTask.status === 'Completed';
                          
                          return (
                            <div key={status} className="flex items-center">
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  isCompleted || isLastAndCompleted ? 'bg-green-500' :
                                  isCurrent ? 'bg-[#E36B11]' :
                                  'bg-gray-700'
                                }`}>
                                  {isCompleted || isLastAndCompleted ? (
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                  ) : (
                                    <Circle className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-gray-500'}`} />
                                  )}
                                </div>
                                <span className={`text-[10px] mt-1 ${isLastAndCompleted ? 'text-green-400' : isCurrent ? 'text-[#E36B11]' : 'text-gray-500'}`}>
                                  {status}
                                </span>
                              </div>
                              {i < STATUS_FLOW.length - 1 && (
                                <div className={`w-8 h-0.5 mx-1 ${isCompleted || isLastAndCompleted ? 'bg-green-500' : 'bg-gray-700'}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cascade Progress (if working) */}
                    {cascadeStatus === 'working' && selectedTask && (
                      <div className="bg-[#E36B11]/10 border border-[#E36B11]/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-4 h-4 text-[#E36B11] animate-spin" />
                          <span className="text-[#E36B11] font-medium text-sm">Cascade Working</span>
                          <span className="text-gray-400 text-xs ml-auto">{cascadeStep.current}/{cascadeStep.total}</span>
                        </div>
                        <p className="text-sm text-gray-300 mb-2">{cascadeStep.description}</p>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#E36B11] transition-all duration-500"
                            style={{ width: `${(cascadeStep.current / cascadeStep.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Info: Say "go" to Cascade */}
                    {selectedTask.status !== 'Completed' && selectedTask.status !== 'In Progress' && (
                      <div className="bg-[#E36B11]/10 border border-[#E36B11]/30 rounded-lg p-3 text-center">
                        <p className="text-sm text-[#E36B11]">
                          Say <span className="font-bold">"Ticket #{selectedTask.ticketNumber}, go"</span> to Cascade to start
                        </p>
                      </div>
                    )}
                    {selectedTask.status === 'In Progress' && (
                      <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-3 text-center">
                        <p className="text-sm text-green-400 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Cascade is working on this...
                        </p>
                      </div>
                    )}

                    {/* Approve Button - for Testing tickets */}
                    {selectedTask.status === 'Testing' && (
                      <button
                        onClick={() => updateTask(selectedTask._id, { status: 'Completed' })}
                        className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve & Complete
                      </button>
                    )}

                    {/* Report Issue / Reopen - for Completed or Testing tickets */}
                    {(selectedTask.status === 'Completed' || selectedTask.status === 'Testing') && (
                      <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-4 mt-3">
                        <h4 className="text-sm font-medium text-red-400 mb-2">Report Issue</h4>
                        <textarea
                          placeholder="Describe what's wrong..."
                          className="w-full h-20 p-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 resize-none mb-2"
                          id="issue-feedback"
                        />
                        <button
                          onClick={async () => {
                            const feedback = (document.getElementById('issue-feedback') as HTMLTextAreaElement)?.value;
                            if (!feedback?.trim()) return;
                            
                            // Update ticket with feedback and reopen
                            await updateTask(selectedTask._id, { 
                              status: 'In Progress',
                              notes: `${selectedTask.notes || ''}\n\n--- ISSUE REPORTED ---\n${feedback}\n(${new Date().toLocaleString()})`
                            });
                            
                            // Refresh to show updated ticket
                            fetchTasks();
                            
                            (document.getElementById('issue-feedback') as HTMLTextAreaElement).value = '';
                          }}
                          className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center gap-2 text-sm"
                        >
                          <X className="w-4 h-4" /> Reopen & Report to Mike
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'requirements' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">Mike's Specification</h3>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <p className="text-sm text-gray-300">{selectedTask.aiSuggestions || 'No specification yet'}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">Notes</h3>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <p className="text-sm text-gray-300">{selectedTask.notes || 'No notes'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    {/* Issue Reports from Notes */}
                    {selectedTask.notes && selectedTask.notes.includes('ISSUE REPORTED') && (
                      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <X className="w-4 h-4 text-red-400" />
                          <span className="text-red-400 text-sm font-medium">Issue Reported</span>
                        </div>
                        {selectedTask.notes.split('--- ISSUE REPORTED ---').slice(1).map((issue, i) => (
                          <div key={i} className="bg-gray-900/50 rounded p-2 mb-2">
                            <p className="text-sm text-gray-300 whitespace-pre-wrap">{issue.trim()}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Mike's Response - from aiSuggestions or notes */}
                    {selectedTask.aiSuggestions && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-[#E36B11] rounded-full flex items-center justify-center flex-shrink-0">
                          <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white">Mike <span className="text-gray-500">specification</span></p>
                          <div className="bg-[#E36B11]/10 border border-[#E36B11]/20 rounded-lg p-3 mt-2">
                            <p className="text-sm text-gray-300">{selectedTask.aiSuggestions}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Created */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                        <Plus className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white">Ticket created</p>
                        <p className="text-xs text-gray-500">{new Date(selectedTask.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Original Chat */}
                    {selectedTask.chatHistory && (
                      <details className="bg-gray-900/50 rounded-lg">
                        <summary className="p-3 cursor-pointer text-xs text-gray-500 hover:text-gray-400">
                          Original conversation
                        </summary>
                        <div className="px-3 pb-3">
                          <p className="text-xs text-gray-400 whitespace-pre-wrap">{selectedTask.chatHistory}</p>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a ticket or chat with Mike</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div className="w-64 flex flex-col gap-4">
          {/* Ticket Info */}
          {selectedTask && (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-gray-400 uppercase">Ticket Info</h3>
                {selectedTask.ticketNumber && (
                  <span className="text-[#E36B11] font-mono font-bold text-sm">#{selectedTask.ticketNumber}</span>
                )}
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Priority</span>
                  <span className={PRIORITY_COLORS[selectedTask.priority]}>{selectedTask.priority}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Complexity</span>
                  <span className="text-white">{selectedTask.complexity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. Cost</span>
                  <span className="text-[#E36B11]">~€{COMPLEXITY_COST[selectedTask.complexity] || 75}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="text-white">{selectedTask.category}</span>
                </div>
              </div>
            </div>
          )}

          {/* Chat with Mike - per ticket */}
          <div className="flex-1 bg-gray-800/50 rounded-xl border border-gray-700 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-xs font-medium text-gray-400 uppercase">
                {selectedTask ? `Chat: ${selectedTask.title.slice(0, 20)}...` : 'Chat with Mike'}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {currentChat.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">
                  {selectedTask ? 'Start chatting about this ticket' : 'Tell Mike what you need - he\'ll create a ticket'}
                </p>
              ) : (
                currentChat.map((msg: {role: string; content: string}, i: number) => {
                  // Skip JSON action messages
                  if (msg.content.includes('"action":')) return null;
                  
                  // Check if it's a Cascade message
                  const isCascade = msg.content.includes('[CASCADE]') || msg.content.startsWith('Ich hab deine Nachricht');
                  const displayContent = msg.content.replace('[CASCADE] ', '');
                  
                  return (
                    <div key={i} className={`text-xs p-2 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-[#E36B11]/20 text-[#E36B11] ml-4' 
                        : isCascade
                          ? 'bg-green-600/20 text-green-400 mr-4 border border-green-500/30'
                          : 'bg-gray-700 text-gray-300 mr-4'
                    }`}>
                      {isCascade && <span className="font-bold text-green-500">CASCADE: </span>}
                      {displayContent}
                    </div>
                  );
                })
              )}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {currentChat.some(m => m.content.includes('[CASCADE]')) 
                    ? <span className="text-green-400">Frank is typing...</span>
                    : <span className="text-gray-500">Mike is typing...</span>
                  }
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-2 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={isRecording ? "Listening..." : "Ask Mike..."}
                  className={`flex-1 px-2 py-1.5 bg-gray-900 border rounded text-xs text-white placeholder-gray-500 focus:border-[#E36B11] outline-none ${
                    isRecording ? 'border-red-500 animate-pulse' : 'border-gray-700'
                  }`}
                />
                <button
                  onClick={toggleVoiceInput}
                  className={`p-1.5 rounded transition-colors ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={isRecording ? "Stop recording" : "Voice input"}
                >
                  {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="p-1.5 bg-[#E36B11] text-white rounded hover:bg-[#C4772A] disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Create Modal */}
      {showManualCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#E36B11]" /> New Ticket (Manual)
              </h3>
              <button onClick={() => setShowManualCreate(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={manualTicket.title || ''}
                  onChange={(e) => setManualTicket({ ...manualTicket, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                  placeholder="Feature: Campaign Manager"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Specification</label>
                <textarea
                  value={manualTicket.description || ''}
                  onChange={(e) => setManualTicket({ ...manualTicket, description: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none resize-none"
                  placeholder="Files: ...&#10;UI: ...&#10;Backend: ..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category</label>
                  <select
                    value={manualTicket.category || 'Future Features'}
                    onChange={(e) => setManualTicket({ ...manualTicket, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <select
                    value={manualTicket.priority || 'Medium'}
                    onChange={(e) => setManualTicket({ ...manualTicket, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select
                    value={manualTicket.status || 'Draft'}
                    onChange={(e) => setManualTicket({ ...manualTicket, status: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Complexity</label>
                  <select
                    value={manualTicket.complexity || 'Medium'}
                    onChange={(e) => setManualTicket({ ...manualTicket, complexity: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Very High">Very High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea
                  value={manualTicket.notes || ''}
                  onChange={(e) => setManualTicket({ ...manualTicket, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none resize-none"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button onClick={() => setShowManualCreate(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
                Cancel
              </button>
              <button
                onClick={createManualTicket}
                disabled={!manualTicket.title?.trim() || saving}
                className="px-4 py-2 bg-[#E36B11] text-white text-sm rounded-lg hover:bg-[#C4772A] disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {editMode && editedTask._id && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#E36B11]" /> 
                Edit Ticket {editedTask.ticketNumber && <span className="text-[#E36B11] font-mono">#{editedTask.ticketNumber}</span>}
              </h3>
              <button onClick={() => setEditMode(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={editedTask.title || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Specification</label>
                <textarea
                  value={editedTask.description || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category</label>
                  <select
                    value={editedTask.category || 'Future Features'}
                    onChange={(e) => setEditedTask({ ...editedTask, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <select
                    value={editedTask.priority || 'Medium'}
                    onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select
                    value={editedTask.status || 'Draft'}
                    onChange={(e) => setEditedTask({ ...editedTask, status: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Complexity</label>
                  <select
                    value={editedTask.complexity || 'Medium'}
                    onChange={(e) => setEditedTask({ ...editedTask, complexity: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none"
                  >
                    <option value="Trivial">Trivial</option>
                    <option value="Simple">Simple</option>
                    <option value="Medium">Medium</option>
                    <option value="Complex">Complex</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea
                  value={editedTask.notes || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-[#E36B11] outline-none resize-none"
                />
              </div>
              
              {/* Attachments / Images */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">Attachments</label>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2 mb-2">
                  {(editedTask.attachments || []).map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-700" />
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="w-20 h-20 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-gray-500 hover:border-[#E36B11] hover:text-[#E36B11] transition-colors"
                  >
                    {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">Add screenshots or reference images for Cascade</p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button onClick={() => setEditMode(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editedTask._id) {
                    updateTask(editedTask._id, editedTask);
                    // Also update selectedTask to reflect changes
                    setSelectedTask({ ...selectedTask, ...editedTask } as Task);
                  }
                }}
                disabled={saving}
                className="px-4 py-2 bg-[#E36B11] text-white text-sm rounded-lg hover:bg-[#C4772A] disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
