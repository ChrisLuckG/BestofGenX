"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, History, CheckCircle, XCircle, Clock, RefreshCw, Edit2, X, Upload, Shield, PenTool, Instagram, Facebook, Linkedin, Globe } from "lucide-react";

interface UserData {
  _id: string;
  username: string;
  email: string;
  coins: number;
  wins: number;
  gamesPlayed: number;
  isBot?: boolean;
  isAdmin?: boolean;
  isAuthor?: boolean;
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

export default function UsersTab() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
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
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

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
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u._id)));
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

  const totalCoins = users.reduce((sum, u) => sum + (u.coins || 0), 0);
  const totalWins = users.reduce((sum, u) => sum + (u.wins || 0), 0);
  const totalGames = users.reduce((sum, u) => sum + (u.gamesPlayed || 0), 0);
  const botCount = users.filter(u => u.isBot).length;
  const realUserCount = users.length - botCount;

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
            <h2 className="text-sm font-bold">Users ({users.length})</h2>
            <p className="text-[11px] text-gray-400">
              {realUserCount} real · {botCount} bots · {totalCoins.toLocaleString()} total coins · {totalWins} wins · {totalGames} games
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
              <button
                onClick={deleteSelectedUsers}
                disabled={isDeletingUsers}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isDeletingUsers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete ({selectedUsers.size})
              </button>
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
                  <th className="pb-2 text-right font-medium">Wins</th>
                  <th className="pb-2 text-right font-medium">Games</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Joined</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
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
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#D4873A 0%,#a86b2b 100%)' }}>
                            {user.username[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col leading-tight">
                          <span>{user.displayName || user.username}</span>
                          {user.displayName && <span className="text-[9px] text-gray-500">@{user.username}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-gray-400">{user.email || '-'}</td>
                    <td className="py-2 text-right">{(user.coins || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-green-400">{user.wins || 0}</td>
                    <td className="py-2 text-right">{user.gamesPlayed || 0}</td>
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
                        {user.isAuthor && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D4873A]/20 text-[#D4873A]" title="Author">Author</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-gray-400 text-[11px]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-[#D4873A]"
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
                <Edit2 className="w-4 h-4 text-[#D4873A]" />
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
                  <img src={editingUser.avatar} alt={editingUser.username} className="w-20 h-20 rounded-full object-cover border-2 border-[#D4873A]" />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-[#D4873A]" style={{ background: 'linear-gradient(135deg,#D4873A 0%,#a86b2b 100%)' }}>
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
                      className="px-3 py-2 bg-[#D4873A] hover:bg-[#c06a2a] disabled:opacity-50 text-white text-sm rounded-lg font-medium inline-flex items-center gap-2"
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
              <div className="p-4 bg-[#D4873A]/5 border border-[#D4873A]/20 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <PenTool className="w-4 h-4 text-[#D4873A]" />
                  <span className="text-sm font-bold text-[#D4873A]">Author Profile</span>
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
                      <div className="text-sm font-medium text-[#D4873A]">Author</div>
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
            <div className="sticky bottom-0 bg-gray-800 p-4 border-t border-gray-700 flex justify-end gap-3">
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
                className="px-5 py-2.5 bg-[#D4873A] hover:bg-[#c06a2a] disabled:opacity-50 text-white font-bold text-sm rounded-lg inline-flex items-center gap-2"
              >
                {savingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
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
