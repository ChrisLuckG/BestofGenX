"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Search, ChevronRight, Sparkles, FileText, Bug, Smartphone, 
  Server, Layout, CreditCard, Gamepad2, FileEdit, Settings, Brain, 
  Rocket, Send, Loader2, Trash2, Edit3, Save, X, RefreshCw,
  MessageCircle, Ticket, User, Paperclip, Play, ArrowUp, ArrowDown, Copy, Check
} from "lucide-react";

interface ChatMessage {
  role: 'user' | 'mike';
  content: string;
  image?: string; // base64 image
}

interface Task {
  _id: string;
  title: string;
  description: string;
  originalRequest: string;
  chatHistory: string;
  category: string;
  priority: string;
  status: string;
  complexity: string;
  notes: string;
  aiSuggestions: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  queueOrder?: number;
}

const CATEGORIES = [
  // App Areas
  'Feed/Welcome Reel', 'Arcade', 'Shop', 'Rankings', 'Articles', 'Battles', 'Trivia', 'Predictions', 'TV', 'Radio', 'Profile',
  // Technical
  'UI/UX', 'Bug Fix', 'Mobile', 'Desktop', 'Backend', 'Frontend', 'Payments', 'Gamification', 'Content', 'Admin', 'AI', 'System Prompt', 'Future Features'
];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low', 'Future Idea'];
const STATUSES = ['Draft', 'Ready for Review', 'Approved', 'Backlog', 'In Progress', 'Waiting for Budget', 'Testing', 'Completed', 'Rejected'];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  // App Areas
  'Feed/Welcome Reel': <Play className="w-3 h-3" />,
  'Arcade': <Gamepad2 className="w-3 h-3" />,
  'Shop': <CreditCard className="w-3 h-3" />,
  'Rankings': <Sparkles className="w-3 h-3" />,
  'Articles': <FileText className="w-3 h-3" />,
  'Battles': <Gamepad2 className="w-3 h-3" />,
  'Trivia': <Gamepad2 className="w-3 h-3" />,
  'Predictions': <Sparkles className="w-3 h-3" />,
  'TV': <Layout className="w-3 h-3" />,
  'Radio': <Layout className="w-3 h-3" />,
  'Profile': <User className="w-3 h-3" />,
  // Technical
  'UI/UX': <Layout className="w-3 h-3" />,
  'Bug Fix': <Bug className="w-3 h-3" />,
  'Mobile': <Smartphone className="w-3 h-3" />,
  'Desktop': <Layout className="w-3 h-3" />,
  'Backend': <Server className="w-3 h-3" />,
  'Frontend': <Layout className="w-3 h-3" />,
  'Payments': <CreditCard className="w-3 h-3" />,
  'Gamification': <Gamepad2 className="w-3 h-3" />,
  'Content': <FileEdit className="w-3 h-3" />,
  'Admin': <Settings className="w-3 h-3" />,
  'AI': <Brain className="w-3 h-3" />,
  'System Prompt': <FileText className="w-3 h-3" />,
  'Future Features': <Rocket className="w-3 h-3" />,
};

const STATUS_COLORS: Record<string, string> = {
  'Draft': 'bg-gray-600 text-gray-200',
  'Ready for Review': 'bg-blue-600 text-white',
  'Approved': 'bg-green-600 text-white',
  'Backlog': 'bg-purple-600 text-white',
  'In Progress': 'bg-[#D4873A] text-white',
  'Waiting for Budget': 'bg-yellow-600 text-white',
  'Testing': 'bg-cyan-600 text-white',
  'Completed': 'bg-emerald-600 text-white',
  'Rejected': 'bg-red-600 text-white',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Critical': 'bg-red-500',
  'High': 'bg-orange-500',
  'Medium': 'bg-yellow-500',
  'Low': 'bg-blue-500',
  'Future Idea': 'bg-purple-500',
};

export default function MikeTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'mike', content: "Bug, Feature oder Idee?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<Partial<Task> | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [editMode, setEditMode] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);
  
  // Queue for Cascade
  const [queue, setQueue] = useState<string[]>([]); // Task IDs in order
  const [queueStatus, setQueueStatus] = useState<'idle' | 'waiting' | 'feedback'>('idle');
  const [cascadeFeedback, setCascadeFeedback] = useState<string>('');

  useEffect(() => { fetchTasks(); }, []);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/admin/mike/tasks');
      const data = await res.json();
      if (data.success) setTasks(data.tasks);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const sendMessage = async () => {
    if ((!chatInput.trim() && !pendingImage) || chatLoading) return;
    
    const userMessage = chatInput.trim();
    const imageToSend = pendingImage;
    setChatInput('');
    setPendingImage(null);
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage || '[Bild]', image: imageToSend || undefined }]);
    setChatLoading(true);
    
    try {
      const res = await fetch('/api/admin/mike/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          image: imageToSend,
          history: chatMessages,
          pendingTicket 
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'mike', content: data.response }]);
        if (data.ticket) {
          setPendingTicket(data.ticket);
        }
      }
    } catch (e) { 
      console.error(e);
      setChatMessages(prev => [...prev, { role: 'mike', content: "Fehler. Nochmal versuchen?" }]);
    }
    finally { setChatLoading(false); }
  };

  const createTicket = async () => {
    if (!pendingTicket) return;
    setSaving(true);
    try {
      const chatHistoryText = chatMessages.map(m => `${m.role === 'user' ? 'You' : 'Mike'}: ${m.content}`).join('\n');
      // Collect all images from chat as attachments for Cascade
      const attachments = chatMessages.filter(m => m.image).map(m => m.image as string);
      const res = await fetch('/api/admin/mike/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingTicket, chatHistory: chatHistoryText, attachments }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks([data.task, ...tasks]);
        setChatMessages([
          { role: 'mike', content: `Ticket "${data.task.title}" created! Ready for the next one, or want to review the backlog?` }
        ]);
        setPendingTicket(null);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/mike/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(tasks.map(t => t._id === taskId ? data.task : t));
        setSelectedTask(data.task);
        setEditMode(false);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await fetch(`/api/admin/mike/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t._id !== taskId));
      setSelectedTask(null);
    } catch (e) { console.error(e); }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: tasks.filter(t => t.status === s).length }), {} as Record<string, number>);

  // Queue functions
  const addToQueue = (taskId: string) => {
    if (!queue.includes(taskId)) {
      setQueue([...queue, taskId]);
    }
  };

  const removeFromQueue = (taskId: string) => {
    setQueue(queue.filter(id => id !== taskId));
  };

  const moveInQueue = (taskId: string, direction: 'up' | 'down') => {
    const idx = queue.indexOf(taskId);
    if (idx === -1) return;
    const newQueue = [...queue];
    if (direction === 'up' && idx > 0) {
      [newQueue[idx], newQueue[idx - 1]] = [newQueue[idx - 1], newQueue[idx]];
    } else if (direction === 'down' && idx < queue.length - 1) {
      [newQueue[idx], newQueue[idx + 1]] = [newQueue[idx + 1], newQueue[idx]];
    }
    setQueue(newQueue);
  };

  // Cost estimation
  const COMPLEXITY_HOURS: Record<string, number> = {
    'Trivial': 0.25, 'Simple': 0.5, 'Medium': 1.5, 'Complex': 4, 'Epic': 12
  };
  const HOUR_RATE = 50;

  const getEstimate = (complexity: string) => {
    const hours = COMPLEXITY_HOURS[complexity] || 1;
    return { hours, cost: hours * HOUR_RATE };
  };

  const requestEstimates = async () => {
    setQueueStatus('waiting');
    setCascadeFeedback('Cascade analysiert...');
    
    try {
      const res = await fetch('/api/admin/mike/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tasks: queuedTasks.map(t => ({
            id: t._id,
            title: t.title,
            description: t.description,
            category: t.category,
            complexity: t.complexity,
            aiSuggestions: t.aiSuggestions,
          }))
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setCascadeFeedback(data.estimate);
        setQueueStatus('feedback');
      } else {
        setCascadeFeedback('Fehler bei der Schätzung. Nochmal versuchen?');
        setQueueStatus('idle');
      }
    } catch (e) {
      console.error(e);
      setCascadeFeedback('Fehler bei der Schätzung.');
      setQueueStatus('idle');
    }
  };

  const copyQueueForCascade = async () => {
    setQueueStatus('waiting');
    setCascadeFeedback(`🚀 Sending to Cascade...`);
    
    try {
      // Write to cascade-queue.json so Cascade can see it
      const res = await fetch('/api/admin/mike/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pending',
          tasks: queuedTasks.map(t => ({
            id: t._id,
            title: t.title,
            description: t.description,
            category: t.category,
            priority: t.priority,
            complexity: t.complexity,
            aiSuggestions: t.aiSuggestions,
            attachments: t.attachments || [],
          })),
        }),
      });
      
      if (res.ok) {
        setCascadeFeedback(`🚀 Queue sent! Cascade is working on ${queue.length} ticket(s)...`);
        // Poll for completion
        pollForCompletion();
      }
    } catch (e) {
      console.error(e);
      setCascadeFeedback('Error sending to Cascade');
      setQueueStatus('idle');
    }
  };
  
  const triggerMikeReview = async (queueData: any) => {
    try {
      // Mike (GPT) reviews what Cascade built
      const res = await fetch('/api/admin/mike/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: queueData.tasks[0],
          cascadeReport: queueData.cascadeReport,
        }),
      });
      
      const data = await res.json();
      
      if (data.approved) {
        setCascadeFeedback(`✅ Mike: "${data.message}"\n\nTicket → Completed`);
        setQueueStatus('feedback');
        // Update ticket status
        if (queueData.tasks[0]?.id) {
          await fetch(`/api/admin/mike/tasks/${queueData.tasks[0].id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Completed' }),
          });
        }
        // Clear queue
        await fetch('/api/admin/mike/queue', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'idle', response: data.message }),
        });
        fetchTasks();
      } else {
        setCascadeFeedback(`⚠️ Mike: "${data.message}"\n\nBraucht Nacharbeit.`);
      }
    } catch (e) {
      console.error('Mike review error:', e);
      setCascadeFeedback('Mike Review fehlgeschlagen');
    }
  };

  const pollForCompletion = async () => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/admin/mike/queue');
        const data = await res.json();
        
        if (data.status === 'completed') {
          setCascadeFeedback(data.response || '✅ Done!');
          setQueueStatus('feedback');
          fetchTasks();
        } else if (data.status === 'review') {
          // Cascade finished, Mike needs to review
          const report = data.cascadeReport || {};
          const reviewMsg = `🔍 REVIEW NEEDED\n\nCascade hat gebaut:\n- Files: ${(report.filesCreated || []).join(', ')}\n- Modified: ${(report.filesModified || []).join(', ')}\n- Zeit: ${report.timeSpent || 0} min\n- Kosten: ~${report.cost || 0}€\n\nMike prüft jetzt...`;
          setCascadeFeedback(reviewMsg);
          // Trigger Mike review via API
          triggerMikeReview(data);
        } else if (data.status === 'working') {
          // Show progress
          const progress = `🔧 Step ${data.currentStep}/${data.totalSteps}: ${data.stepDescription}\n⏱️ ~${data.estimatedMinutes - data.spentMinutes} min remaining`;
          setCascadeFeedback(progress);
          setTimeout(checkStatus, 2000);
        } else if (data.status === 'pending') {
          setCascadeFeedback('⏳ Waiting for Cascade to start...');
          setTimeout(checkStatus, 2000);
        } else {
          setQueueStatus('idle');
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkStatus();
  };

  const queuedTasks = queue.map(id => tasks.find(t => t._id === id)).filter(Boolean) as Task[];

  return (
    <div className="space-y-4">
      {/* Chat Section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-3 border-b border-gray-700 flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#D4873A]" />
          <span className="font-medium text-white">Mike</span>
          <span className="text-xs text-gray-400">- Dev Manager & Product Owner</span>
        </div>
        
        {/* Chat Messages */}
        <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-900/50">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'mike' && (
                <div className="w-7 h-7 rounded-full bg-[#D4873A]/20 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-[#D4873A]" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user' 
                  ? 'bg-[#D4873A] text-white' 
                  : 'bg-gray-800 text-gray-200 border border-gray-700'
              }`}>
                {msg.image && <img src={msg.image} alt="" className="max-h-32 rounded mb-2" />}
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          ))}
          {chatLoading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-[#D4873A]/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-[#D4873A]" />
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#D4873A]" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        {/* Pending Ticket Preview */}
        {pendingTicket && (
          <div className="p-3 bg-[#D4873A]/10 border-t border-[#D4873A]/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[#D4873A] text-sm font-medium">
                <Ticket className="w-4 h-4" />
                Ready to create ticket
              </div>
              <button
                onClick={createTicket}
                disabled={saving}
                className="px-3 py-1 bg-[#D4873A] text-white text-xs rounded-lg hover:bg-[#C4772A] disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
            <div className="text-sm text-white font-medium">{pendingTicket.title}</div>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{pendingTicket.category}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{pendingTicket.priority}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{pendingTicket.complexity}</span>
            </div>
          </div>
        )}
        
        {/* Pending Image Preview */}
        {pendingImage && (
          <div className="p-2 border-t border-gray-700 bg-gray-900/50">
            <div className="flex items-center gap-2">
              <img src={pendingImage} alt="Upload" className="h-16 rounded-lg" />
              <button onClick={() => setPendingImage(null)} className="p-1 text-gray-400 hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Chat Input */}
        <div className="p-3 border-t border-gray-700 flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-400"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Frag Mike..."
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-[#D4873A] outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={(!chatInput.trim() && !pendingImage) || chatLoading}
            className="px-4 py-2 bg-[#D4873A] text-white rounded-lg hover:bg-[#C4772A] disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cascade Queue */}
      {queue.length > 0 && (
        <div className={`border rounded-xl p-3 ${queueStatus === 'waiting' ? 'bg-yellow-900/30 border-yellow-700' : 'bg-green-900/30 border-green-700'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`flex items-center gap-2 text-sm font-medium ${queueStatus === 'waiting' ? 'text-yellow-400' : 'text-green-400'}`}>
              {queueStatus === 'waiting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {queueStatus === 'waiting' ? 'Waiting for Cascade...' : `Cascade Queue (${queue.length})`}
            </div>
            {queueStatus === 'idle' && (
              <div className="flex gap-2">
                <button
                  onClick={requestEstimates}
                  className="px-3 py-1 bg-yellow-600 text-white text-xs rounded-lg hover:bg-yellow-500 flex items-center gap-1"
                >
                  💰 Get Estimates
                </button>
                <button
                  onClick={copyQueueForCascade}
                  className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-500 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> GO - Start Dev
                </button>
              </div>
            )}
            {queueStatus === 'waiting' && (
              <button
                onClick={() => { setQueueStatus('idle'); setCascadeFeedback(''); }}
                className="px-3 py-1 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
            )}
          </div>
          
          {/* Progress Display - Compact */}
          {queueStatus === 'waiting' && cascadeFeedback && (
            <div className="p-3 bg-gray-900/80 rounded-lg border border-[#D4873A]/20">
              {(() => {
                const stepMatch = cascadeFeedback.match(/Step (\d+)\/(\d+)/);
                const currentStep = stepMatch ? parseInt(stepMatch[1]) : 1;
                const totalSteps = stepMatch ? parseInt(stepMatch[2]) : 1;
                const progress = Math.min((currentStep / totalSteps) * 100, 95); // Never show 100% while working
                const stepDesc = cascadeFeedback.split(':')[1]?.split('\n')[0]?.trim() || 'Working...';
                
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-[#D4873A] animate-spin" />
                        <span className="text-white text-sm">{stepDesc}</span>
                      </div>
                      <span className="text-[#D4873A] text-xs font-mono">{currentStep}/{totalSteps}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#D4873A] to-[#E5A55A] transition-all duration-700"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Feedback Result - Compact */}
          {queueStatus === 'feedback' && cascadeFeedback && (
            <div className="p-3 bg-green-900/20 rounded-lg border border-green-600/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm font-medium">Done</span>
                </div>
                <button
                  onClick={() => { setQueueStatus('idle'); setCascadeFeedback(''); setQueue([]); fetchTasks(); }}
                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500"
                >
                  Clear
                </button>
              </div>
              <p className="text-gray-400 text-xs mt-2 line-clamp-2">{cascadeFeedback}</p>
            </div>
          )}
          
          {queueStatus === 'idle' && (
            <>
              <div className="space-y-1">
                {queuedTasks.map((task, i) => {
                  const est = getEstimate(task.complexity);
                  return (
                    <div key={task._id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-2 py-1">
                      <span className="text-green-400 font-bold text-sm w-5">{i + 1}</span>
                      <span className="text-white text-sm flex-1 truncate">{task.title}</span>
                      <span className="text-yellow-400 text-xs">~{est.cost}€</span>
                      <button onClick={() => moveInQueue(task._id, 'up')} className="p-1 text-gray-400 hover:text-white"><ArrowUp className="w-3 h-3" /></button>
                      <button onClick={() => moveInQueue(task._id, 'down')} className="p-1 text-gray-400 hover:text-white"><ArrowDown className="w-3 h-3" /></button>
                      <button onClick={() => removeFromQueue(task._id)} className="p-1 text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-green-700/50 flex justify-between text-sm">
                <span className="text-gray-400">Total Estimate:</span>
                <span className="text-yellow-400 font-bold">~{queuedTasks.reduce((sum, t) => sum + getEstimate(t.complexity).cost, 0)}€</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['Draft', 'Backlog', 'In Progress', 'Testing', 'Completed'].map(s => (
          <div key={s} className="bg-gray-800 rounded-lg px-3 py-2 min-w-[80px]">
            <div className="text-lg font-bold text-white">{counts[s] || 0}</div>
            <div className="text-[10px] text-gray-400 truncate">{s}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-[#D4873A] outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-[#D4873A] outline-none"
        >
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={fetchTasks} className="p-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Task List - Accordion Style */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#D4873A] mx-auto" /></div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No tasks yet. Chat with Mike to create one!</div>
        ) : (
          filteredTasks.map(task => (
            <div key={task._id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              {/* Ticket Header - Always visible */}
              <div
                onClick={() => setSelectedTask(selectedTask?._id === task._id ? null : task)}
                className={`p-4 cursor-pointer transition-all hover:bg-gray-750 ${
                  selectedTask?._id === task._id ? 'bg-gray-750 border-b border-gray-700' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-lg ${PRIORITY_COLORS[task.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-lg ${STATUS_COLORS[task.status]}`}>
                        {task.status}
                      </span>
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        {CATEGORY_ICONS[task.category]} {task.category}
                      </span>
                      <span className="text-[10px] text-gray-600">•</span>
                      <span className="text-[10px] text-gray-500">{task.complexity}</span>
                    </div>
                    <h3 className="text-sm font-medium text-white">{task.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {queue.includes(task._id) ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg">
                        Queue #{queue.indexOf(task._id) + 1}
                      </span>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); addToQueue(task._id); }}
                        className="p-2 text-gray-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                        title="Add to Cascade Queue"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${selectedTask?._id === task._id ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </div>
              
              {/* Expanded Details */}
              {selectedTask?._id === task._id && (
                <div className="p-4 bg-gray-900/50 space-y-4">
                  {/* Quick Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setEditMode(true); setEditedTask(task); }}
                        className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs rounded-lg hover:bg-gray-600 flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button 
                        onClick={() => deleteTask(task._id)}
                        className="px-3 py-1.5 bg-red-500/10 text-red-400 text-xs rounded-lg hover:bg-red-500/20 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                    {!queue.includes(task._id) && (
                      <button 
                        onClick={() => addToQueue(task._id)}
                        className="px-3 py-1.5 bg-green-500/10 text-green-400 text-xs rounded-lg hover:bg-green-500/20 flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Add to Queue
                      </button>
                    )}
                  </div>

                  {/* Edit Mode */}
                  {editMode && selectedTask._id === task._id ? (
                    <div className="space-y-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                      <input
                        value={editedTask.title || ''}
                        onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                        className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                        placeholder="Title"
                      />
                      <textarea
                        value={editedTask.description || ''}
                        onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                        className="w-full h-20 p-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white resize-none"
                        placeholder="Description"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <select value={editedTask.status || ''} onChange={(e) => setEditedTask({ ...editedTask, status: e.target.value })} className="p-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white">
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={editedTask.priority || ''} onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })} className="p-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white">
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select value={editedTask.category || ''} onChange={(e) => setEditedTask({ ...editedTask, category: e.target.value })} className="p-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white">
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditMode(false)} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs rounded-lg">Cancel</button>
                        <button onClick={() => updateTask(task._id, editedTask)} disabled={saving} className="px-3 py-1.5 bg-[#D4873A] text-white text-xs rounded-lg flex items-center gap-1">
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Specification Section */}
                      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                        <div className="text-[10px] text-[#D4873A] font-medium mb-2 uppercase tracking-wider">📋 Specification</div>
                        <p className="text-sm text-gray-300 mb-3">{task.description || 'No description provided'}</p>
                        
                        {/* Meta Info */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-gray-900/50 rounded-lg p-2">
                            <div className="text-gray-500 text-[10px]">Priority</div>
                            <div className={`font-medium ${task.priority === 'Critical' ? 'text-red-400' : task.priority === 'High' ? 'text-orange-400' : 'text-gray-300'}`}>{task.priority}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-2">
                            <div className="text-gray-500 text-[10px]">Complexity</div>
                            <div className="text-gray-300 font-medium">{task.complexity}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-2">
                            <div className="text-gray-500 text-[10px]">Est. Cost</div>
                            <div className="text-[#D4873A] font-medium">~{getEstimate(task.complexity).cost}€</div>
                          </div>
                        </div>
                      </div>

                      {/* Mike's Understanding */}
                      {task.aiSuggestions && (
                        <div className="bg-[#D4873A]/10 rounded-lg p-3 border border-[#D4873A]/20">
                          <div className="text-[10px] text-[#D4873A] font-medium mb-2 uppercase tracking-wider flex items-center gap-1">
                            <Brain className="w-3 h-3" /> Mike's Notes
                          </div>
                          <p className="text-sm text-[#D4873A]/80">{task.aiSuggestions}</p>
                        </div>
                      )}

                      {/* UI/Technical Details - Mike should fill this */}
                      <div className="bg-blue-900/10 rounded-lg p-3 border border-blue-500/20">
                        <div className="text-[10px] text-blue-400 font-medium mb-2 uppercase tracking-wider flex items-center gap-1">
                          <Layout className="w-3 h-3" /> UI & Technical Details
                        </div>
                        <p className="text-sm text-blue-300/70 italic">
                          {task.notes || 'Ask Mike for more details about UI components, screens affected, and technical requirements.'}
                        </p>
                      </div>

                      {/* Original Chat - Collapsed */}
                      {task.chatHistory && (
                        <details className="bg-gray-800 rounded-lg border border-gray-700">
                          <summary className="p-3 cursor-pointer text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" /> Original Chat
                          </summary>
                          <div className="px-3 pb-3">
                            <p className="text-xs text-gray-400 whitespace-pre-wrap">{task.chatHistory}</p>
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
