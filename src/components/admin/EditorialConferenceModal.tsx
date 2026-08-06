"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Send, CheckCircle, AlertCircle, Users, FileText, ChevronDown, RotateCcw, Trash2, MessageSquare } from "lucide-react";

type TaskType = '' | 'article' | 'rankroll' | 'menschen' | 'tv';

const TASK_OPTIONS: { value: TaskType; label: string; color: string }[] = [
  { value: 'article',   label: '📝 Article',   color: 'text-blue-400' },
  { value: 'rankroll',  label: '🏆 Rankroll',  color: 'text-yellow-400' },
  { value: 'menschen',  label: '👤 Menschen',  color: 'text-purple-400' },
  { value: 'tv',        label: '📺 TV Clips',  color: 'text-red-400' },
];

type ReporterStatus = 'idle' | 'writing' | 'done' | 'error';

interface Reporter {
  _id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface EditorialConferenceModalProps {
  reporters: Reporter[];
  reporterProfiles: Record<string, any>;
  userId: string;
  onClose: () => void;
  onGoToArticles?: () => void;
  onOpenReporterChat?: (reporter: Reporter) => void;
}

export default function EditorialConferenceModal({
  reporters,
  reporterProfiles,
  userId,
  onClose,
  onGoToArticles,
  onOpenReporterChat,
}: EditorialConferenceModalProps) {
  const aiReporters = reporters.filter(r => r._id);

  const [assignments, setAssignments] = useState<Record<string, string>>(
    Object.fromEntries(aiReporters.map(r => [r._id, '']))
  );
  const [taskTypes, setTaskTypes] = useState<Record<string, TaskType>>(
    Object.fromEntries(aiReporters.map(r => [r._id, '']))
  );
  const [campaignTopic, setCampaignTopic] = useState('');
  const [conferenceType, setConferenceType] = useState<'campaign'>('campaign'); // more types coming later
  const [statuses, setStatuses] = useState<Record<string, ReporterStatus>>({});
  const [resultLabels, setResultLabels] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [lastSession, setLastSession] = useState<any>(null);
  const [deletingSession, setDeletingSession] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'run'>('list');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // Track created IDs per reporter for session save
  const [createdIds, setCreatedIds] = useState<Record<string, { articleId?: string; pollId?: string; tvVideoIds?: string[] }>>({});
  // Store the reporter's actual reply text when task needs follow-up
  const [reporterReplies, setReporterReplies] = useState<Record<string, string>>({});

  const loadSessions = () =>
    fetch('/api/editorial/conference?list=true')
      .then(r => r.json())
      .then(d => { if (d.success) setSessions(d.sessions || []); })
      .catch(() => {});

  const restoreSession = (s: any) => {
    setLastSession(s);
    if (s.campaignTopic) setCampaignTopic(s.campaignTopic);
    const ra: Record<string, string> = {};
    const rt: Record<string, TaskType> = {};
    const rs: Record<string, ReporterStatus> = {};
    const rl: Record<string, string> = {};
    for (const r of (s.results || [])) {
      ra[r.reporterUserId] = r.message || '';
      rt[r.reporterUserId] = r.taskType || '';
      rs[r.reporterUserId] = r.status === 'done' ? 'done' : 'error';
      rl[r.reporterUserId] = r.resultLabel || '';
    }
    setAssignments(prev => ({ ...prev, ...ra }));
    setTaskTypes(prev => ({ ...prev, ...rt }));
    setStatuses(prev => ({ ...prev, ...rs }));
    setResultLabels(prev => ({ ...prev, ...rl }));
    setDoneCount(s.results?.filter((r: any) => r.status === 'done').length || 0);
    setView('run');
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // Poll running sessions every 4 seconds
  useEffect(() => {
    const hasRunning = sessions.some(s => s.status === 'running');
    if (!hasRunning) return;
    const t = setInterval(loadSessions, 4000);
    return () => clearInterval(t);
  }, [sessions]);

  const setStatus = (id: string, s: ReporterStatus) => setStatuses(prev => ({ ...prev, [id]: s }));

  const activeCount = aiReporters.filter(r => {
    const msg = assignments[r._id]?.trim() || campaignTopic.trim();
    const type = taskTypes[r._id];
    return !!msg && !!type;
  }).length;

  // Reporters that will receive briefing (no task, but campaign topic exists)
  const briefingCount = campaignTopic.trim()
    ? aiReporters.filter(r => !taskTypes[r._id]).length
    : 0;

  // 'confirmed' | 'question' per unassigned reporter
  const [briefingStatuses, setBriefingStatuses] = useState<Record<string, 'briefing' | 'confirmed' | 'question'>>({});
  const [briefingReplies, setBriefingReplies] = useState<Record<string, string>>({});

  // ── task runners ──────────────────────────────────────────────────────────

  async function runArticle(reporter: Reporter, msg: string): Promise<boolean> {
    const res = await fetch('/api/editorial/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterUserId: reporter._id,
        message: `Write an article about: ${msg}. Include a YouTube CTA with an iconic clip, a Rankroll CTA so readers can vote, and make sure there is an imageSearchTerm for a great cover image. Go ahead and draft it.`,
        userId,
      }),
    });
    const data = await res.json();
    if (data.articleDraftId) {
      setCreatedIds(prev => ({ ...prev, [reporter._id]: { articleId: data.articleDraftId } }));
      setResultLabels(prev => ({ ...prev, [reporter._id]: 'Draft saved' }));
      return true;
    }
    const reply = data.message || 'No draft created';
    setResultLabels(prev => ({ ...prev, [reporter._id]: reply.slice(0, 50) }));
    setReporterReplies(prev => ({ ...prev, [reporter._id]: reply }));
    return false;
  }

  function detectCategory(topic: string): string {
    const t = topic.toLowerCase();
    if (/movie|film|actor|actress|cinema|director|oscar|hollywood|serie|tv show|screen/i.test(t)) return 'movies-tv';
    if (/music|song|band|album|singer|concert|track|artist|guitar|drum/i.test(t)) return 'music';
    if (/sport|football|soccer|basketball|boxing|tennis|athlete|champion|league/i.test(t)) return 'sports';
    if (/game|gaming|console|playstation|xbox|nintendo|arcade|esport/i.test(t)) return 'gaming';
    if (/tech|computer|software|internet|app|gadget|phone|digital/i.test(t)) return 'tech';
    if (/history|war|politic|president|revolution|ancient|century|historic/i.test(t)) return 'history';
    if (/rip|died|death|obituary|memorial|legend|passed away/i.test(t)) return 'rip';
    if (/food|travel|lifestyle|fashion|style|living|culture/i.test(t)) return 'lifestyle';
    if (/icon|celebrity|star|genx|generation x/i.test(t)) return 'genx-icons';
    return 'culture';
  }

  async function runRankroll(reporter: Reporter, msg: string): Promise<boolean> {
    // 1. Generate ranking JSON
    const genRes = await fetch('/api/generate-ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: msg }),
    });
    const genData = await genRes.json();
    if (!genData.success || !genData.ranking) {
      setResultLabels(prev => ({ ...prev, [reporter._id]: genData.error || 'Generation failed' }));
      return false;
    }

    const ranking = genData.ranking;
    // 2. Save as Poll (type: ranking)
    const saveRes = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ranking',
        title: ranking.title,
        subtitle: ranking.subtitle || '',
        description: ranking.description || '',
        image: ranking.image || '',
        items: (ranking.items || []).map((item: any, i: number) => ({
          id: `item_${i}`,
          title: item.title,
          description: item.description || '',
          image: item.image || '',
          upvotes: 0,
          downvotes: 0,
        })),
        category: 'ranking',
        status: 'active',
        featured: false,
        closesAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    const saveData = await saveRes.json();
    if (saveData.success) {
      setCreatedIds(prev => ({ ...prev, [reporter._id]: { pollId: saveData.poll?._id } }));
      setResultLabels(prev => ({ ...prev, [reporter._id]: `Rankroll "${ranking.title?.slice(0, 30)}" saved` }));
      return true;
    }
    setResultLabels(prev => ({ ...prev, [reporter._id]: saveData.error || 'Save failed' }));
    return false;
  }

  async function runTV(reporter: Reporter, msg: string): Promise<boolean> {
    // Always exactly 3 clips — positions 1, 2, 3
    const res = await fetch('/api/editorial/tv-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: msg, count: 3, featuredStart: 1, category: 'Action' }),
    });
    const data = await res.json();
    if (data.success) {
      const tvIds = (data.videos || []).map((v: any) => v._id).filter(Boolean);
      setCreatedIds(prev => ({ ...prev, [reporter._id]: { tvVideoIds: tvIds } }));
      setResultLabels(prev => ({ ...prev, [reporter._id]: `${data.saved} clips added to TV` }));
      return true;
    }
    setResultLabels(prev => ({ ...prev, [reporter._id]: data.error || 'TV search failed' }));
    return false;
  }

  async function runMenschen(reporter: Reporter, msg: string): Promise<boolean> {
    // Parse count from message e.g. "20 Irish people from Ireland"
    const countMatch = msg.match(/\b(\d+)\b/);
    const count = countMatch ? parseInt(countMatch[1]) : 10;

    const res = await fetch('/api/almanac/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'people', skipDuplicateCheck: false, hint: msg, count }),
    });
    const data = await res.json();
    if (data.success) {
      const n = data.saved ?? data.items?.length ?? count;
      setResultLabels(prev => ({ ...prev, [reporter._id]: `${n} Menschen saved` }));
      return true;
    }
    setResultLabels(prev => ({ ...prev, [reporter._id]: data.error || 'Failed' }));
    return false;
  }

  async function runBriefing(reporter: Reporter, topic: string): Promise<void> {
    setBriefingStatuses(prev => ({ ...prev, [reporter._id]: 'briefing' }));
    try {
      const res = await fetch('/api/editorial/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterUserId: reporter._id,
          message: `CAMPAIGN BRIEF: ${topic}. You are not assigned a specific task for this campaign. Please confirm you have read this brief by replying with a short acknowledgement, or ask a question if something is unclear.`,
          userId,
        }),
      });
      const data = await res.json();
      const reply: string = data.message || '';
      const hasQuestion = /\?|unclear|what|which|how|could you|can you|please clarify/i.test(reply);
      setBriefingStatuses(prev => ({ ...prev, [reporter._id]: hasQuestion ? 'question' : 'confirmed' }));
      setBriefingReplies(prev => ({ ...prev, [reporter._id]: reply }));
    } catch {
      setBriefingStatuses(prev => ({ ...prev, [reporter._id]: 'question' }));
    }
  }

  // ── main runner ───────────────────────────────────────────────────────────

  const runConference = async () => {
    if (!activeCount || running) return;
    setRunning(true);
    setDoneCount(0);
    setView('run');

    // Create session in DB at start
    let sessionId = activeSessionId;
    try {
      const createRes = await fetch('/api/editorial/conference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignTopic, conferenceType, status: 'running' }),
      });
      const createData = await createRes.json();
      if (createData.success) {
        sessionId = createData.session._id;
        setActiveSessionId(sessionId);
        setLastSession(createData.session);
        setSessions(prev => [createData.session, ...prev]);
      }
    } catch { /* continue anyway */ }

    let created = 0;

    for (const reporter of aiReporters) {
      const msg = assignments[reporter._id]?.trim() || campaignTopic.trim();
      const type: TaskType = taskTypes[reporter._id];
      // Skip reporters with no task type selected or no message
      if (!msg || !type) continue;

      setStatus(reporter._id, 'writing');
      try {
        let ok = false;
        if (type === 'article') ok = await runArticle(reporter, msg);
        else if (type === 'rankroll') ok = await runRankroll(reporter, msg);
        else if (type === 'menschen') ok = await runMenschen(reporter, msg);
        else if (type === 'tv') ok = await runTV(reporter, msg);

        const reporterStatus = ok ? 'done' : 'error';
        setStatus(reporter._id, reporterStatus);
        if (ok) created++;

        // Persist result to DB live
        if (sessionId) {
          fetch('/api/editorial/conference', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              result: {
                reporterUserId: reporter._id,
                reporterName: reporter.displayName || reporter.username,
                taskType: type,
                message: msg,
                status: reporterStatus,
                resultLabel: resultLabels[reporter._id] || '',
                ...(createdIds[reporter._id] || {}),
              },
            }),
          }).catch(() => {});
        }
      } catch (err: any) {
        setStatus(reporter._id, 'error');
        setResultLabels(prev => ({ ...prev, [reporter._id]: err?.message || 'Network error' }));
      }
    }

    // Mark session as completed/partial in DB
    if (sessionId) {
      const finalStatus = created === activeCount ? 'completed' : created > 0 ? 'partial' : 'running';
      fetch('/api/editorial/conference', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, status: finalStatus }),
      }).then(() => loadSessions()).catch(() => {});
    }

    // Send briefing to unassigned reporters in parallel
    if (campaignTopic.trim()) {
      const unassigned = aiReporters.filter(r => !taskTypes[r._id]);
      await Promise.all(unassigned.map(r => runBriefing(r, campaignTopic.trim())));
    }

    setDoneCount(created);
    setRunning(false);

  };

  const deleteAndRedo = async () => {
    if (!lastSession || deletingSession) return;
    setDeletingSession(true);
    try {
      await fetch(`/api/editorial/conference?id=${lastSession._id}`, { method: 'DELETE' });
      // Pre-fill form with last session's topic
      setCampaignTopic(lastSession.campaignTopic || '');
      // Restore assignments and task types from last session
      const newAssignments: Record<string, string> = {};
      const newTaskTypes: Record<string, TaskType> = {};
      for (const result of (lastSession.results || [])) {
        newAssignments[result.reporterUserId] = result.message || '';
        newTaskTypes[result.reporterUserId] = result.taskType || 'article';
      }
      setAssignments(prev => ({ ...prev, ...newAssignments }));
      setTaskTypes(prev => ({ ...prev, ...newTaskTypes }));
      setStatuses({});
      setResultLabels({});
      setCreatedIds({});
      setDoneCount(0);
      setLastSession(null);
    } finally {
      setDeletingSession(false);
    }
  };

  const anyDone = doneCount > 0 && !running;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#E36B11]" />
              <h2 className="text-white font-bold text-base">Editorial Conference</h2>
              <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{aiReporters.length} reporters</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded"><X className="w-4 h-4" /></button>
          </div>

          {/* Campaign block — only in run view */}
          <div className={`bg-gray-800/80 border border-[#E36B11]/30 rounded-xl p-3 ${view === 'list' ? 'hidden' : ''}`}>
            <label className="text-[10px] text-[#E36B11] uppercase tracking-wider font-bold mb-2 block">
              Subject — sent as context to all reporters
            </label>
            <div className="flex gap-2">
              <select
                value={conferenceType}
                onChange={e => setConferenceType(e.target.value as 'campaign')}
                disabled={running}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-[#E36B11] disabled:opacity-50"
              >
                <option value="campaign">🎯 Campaign</option>
                {/* more types coming: Design, Event, … */}
              </select>
              <input
                type="text"
                value={campaignTopic}
                onChange={e => setCampaignTopic(e.target.value)}
                disabled={running}
                placeholder="e.g. Brad Pitt"
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E36B11] disabled:opacity-50"
              />
            </div>
            <p className="text-[9px] text-gray-500 mt-1.5">Assign each reporter a role below — 📝 Article · 🏆 Rankroll · 📺 TV Clips · 👤 Menschen</p>
          </div>
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <button
              onClick={() => { setView('run'); setLastSession(null); setStatuses({}); setResultLabels({}); setCampaignTopic(''); setTaskTypes(Object.fromEntries(aiReporters.map(r => [r._id, '' as TaskType]))); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#E36B11] hover:bg-[#c07830] text-white text-sm font-bold rounded-xl transition-colors mb-3"
            >
              <Send className="w-4 h-4" /> New Conference
            </button>

            {sessions.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">No conferences yet. Start one above.</p>
            )}

            {sessions.map((s: any) => {
              const doneN = s.results?.filter((r: any) => r.status === 'done').length || 0;
              const total = s.results?.length || 0;
              return (
                <button
                  key={s._id}
                  onClick={() => restoreSession(s)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-gray-700 hover:border-[#E36B11]/50 bg-gray-800/60 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs font-bold truncate">{s.campaignTopic || '—'}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        s.status === 'running' ? 'bg-orange-500/20 text-orange-400 animate-pulse' :
                        s.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        s.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {s.status === 'running' ? '⚡ Running' : s.status === 'completed' ? '✅ Done' : s.status === 'partial' ? '⚠ Partial' : s.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(s.createdAt).toLocaleString()} · {doneN}/{total} tasks done
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 -rotate-90 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* RUN VIEW */}
        {view === 'run' && (
        <>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* Last session banner */}
          {lastSession && !running && doneCount === 0 && (
            <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2">
              <div className="text-xs text-yellow-300">
                <span className="font-bold">Last campaign:</span> {lastSession.campaignTopic}
                <span className="text-gray-500 ml-2">· {new Date(lastSession.createdAt).toLocaleString()}</span>
              </div>
              <button
                onClick={deleteAndRedo}
                disabled={deletingSession}
                className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
              >
                {deletingSession ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Delete & Redo
              </button>
            </div>
          )}

          {/* Individual assignments */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 block">
              Individual assignments (override global)
            </label>
            <div className="space-y-2">
              {aiReporters.map(reporter => {
                const profile = reporterProfiles[reporter._id];
                const specialty = profile?.specialty || profile?.role || 'journalist';
                const status = statuses[reporter._id];
                const isDone = status === 'done';
                const isErr = status === 'error';
                const isWorking = status === 'writing';

                return (
                  <div key={reporter._id} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    isDone ? 'border-green-500/40 bg-green-500/5' :
                    isErr  ? 'border-red-500/40 bg-red-500/5' :
                    isWorking ? 'border-[#E36B11]/40 bg-[#E36B11]/5' :
                    'border-gray-700/50 bg-gray-800/50'
                  }`}>
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {reporter.avatar ? (
                        <img src={reporter.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#E36B11]/20 flex items-center justify-center text-[#E36B11] text-xs font-bold">
                          {(reporter.displayName || reporter.username)[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="w-24 flex-shrink-0">
                      <div className="text-[11px] text-white font-medium truncate">{reporter.displayName || reporter.username}</div>
                      <div className="text-[9px] text-blue-400 truncate">{specialty}</div>
                    </div>

                    {/* Task type dropdown */}
                    {!isWorking && !isDone && !isErr && (
                      <select
                        value={taskTypes[reporter._id] || ''}
                        onChange={e => setTaskTypes(prev => ({ ...prev, [reporter._id]: e.target.value as TaskType }))}
                        disabled={running}
                        className={`bg-gray-700 border rounded px-1.5 py-1 text-[10px] text-white focus:outline-none focus:border-[#E36B11] disabled:opacity-40 flex-shrink-0 ${
                          taskTypes[reporter._id] ? 'border-gray-600' : 'border-gray-500 text-gray-400'
                        }`}
                      >
                        <option value="">— Select task</option>
                        {TASK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}

                    {/* Briefing status for unassigned reporters */}
                    {!taskTypes[reporter._id] && briefingStatuses[reporter._id] === 'briefing' && (
                      <div className="flex-1 flex items-center gap-2 text-[11px] text-gray-400">
                        <Loader2 className="w-3 h-3 animate-spin" /> Reading brief…
                      </div>
                    )}
                    {!taskTypes[reporter._id] && briefingStatuses[reporter._id] === 'confirmed' && (
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                          <CheckCircle className="w-3 h-3 text-gray-500" /> Confirmed
                        </div>
                        {briefingReplies[reporter._id] && (
                          <p className="text-[10px] text-gray-500 italic line-clamp-1 pl-4">
                            &ldquo;{briefingReplies[reporter._id].slice(0, 80)}&rdquo;
                          </p>
                        )}
                      </div>
                    )}
                    {!taskTypes[reporter._id] && briefingStatuses[reporter._id] === 'question' && (
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-orange-400">
                          <AlertCircle className="w-3 h-3" /> Has a question
                        </div>
                        {briefingReplies[reporter._id] && (
                          <p className="text-[10px] text-orange-300/70 italic line-clamp-1 pl-4">
                            &ldquo;{briefingReplies[reporter._id].slice(0, 80)}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {/* Status or input */}
                    {isWorking ? (
                      <div className="flex-1 flex items-center gap-2 text-[11px] text-[#E36B11]">
                        <Loader2 className="w-3 h-3 animate-spin" /> Working…
                      </div>
                    ) : isDone ? (
                      <div className="flex-1 flex items-center gap-2 text-[11px] text-green-400">
                        <CheckCircle className="w-3 h-3" /> {resultLabels[reporter._id] || 'Done'}
                      </div>
                    ) : isErr ? (
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-red-400">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{resultLabels[reporter._id]?.slice(0, 50) || 'Error'}</span>
                        </div>
                        {reporterReplies[reporter._id] && (
                          <p className="text-[10px] text-gray-400 italic line-clamp-2 pl-4">
                            💬 &ldquo;{reporterReplies[reporter._id].slice(0, 120)}&rdquo;
                          </p>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={assignments[reporter._id] || ''}
                        onChange={e => setAssignments(prev => ({ ...prev, [reporter._id]: e.target.value }))}
                        disabled={running}
                        placeholder={campaignTopic.trim() ? `Using campaign: ${campaignTopic.slice(0, 20)}…` : 'Topic / instruction…'}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E36B11] disabled:opacity-40"
                      />
                    )}

                    {/* Chat button — always available, highlighted on error */}
                    {onOpenReporterChat && (
                      <button
                        onClick={() => onOpenReporterChat(reporter)}
                        title="Open chat with this reporter"
                        className={`flex-shrink-0 p-1.5 rounded transition-colors ${
                          isErr || briefingStatuses[reporter._id] === 'question'
                            ? 'text-orange-400 bg-orange-500/20 hover:bg-orange-500/30 animate-pulse'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between gap-3">
          {anyDone ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
              <FileText className="w-4 h-4" />
              {doneCount} task{doneCount !== 1 ? 's' : ''} completed
            </div>
          ) : (
            <span className="text-[11px] text-gray-500">
              {activeCount > 0 ? `${activeCount} reporter${activeCount !== 1 ? 's' : ''} assigned` : 'Set a campaign subject or add individual topics'}
            </span>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setView('list')}
              className="px-3 py-2 text-gray-400 hover:text-white text-xs border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
            >
              ← All
            </button>
            {anyDone && onGoToArticles && (
              <button
                onClick={() => { onClose(); onGoToArticles(); }}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition-colors"
              >
                Go to Articles →
              </button>
            )}
            <button
              onClick={runConference}
              disabled={running || !activeCount}
              className="flex items-center gap-2 px-4 py-2 bg-[#E36B11] hover:bg-[#c06a2a] disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {running ? 'Working…' : anyDone ? 'Run Again' : 'Start Conference'}
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
