"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Search, ChevronRight, Sparkles, FileText, Bug, Smartphone, 
  Server, Layout, CreditCard, Gamepad2, FileEdit, Settings, Brain, 
  Rocket, Send, Loader2, Trash2, Edit3, Save, X, RefreshCw,
  MessageCircle, User, Paperclip, Play, Plus, Filter, Clock,
  CheckCircle2, Circle, ArrowRight, MoreHorizontal
} from "lucide-react";

interface ChatMessage {
  role: 'user' | 'mike';
  content: string;
  timestamp: string;
}

interface Task {
  _id: string;
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
  
  // Chat state - per ticket pending messages
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Record<string, ChatMessage[]>>({}); // Per ticket
  const chatEndRef = useRef<HTMLDivElement>(null);
  
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

  useEffect(() => { fetchTasks(); }, []);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat]);

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

  const updateTask = async (id: string, updates: Partial<Task>) => {
    setSaving(true);
    try {
      await fetch(`/api/admin/mike/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchTasks();
      setEditMode(false);
    } catch (error) {
      console.error('Update error:', error);
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
            <Brain className="w-5 h-5 text-[#D4873A]" />
            Mike <span className="text-gray-500 font-normal text-sm">Dev Manager & Product Owner</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setSelectedTask(null);
              setChatInput('');
            }}
            className="px-3 py-1.5 bg-[#D4873A] text-white text-sm rounded-lg hover:bg-[#C4772A] flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </button>
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
                className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-[#D4873A] outline-none"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2 py-0.5 text-xs rounded ${filterStatus === 'all' ? 'bg-[#D4873A] text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                All {tasks.length}
              </button>
              {['Draft', 'In Progress', 'Review'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2 py-0.5 text-xs rounded ${filterStatus === s ? 'bg-[#D4873A] text-white' : 'bg-gray-700 text-gray-400'}`}
                >
                  {s} {statusCounts[s] || 0}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#D4873A] mx-auto" /></div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No tickets</div>
            ) : (
              filteredTasks.map(task => (
                <div
                  key={task._id}
                  onClick={() => { setSelectedTask(task); setEditMode(false); setActiveTab('overview'); }}
                  className={`p-3 border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/30 transition-colors ${
                    selectedTask?._id === task._id ? 'bg-gray-700/50 border-l-2 border-l-[#D4873A]' : ''
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
                          task.status === 'In Progress' ? 'bg-[#D4873A]/20 text-[#D4873A]' :
                          'bg-gray-600 text-gray-300'
                        }`}>
                          {task.status}
                        </span>
                        <span className="text-[10px] text-gray-500">{task.category}</span>
                      </div>
                      <p className="text-sm text-white truncate">{task.title}</p>
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
                <h2 className="text-lg font-semibold text-white mb-2">{selectedTask.title}</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedTask.status}
                    onChange={(e) => updateTask(selectedTask._id, { status: e.target.value })}
                    className={`text-xs px-2 py-1 rounded-lg font-medium border-0 cursor-pointer ${
                      selectedTask.status === 'Completed' ? 'bg-green-500 text-white' :
                      selectedTask.status === 'In Progress' ? 'bg-[#D4873A] text-white' :
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
                      activeTab === tab ? 'text-[#D4873A] border-b-2 border-[#D4873A]' : 'text-gray-400 hover:text-white'
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
                          
                          return (
                            <div key={status} className="flex items-center">
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  isCompleted ? 'bg-green-500' :
                                  isCurrent ? 'bg-[#D4873A]' :
                                  'bg-gray-700'
                                }`}>
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                  ) : (
                                    <Circle className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-gray-500'}`} />
                                  )}
                                </div>
                                <span className={`text-[10px] mt-1 ${isCurrent ? 'text-[#D4873A]' : 'text-gray-500'}`}>
                                  {status}
                                </span>
                              </div>
                              {i < STATUS_FLOW.length - 1 && (
                                <div className={`w-8 h-0.5 mx-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-700'}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cascade Progress (if working) */}
                    {cascadeStatus === 'working' && selectedTask && (
                      <div className="bg-[#D4873A]/10 border border-[#D4873A]/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-4 h-4 text-[#D4873A] animate-spin" />
                          <span className="text-[#D4873A] font-medium text-sm">Cascade Working</span>
                          <span className="text-gray-400 text-xs ml-auto">{cascadeStep.current}/{cascadeStep.total}</span>
                        </div>
                        <p className="text-sm text-gray-300 mb-2">{cascadeStep.description}</p>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#D4873A] transition-all duration-500"
                            style={{ width: `${(cascadeStep.current / cascadeStep.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Start Dev Button - always visible except Completed */}
                    {selectedTask.status !== 'Completed' && cascadeStatus === 'idle' && (
                      <button
                        onClick={() => startCascade(selectedTask)}
                        className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
                      >
                        <Play className="w-4 h-4" /> Start Dev → then say "go" to Cascade
                      </button>
                    )}

                    {/* Report Issue / Reopen - for Completed or Testing tickets */}
                    {(selectedTask.status === 'Completed' || selectedTask.status === 'Testing') && (
                      <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-4">
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
                        <div className="w-8 h-8 bg-[#D4873A] rounded-full flex items-center justify-center flex-shrink-0">
                          <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white">Mike <span className="text-gray-500">specification</span></p>
                          <div className="bg-[#D4873A]/10 border border-[#D4873A]/20 rounded-lg p-3 mt-2">
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
              <h3 className="text-xs font-medium text-gray-400 uppercase mb-3">Ticket Info</h3>
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
                  <span className="text-[#D4873A]">~€{COMPLEXITY_COST[selectedTask.complexity] || 75}</span>
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
                        ? 'bg-[#D4873A]/20 text-[#D4873A] ml-4' 
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
                  placeholder="Ask Mike..."
                  className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:border-[#D4873A] outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="p-1.5 bg-[#D4873A] text-white rounded hover:bg-[#C4772A] disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
