"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, History, CheckCircle, XCircle, Clock, RefreshCw, Edit2, X, Upload, Shield, PenTool, Instagram, Facebook, Linkedin, Globe, MessageSquare, UserPlus, ChevronDown, Check, Play, Pause } from "lucide-react";
import EditorialChatModal from "@/components/admin/EditorialChatModal";

const COUNTRIES = [
  { name: 'American', flag: '🇺🇸' }, { name: 'British', flag: '🇬🇧' }, { name: 'German', flag: '🇩🇪' },
  { name: 'French', flag: '🇫🇷' }, { name: 'Spanish', flag: '🇪🇸' }, { name: 'Italian', flag: '🇮🇹' },
  { name: 'Australian', flag: '🇦🇺' }, { name: 'Canadian', flag: '🇨🇦' }, { name: 'Brazilian', flag: '🇧🇷' },
  { name: 'Japanese', flag: '🇯🇵' }, { name: 'Mexican', flag: '🇲🇽' }, { name: 'Dutch', flag: '🇳🇱' },
  { name: 'Swedish', flag: '🇸🇪' }, { name: 'Norwegian', flag: '🇳🇴' }, { name: 'Polish', flag: '🇵🇱' },
  { name: 'Portuguese', flag: '🇵🇹' }, { name: 'Argentine', flag: '🇦🇷' }, { name: 'Uruguayan', flag: '🇺🇾' },
  { name: 'Irish', flag: '🇮🇪' }, { name: 'Scottish', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' }, { name: 'Welsh', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  { name: 'South Korean', flag: '🇰🇷' }, { name: 'Chinese', flag: '🇨🇳' }, { name: 'Indian', flag: '🇮🇳' },
  { name: 'South African', flag: '🇿🇦' }, { name: 'Russian', flag: '🇷🇺' }, { name: 'Ukrainian', flag: '🇺🇦' },
  { name: 'Greek', flag: '🇬🇷' }, { name: 'Turkish', flag: '🇹🇷' }, { name: 'Swiss', flag: '🇨🇭' },
  { name: 'Austrian', flag: '🇦🇹' }, { name: 'Belgian', flag: '🇧🇪' }, { name: 'Danish', flag: '🇩🇰' },
  { name: 'Finnish', flag: '🇫🇮' }, { name: 'Czech', flag: '🇨🇿' }, { name: 'Hungarian', flag: '🇭🇺' },
  { name: 'Jamaican', flag: '🇯🇲' }, { name: 'Nigerian', flag: '🇳🇬' }, { name: 'Egyptian', flag: '🇪🇬' },
  { name: 'New Zealander', flag: '🇳🇿' }, { name: 'Colombian', flag: '🇨🇴' }, { name: 'Chilean', flag: '🇨🇱' },
];
const ROLES = [
  'Senior Sports Reporter', 'Entertainment Reporter', 'Music Journalist', 'Technology Writer',
  'Culture Editor', 'Lifestyle Reporter', 'Politics Correspondent', 'Gaming Editor',
  'Celebrity Reporter', 'Film & TV Critic', 'Food & Travel Writer', 'History Writer',
  'Fashion Editor', 'Science Reporter', 'Investigative Journalist', 'Photo Editor',
];
const RESPONSIBILITY_OPTIONS = [
  '⚽ Sports', '🥊 Boxing', '🎾 Tennis', '🏀 Basketball', '🏎️ Formula 1', '🏈 American Football',
  '🎵 Music', '🎸 Rock & Metal', '🎤 Pop', '🎧 Hip-Hop & R&B', '🎼 Indie & Alternative',
  '🎬 Movies', '📺 TV Shows', '🎮 Gaming', '💻 Tech', '👗 Fashion',
  '🎭 Culture & Art', '📜 History', '⭐ Celebrities', '🕯️ RIP / Obituaries',
  '🍔 Food', '✈️ Travel', '🌿 Lifestyle', '🏛️ Politics', '📡 Science',
  '🕹️ Anime & Manga', '🏆 GenX Icons',
];
const WRITING_STYLES = [
  'Punchy & Direct', 'Humorous & Witty', 'Analytical & Deep', 'Storytelling & Narrative',
  'Provocative & Bold', 'Nostalgic & Warm', 'Dry & Sardonic', 'Passionate & Enthusiastic',
  'Academic & Formal', 'Conversational & Casual',
];
const PERSONALITIES = [
  'Curious & Open', 'Dry Wit', 'Passionate', 'Sarcastic', 'Warm & Empathetic',
  'Rebellious', 'Intellectual', 'Adventurous', 'Calm & Measured', 'Edgy & Provocative',
];

interface UserData {
  _id: string;
  username: string;
  email: string;
  coins: number;
  bogxCoins?: number;
  wins: number;
  gamesPlayed: number;
  isBot?: boolean;
  botActive?: boolean;
  isAdmin?: boolean;
  isAuthor?: boolean;
  isAIReporter?: boolean;
  countryFlag?: string;
  country?: string;
  avatar?: string;
  displayName?: string;
  bio?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    website?: string;
  };
  createdAt: string;
  // Bot stats
  readArticles?: string[];
  watchedVideos?: string[];
  reactionsCount?: number;
  reactionsByEmoji?: Record<string, number>;
}

interface GameResultItem {
  oderId: string;
  odername: string;
  oderscore: number;
  opponentId: string;
  opponentName: string;
  opponentScore: number;
  result: 'win' | 'loss' | 'draw';
  coinsChange: number;
  timestamp: string;
  cardId?: string;
  cardTopic?: string;
}

export default function UsersTab({ onGoToArticles, userId: adminUserId }: { onGoToArticles?: () => void; userId?: string } = {}) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editorialChatReporter, setEditorialChatReporter] = useState<any | null>(null);
  const [reporterProfiles, setReporterProfiles] = useState<Record<string, any>>({});
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDeletingUsers, setIsDeletingUsers] = useState(false);
  const [isCreatingBots, setIsCreatingBots] = useState(false);
  const [historyModal, setHistoryModal] = useState<{ userId: string; username: string } | null>(null);
  const [historyResults, setHistoryResults] = useState<GameResultItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', role: '', nationality: '', responsibilities: [] as string[], writingStyle: '', personality: '' });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [showRespDropdown, setShowRespDropdown] = useState(false);
  const [togglingBotActive, setTogglingBotActive] = useState<Set<string>>(new Set());
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
    initEditorialTeam();
  }, []);

  // Auto-run bot activity every 30 seconds if any bots are active
  useEffect(() => {
    const activeBots = users.filter(u => u.isBot && u.botActive !== false);
    if (activeBots.length === 0) return;

    const runBotActivity = async () => {
      try {
        await fetch('/api/cron/bot-daily-activity?intensity=normal');
        // Refresh users to see updated stats
        fetchUsers();
      } catch (err) {
        console.error('Bot activity error:', err);
      }
    };

    // Run immediately once, then every 60 seconds for realistic pacing
    runBotActivity();
    const interval = setInterval(runBotActivity, 60000);
    
    return () => clearInterval(interval);
  }, [users.filter(u => u.isBot && u.botActive !== false).length]);

  // Toggle bot active status (play/pause)
  const toggleBotActive = async (userId: string, currentActive: boolean) => {
    setTogglingBotActive(prev => new Set(prev).add(userId));
    try {
      const res = await fetch('/api/admin/bots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: userId, active: !currentActive }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u._id === userId ? { ...u, botActive: !currentActive } : u));
      }
    } catch (err) {
      console.error('Failed to toggle bot:', err);
    } finally {
      setTogglingBotActive(prev => { const n = new Set(prev); n.delete(userId); return n; });
    }
  };

  // Toggle all selected bots
  const toggleSelectedBotsActive = async (active: boolean) => {
    const selectedBots = users.filter(u => selectedUsers.has(u._id) && u.isBot);
    if (selectedBots.length === 0) return;
    
    for (const bot of selectedBots) {
      await toggleBotActive(bot._id, !active);
    }
  };

  const fetchReporterProfiles = async () => {
    try {
      const res = await fetch('/api/editorial/reporters');
      const data = await res.json();
      if (data.success) {
        const map: Record<string, any> = {};
        for (const r of data.reporters) {
          if (r.user?._id) map[r.user._id] = r;
        }
        setReporterProfiles(map);
      }
    } catch { /* silent */ }
  };

  const createEmployee = async () => {
    if (!newEmployee.name.trim() || !newEmployee.role.trim() || !newEmployee.responsibilities.length) {
      alert('Name, Role and at least one Responsibility are required');
      return;
    }
    setCreatingEmployee(true);
    try {
      const payload = { ...newEmployee, responsibilities: newEmployee.responsibilities.join(', ') };
      const res = await fetch('/api/editorial/reporters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateEmployee(false);
        setNewEmployee({ name: '', role: '', nationality: '', responsibilities: [], writingStyle: '', personality: '' });
        setShowRespDropdown(false);
        setSaveSuccessToast(`Employee "${newEmployee.name}" created!`);
        setTimeout(() => setSaveSuccessToast(null), 3000);
        await fetchReporterProfiles();
        fetchUsers();
      } else {
        alert(data.error || 'Failed to create employee');
      }
    } catch {
      alert('Network error');
    } finally {
      setCreatingEmployee(false);
    }
  };

  // Always seeds (idempotent), then loads profiles + refreshes user list
  const initEditorialTeam = async () => {
    try {
      await fetch('/api/editorial/seed', { method: 'POST' });
    } catch { /* silent on network error */ }
    await fetchReporterProfiles();
    fetchUsers();
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  const createBots = async (count: number = 20) => {
    setIsCreatingBots(true);
    try {
      const res = await fetch("/api/admin/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Created ${data.created} bots!`);
        fetchUsers();
      } else {
        alert(data.error || "Failed to create bots");
      }
    } catch (error) {
      console.error("Error creating bots:", error);
    } finally {
      setIsCreatingBots(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleAllUsers = () => {
    const displayUsersFiltered = users.filter(u => !u.isAIReporter);
    if (selectedUsers.size === displayUsersFiltered.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(displayUsersFiltered.map(u => u._id)));
    }
  };

  const deleteSelectedUsers = async () => {
    if (selectedUsers.size === 0) return;
    if (!confirm(`Delete ${selectedUsers.size} selected user(s)? This cannot be undone!`)) return;
    setIsDeletingUsers(true);
    try {
      const userIds = Array.from(selectedUsers);
      await Promise.all(
        userIds.map(userId => fetch(`/api/users/${userId}`, { method: "DELETE" }))
      );
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error) {
      console.error("Error deleting users:", error);
    } finally {
      setIsDeletingUsers(false);
    }
  };

  const fetchUserHistory = async (userId: string, date: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/user-history?userId=${userId}&date=${date}`);
      const data = await res.json();
      if (data.success) {
        setHistoryResults(data.results);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = (userId: string, username: string) => {
    setHistoryModal({ userId, username });
    fetchUserHistory(userId, historyDate);
  };

  const deleteEditingUser = async () => {
    if (!editingUser) return;
    if (editingUser.isAdmin) return; // Never delete admin
    if (!confirm(`Permanently delete user "${editingUser.username}"? This cannot be undone!`)) return;
    setSavingUser(true);
    try {
      const res = await fetch(`/api/users/${editingUser._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEditingUser(null);
        setSaveSuccessToast(`${editingUser.username} deleted`);
        setTimeout(() => setSaveSuccessToast(null), 3000);
        fetchUsers();
      } else {
        alert('Delete failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Delete user error:', e);
      alert('Delete failed');
    } finally {
      setSavingUser(false);
    }
  };

  const saveUserChanges = async () => {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser._id,
          username: editingUser.username,
          email: editingUser.email,
          avatar: editingUser.avatar || '',
          displayName: editingUser.displayName || '',
          bio: editingUser.bio || '',
          isAdmin: !!editingUser.isAdmin,
          isAuthor: !!editingUser.isAuthor,
          socialLinks: editingUser.socialLinks || {},
          newPassword: (editingUser as any).newPassword || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        const userName = editingUser.displayName || editingUser.username;
        await fetchUsers();
        setEditingUser(null);
        setSaveSuccessToast(`${userName} updated successfully`);
        setTimeout(() => setSaveSuccessToast(null), 3000);
      } else {
        alert('Save failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Save user error:', e);
      alert('Save failed');
    } finally {
      setSavingUser(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingUser) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.url) {
        setEditingUser({ ...editingUser, avatar: data.url });
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Avatar upload error:', e);
      alert('Upload failed');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Filter out AI reporters - they are managed in the Conference tab
  const displayUsers = users.filter(u => !u.isAIReporter);
  
  const totalCoins = displayUsers.reduce((sum, u) => sum + (u.bogxCoins || u.coins || 0), 0);
  const totalWins = displayUsers.reduce((sum, u) => sum + (u.wins || 0), 0);
  const totalGames = displayUsers.reduce((sum, u) => sum + (u.gamesPlayed || 0), 0);
  const totalLost = totalGames - totalWins;
  const totalArticles = displayUsers.reduce((sum, u) => sum + (u.readArticles?.length || 0), 0);
  const totalVideos = displayUsers.reduce((sum, u) => sum + (u.watchedVideos?.length || 0), 0);
  // Sum reactions by emoji type
  const totalReactions = {
    '❤️': displayUsers.reduce((sum, u) => sum + (u.reactionsByEmoji?.['❤️'] || 0), 0),
    '😂': displayUsers.reduce((sum, u) => sum + (u.reactionsByEmoji?.['😂'] || 0), 0),
    '😮': displayUsers.reduce((sum, u) => sum + (u.reactionsByEmoji?.['😮'] || 0), 0),
    '😢': displayUsers.reduce((sum, u) => sum + (u.reactionsByEmoji?.['😢'] || 0), 0),
    '😡': displayUsers.reduce((sum, u) => sum + (u.reactionsByEmoji?.['😡'] || 0), 0),
    '👏': displayUsers.reduce((sum, u) => sum + (u.reactionsByEmoji?.['👏'] || 0), 0),
  };
  const botCount = displayUsers.filter(u => u.isBot).length;
  const realUserCount = displayUsers.length - botCount;

  return (
    <>
      {/* Success Toast */}
      {saveSuccessToast && (
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg shadow-xl animate-in slide-in-from-top">
          <CheckCircle className="w-4 h-4" />
          {saveSuccessToast}
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold">Users ({displayUsers.length})</h2>
            <p className="text-[11px] text-gray-400">
              {realUserCount} real · {botCount} bots · <span className="text-yellow-400">{totalCoins.toFixed(2)} coins</span> · <span className="text-green-400">{totalWins} won</span> · <span className="text-red-400">{totalLost} lost</span> · <span className="text-blue-400">{totalArticles} articles</span> · <span className="text-purple-400">{totalVideos} videos</span> · {totalReactions['❤️'] > 0 && <span>❤️{totalReactions['❤️']} </span>}{totalReactions['😂'] > 0 && <span>😂{totalReactions['😂']} </span>}{totalReactions['😮'] > 0 && <span>😮{totalReactions['😮']} </span>}{totalReactions['😢'] > 0 && <span>😢{totalReactions['😢']} </span>}{totalReactions['😡'] > 0 && <span>😡{totalReactions['😡']} </span>}{totalReactions['👏'] > 0 && <span>👏{totalReactions['👏']}</span>}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => fetchUsers()}
              className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={() => createBots(20)}
              disabled={isCreatingBots}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {isCreatingBots ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '🤖'}
              Create 20 Bots
            </button>
            {selectedUsers.size > 0 && (
              <>
                {/* Play/Pause selected bots */}
                {users.some(u => selectedUsers.has(u._id) && u.isBot) && (
                  <>
                    <button
                      onClick={() => toggleSelectedBotsActive(true)}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      title="Start all selected bots"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Play Bots
                    </button>
                    <button
                      onClick={() => toggleSelectedBotsActive(false)}
                      className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      title="Pause all selected bots"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      Pause Bots
                    </button>
                  </>
                )}
                <button
                  onClick={deleteSelectedUsers}
                  disabled={isDeletingUsers}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isDeletingUsers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete ({selectedUsers.size})
                </button>
              </>
            )}
          </div>
        </div>

        {usersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700 text-[11px] uppercase tracking-wider">
                  <th className="pb-2 pr-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onChange={toggleAllUsers}
                      className="rounded"
                    />
                  </th>
                  <th className="pb-2 font-medium">Username</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 text-right font-medium">Coins</th>
                  <th className="pb-2 text-right font-medium">Won</th>
                  <th className="pb-2 text-right font-medium">Lost</th>
                  <th className="pb-2 text-right font-medium">Articles</th>
                  <th className="pb-2 text-right font-medium">Videos</th>
                  <th className="pb-2 font-medium">Reactions</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Joined</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.map((user) => (
                  <tr key={user._id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user._id)}
                        onChange={() => toggleUserSelection(user._id)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-2 font-medium">
                      <div className="flex items-center gap-2">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.username} className="w-6 h-6 rounded-full object-cover border border-gray-600" />
                        ) : (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#E36B11 0%,#a86b2b 100%)' }}>
                            {user.username[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col leading-tight">
                          <span>{user.displayName || user.username}</span>
                          {reporterProfiles[user._id] ? (
                            <span className="text-[9px] text-blue-400">
                              {reporterProfiles[user._id].specialty ||
                               reporterProfiles[user._id].responsibilities?.split(',').slice(0, 2).join(' ·') ||
                               reporterProfiles[user._id].role}
                            </span>
                          ) : user.displayName ? (
                            <span className="text-[9px] text-gray-500">@{user.username}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-gray-400">{user.email || '-'}</td>
                    <td className="py-2 text-right text-yellow-400">{(user.bogxCoins || user.coins || 0).toFixed(2)}</td>
                    <td className="py-2 text-right text-green-400">{user.wins || 0}</td>
                    <td className="py-2 text-right text-red-400">{(user.gamesPlayed || 0) - (user.wins || 0)}</td>
                    <td className="py-2 text-right text-blue-400">{user.readArticles?.length || 0}</td>
                    <td className="py-2 text-right text-purple-400">{user.watchedVideos?.length || 0}</td>
                    <td className="py-2">
                      {user.reactionsByEmoji && Object.keys(user.reactionsByEmoji).length > 0 ? (
                        <div className="flex items-center gap-1 text-[10px]">
                          {user.reactionsByEmoji['❤️'] && <span title="Love">❤️{user.reactionsByEmoji['❤️']}</span>}
                          {user.reactionsByEmoji['😂'] && <span title="Laugh">😂{user.reactionsByEmoji['😂']}</span>}
                          {user.reactionsByEmoji['😮'] && <span title="Wow">😮{user.reactionsByEmoji['😮']}</span>}
                          {user.reactionsByEmoji['😢'] && <span title="Sad">😢{user.reactionsByEmoji['😢']}</span>}
                          {user.reactionsByEmoji['😡'] && <span title="Angry">😡{user.reactionsByEmoji['😡']}</span>}
                          {user.reactionsByEmoji['👏'] && <span title="Clap">👏{user.reactionsByEmoji['👏']}</span>}
                        </div>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {user.isBot ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">Bot</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Real</span>
                        )}
                        {user.isAdmin && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400" title="Admin">Admin</span>
                        )}
                        {user.isAuthor && !reporterProfiles[user._id] && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E36B11]/20 text-[#E36B11]" title="Author">Author</span>
                        )}
                        {reporterProfiles[user._id] && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold" title="AI Reporter">AI</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-gray-400 text-[11px]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-0.5">
                        {/* Play/Pause for bots */}
                        {user.isBot && (
                          <button
                            onClick={() => toggleBotActive(user._id, user.botActive !== false)}
                            disabled={togglingBotActive.has(user._id)}
                            className={`p-1 rounded transition-colors ${
                              user.botActive !== false
                                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                : 'bg-gray-600/50 text-gray-500 hover:bg-gray-600'
                            }`}
                            title={user.botActive !== false ? 'Bot is playing - click to pause' : 'Bot is paused - click to play'}
                          >
                            {togglingBotActive.has(user._id) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : user.botActive !== false ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-[#E36B11]"
                          title="Edit user / author profile"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openHistoryModal(user._id, user.username)}
                          className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                          title="View game history"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {reporterProfiles[user._id] && (
                          <button
                            onClick={() => setEditorialChatReporter(reporterProfiles[user._id])}
                            className="p-1 hover:bg-gray-600 rounded text-[#E36B11] hover:text-[#E36B11]/80"
                            title="Editorial Chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold">Game History: {historyModal.username}</h3>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => {
                    setHistoryDate(e.target.value);
                    fetchUserHistory(historyModal.userId, e.target.value);
                  }}
                  className="bg-gray-700 px-3 py-1.5 rounded text-sm"
                />
                <button
                  onClick={() => setHistoryModal(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : historyResults.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No games on this date</div>
              ) : (
                <div className="space-y-2">
                  {historyResults.map((result, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg flex items-center justify-between ${
                        result.result === 'win' ? 'bg-green-500/10 border border-green-500/30' :
                        result.result === 'loss' ? 'bg-red-500/10 border border-red-500/30' :
                        'bg-gray-700/50 border border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {result.result === 'win' ? <CheckCircle className="w-5 h-5 text-green-400" /> :
                         result.result === 'loss' ? <XCircle className="w-5 h-5 text-red-400" /> :
                         <Clock className="w-5 h-5 text-gray-400" />}
                        <div>
                          <div className="font-medium">
                            vs {result.opponentName}
                          </div>
                          <div className="text-sm text-gray-400">
                            {result.oderscore} - {result.opponentScore}
                            {result.cardTopic && <span className="ml-2">· {result.cardTopic}</span>}
                          </div>
                        </div>
                      </div>
                      <div className={`font-bold ${result.coinsChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {result.coinsChange >= 0 ? '+' : ''}{result.coinsChange}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gray-800 z-10 p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#E36B11]" />
                Edit User: {editingUser.username}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Avatar Section */}
              <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg">
                {editingUser.avatar ? (
                  <img src={editingUser.avatar} alt={editingUser.username} className="w-20 h-20 rounded-full object-cover border-2 border-[#E36B11]" />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-[#E36B11]" style={{ background: 'linear-gradient(135deg,#E36B11 0%,#a86b2b 100%)' }}>
                    {editingUser.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-2">Avatar</label>
                  <div className="flex gap-2">
                    <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="px-3 py-2 bg-[#E36B11] hover:bg-[#c06a2a] disabled:opacity-50 text-white text-sm rounded-lg font-medium inline-flex items-center gap-2"
                    >
                      {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload
                    </button>
                    {editingUser.avatar && (
                      <button
                        onClick={() => setEditingUser({ ...editingUser, avatar: '' })}
                        className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Or paste URL below</p>
                  <input
                    type="url"
                    value={editingUser.avatar || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, avatar: e.target.value })}
                    placeholder="https://..."
                    className="w-full mt-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs"
                  />
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                    className="w-full bg-gray-700 px-3 py-2 rounded text-sm border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-gray-700 px-3 py-2 rounded text-sm border border-gray-600"
                  />
                </div>
              </div>

              {/* Password Change */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">New Password (leave empty to keep current)</label>
                <input
                  type="password"
                  value={(editingUser as any).newPassword || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, newPassword: e.target.value } as any)}
                  placeholder="Enter new password..."
                  className="w-full bg-gray-700 px-3 py-2 rounded text-sm border border-gray-600"
                />
              </div>

              {/* Author Profile */}
              <div className="p-4 bg-[#E36B11]/5 border border-[#E36B11]/20 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <PenTool className="w-4 h-4 text-[#E36B11]" />
                  <span className="text-sm font-bold text-[#E36B11]">Author Profile</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Display Name (used as Author Name on articles)</label>
                    <input
                      type="text"
                      value={editingUser.displayName || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                      placeholder={editingUser.username}
                      maxLength={60}
                      className="w-full bg-gray-700 px-3 py-2 rounded text-sm border border-gray-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Bio</label>
                    <textarea
                      value={editingUser.bio || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, bio: e.target.value })}
                      placeholder="Tell readers about this author..."
                      maxLength={500}
                      rows={3}
                      className="w-full bg-gray-700 px-3 py-2 rounded text-sm border border-gray-600 resize-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1 text-right">{(editingUser.bio || '').length}/500</p>
                  </div>

                  {/* Social Links */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Social Links</label>
                    <div className="space-y-2">
                      <SocialInput
                        icon={<Facebook className="w-4 h-4 text-[#1877F2]" />}
                        placeholder="https://facebook.com/username"
                        value={editingUser.socialLinks?.facebook || ''}
                        onChange={(v) => setEditingUser({ ...editingUser, socialLinks: { ...editingUser.socialLinks, facebook: v } })}
                      />
                      <SocialInput
                        icon={<Instagram className="w-4 h-4 text-[#E4405F]" />}
                        placeholder="https://instagram.com/username"
                        value={editingUser.socialLinks?.instagram || ''}
                        onChange={(v) => setEditingUser({ ...editingUser, socialLinks: { ...editingUser.socialLinks, instagram: v } })}
                      />
                      <SocialInput
                        icon={<Linkedin className="w-4 h-4 text-[#0A66C2]" />}
                        placeholder="https://linkedin.com/in/username"
                        value={editingUser.socialLinks?.linkedin || ''}
                        onChange={(v) => setEditingUser({ ...editingUser, socialLinks: { ...editingUser.socialLinks, linkedin: v } })}
                      />
                      <SocialInput
                        icon={<Globe className="w-4 h-4 text-gray-400" />}
                        placeholder="https://yourwebsite.com"
                        value={editingUser.socialLinks?.website || ''}
                        onChange={(v) => setEditingUser({ ...editingUser, socialLinks: { ...editingUser.socialLinks, website: v } })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-bold text-gray-300">Permissions</span>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2 bg-gray-700/50 rounded hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editingUser.isAdmin}
                      onChange={(e) => setEditingUser({ ...editingUser, isAdmin: e.target.checked })}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-red-400">Admin</div>
                      <div className="text-xs text-gray-400">Full access to admin panel — includes Author rights</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-2 rounded cursor-pointer ${editingUser.isAdmin ? 'bg-gray-700/20 opacity-50' : 'bg-gray-700/50 hover:bg-gray-700'}`}>
                    <input
                      type="checkbox"
                      checked={!!editingUser.isAuthor || !!editingUser.isAdmin}
                      disabled={!!editingUser.isAdmin}
                      onChange={(e) => setEditingUser({ ...editingUser, isAuthor: e.target.checked })}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#E36B11]">Author</div>
                      <div className="text-xs text-gray-400">
                        {editingUser.isAdmin
                          ? 'Automatically granted via Admin role'
                          : 'Can write and publish articles (without full admin access)'}
                      </div>
                    </div>
                  </label>
                </div>

                <p className="mt-2 text-[10px] text-gray-500 italic">
                  Admin → can do everything. Author → can only write articles. Both → write articles.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-800 p-4 border-t border-gray-700 flex justify-between gap-3">
              <div>
                {!editingUser.isAdmin && (
                  <button
                    onClick={deleteEditingUser}
                    disabled={savingUser}
                    className="px-4 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium text-sm rounded-lg inline-flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove User
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingUser(null)}
                  disabled={savingUser}
                  className="px-5 py-2.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={saveUserChanges}
                  disabled={savingUser || uploadingAvatar}
                  className="px-5 py-2.5 bg-[#E36B11] hover:bg-[#c06a2a] disabled:opacity-50 text-white font-bold text-sm rounded-lg inline-flex items-center gap-2"
                >
                  {savingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editorial Chat Modal */}
      {editorialChatReporter && (
        <EditorialChatModal
          reporter={editorialChatReporter}
          onClose={() => setEditorialChatReporter(null)}
          onGoToArticles={onGoToArticles}
        />
      )}


      {/* Create Employee Modal */}
      {showCreateEmployee && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateEmployee(false)} />
          <div className="relative w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-green-400" />
                <span className="font-bold text-white">Create Employee</span>
              </div>
              <button onClick={() => setShowCreateEmployee(false)} className="w-7 h-7 rounded-full hover:bg-gray-700 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {/* Name */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Name *</label>
                <input
                  value={newEmployee.name}
                  onChange={e => setNewEmployee(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Lisa Müller"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
              </div>
              {/* Nationality dropdown with flags */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Nationality</label>
                <div className="relative">
                  <select
                    value={newEmployee.nationality}
                    onChange={e => setNewEmployee(p => ({ ...p, nationality: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 appearance-none pr-8"
                  >
                    <option value="">— Select nationality</option>
                    {COUNTRIES.map(c => (
                      <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {/* Role dropdown */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Role *</label>
                <div className="relative">
                  <select
                    value={newEmployee.role}
                    onChange={e => setNewEmployee(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 appearance-none pr-8"
                  >
                    <option value="">— Select role</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {/* Responsibilities multi-select */}
              <div className="relative">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Responsibilities * <span className="text-gray-500 normal-case font-normal">(select all that apply)</span></label>
                <button
                  type="button"
                  onClick={() => setShowRespDropdown(p => !p)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:border-green-500 flex items-center justify-between gap-2"
                >
                  <span className={newEmployee.responsibilities.length ? 'text-white' : 'text-gray-500'}>
                    {newEmployee.responsibilities.length
                      ? newEmployee.responsibilities.join(', ')
                      : '— Select topics'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${showRespDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showRespDropdown && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 p-2 gap-0.5">
                      {RESPONSIBILITY_OPTIONS.map(opt => {
                        const selected = newEmployee.responsibilities.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setNewEmployee(p => ({
                              ...p,
                              responsibilities: selected
                                ? p.responsibilities.filter(r => r !== opt)
                                : [...p.responsibilities, opt],
                            }))}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                              selected ? 'bg-green-600/30 text-green-300' : 'hover:bg-gray-600 text-gray-300'
                            }`}
                          >
                            {selected ? <Check className="w-3 h-3 flex-shrink-0" /> : <span className="w-3 h-3 flex-shrink-0" />}
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {/* Writing Style dropdown */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Writing Style</label>
                <div className="relative">
                  <select
                    value={newEmployee.writingStyle}
                    onChange={e => setNewEmployee(p => ({ ...p, writingStyle: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 appearance-none pr-8"
                  >
                    <option value="">— Select writing style</option>
                    {WRITING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {/* Personality dropdown */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Personality</label>
                <div className="relative">
                  <select
                    value={newEmployee.personality}
                    onChange={e => setNewEmployee(p => ({ ...p, personality: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 appearance-none pr-8"
                  >
                    <option value="">— Select personality</option>
                    {PERSONALITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setShowCreateEmployee(false)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createEmployee}
                disabled={creatingEmployee}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {creatingEmployee ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {creatingEmployee ? 'Creating...' : 'Create Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SocialInput({ icon, placeholder, value, onChange }: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 bg-gray-700/50 border border-gray-600 rounded px-2 py-1">
      <span className="flex-shrink-0">{icon}</span>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
      />
    </div>
  );
}
