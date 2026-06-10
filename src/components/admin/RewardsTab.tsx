"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react";

interface RewardData {
  _id?: string;
  name: string;
  description: string;
  longDescription?: string;
  cost: number;
  partner?: string;
  icon?: string;
  category: string;
  image?: string;
  howToRedeem?: string;
  terms?: string;
  active: boolean;
  stock?: number;
}

const REWARD_CATEGORIES = [
  'starter',
  'standard',
  'premium',
];

export default function RewardsTab() {
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [editingReward, setEditingReward] = useState<Partial<RewardData> | null>(null);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    setRewardsLoading(true);
    try {
      const res = await fetch("/api/rewards");
      const data = await res.json();
      if (data.success) {
        setRewards(data.rewards);
      }
    } catch (error) {
      console.error("Error fetching rewards:", error);
    } finally {
      setRewardsLoading(false);
    }
  };

  const saveReward = async () => {
    if (!editingReward) return;
    try {
      const method = editingReward._id ? "PUT" : "POST";
      const body = editingReward._id 
        ? { id: editingReward._id, ...editingReward }
        : editingReward;
      
      const res = await fetch("/api/rewards", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        fetchRewards();
        setEditingReward(null);
      }
    } catch (error) {
      console.error("Error saving reward:", error);
    }
  };

  const deleteReward = async (id: string, name: string) => {
    if (!confirm(`Delete reward "${name}"?`)) return;
    try {
      const res = await fetch("/api/rewards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchRewards();
      }
    } catch (error) {
      console.error("Error deleting reward:", error);
    }
  };

  return (
    <>
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">🎁 Rewards ({rewards.length})</h2>
          <button
            onClick={() => setEditingReward({
              name: '',
              description: '',
              cost: 1000,
              category: 'standard',
              partner: 'SportTock',
              icon: 'Gift',
              active: true,
            })}
            className="flex items-center gap-2 bg-[#D4873A] hover:bg-[#d00440] px-4 py-2 rounded-lg font-bold transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Reward
          </button>
        </div>

        {rewardsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No rewards yet. Create your first reward!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => (
              <div key={reward._id} className="bg-gray-700/50 rounded-lg p-4">
                {reward.image && (
                  <img src={reward.image} alt={reward.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold">{reward.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-600 text-gray-300">{reward.category}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${reward.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {reward.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{reward.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#D4873A]">{(reward.cost || 0).toLocaleString()} pts</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingReward(reward)}
                      className="p-1.5 hover:bg-gray-600 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteReward(reward._id!, reward.name)}
                      className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reward Editor Modal */}
      {editingReward && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingReward._id ? 'Edit Reward' : 'New Reward'}</h3>
              <button onClick={() => setEditingReward(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={editingReward.name || ''}
                  onChange={(e) => setEditingReward({ ...editingReward, name: e.target.value })}
                  className="w-full bg-gray-700 px-4 py-2 rounded-lg"
                  placeholder="Amazon Gift Card"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={editingReward.description || ''}
                  onChange={(e) => setEditingReward({ ...editingReward, description: e.target.value })}
                  className="w-full bg-gray-700 px-4 py-2 rounded-lg resize-none"
                  rows={3}
                  placeholder="Get a €10 Amazon gift card..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Points Cost</label>
                  <input
                    type="number"
                    value={editingReward.cost || 0}
                    onChange={(e) => setEditingReward({ ...editingReward, cost: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-700 px-4 py-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={editingReward.category || 'standard'}
                    onChange={(e) => setEditingReward({ ...editingReward, category: e.target.value })}
                    className="w-full bg-gray-700 px-4 py-2 rounded-lg"
                  >
                    {REWARD_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image URL</label>
                <input
                  type="text"
                  value={editingReward.image || ''}
                  onChange={(e) => setEditingReward({ ...editingReward, image: e.target.value })}
                  className="w-full bg-gray-700 px-4 py-2 rounded-lg"
                  placeholder="https://..."
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingReward.active ?? true}
                  onChange={(e) => setEditingReward({ ...editingReward, active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Available for redemption</span>
              </label>
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setEditingReward(null)}
                className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={saveReward}
                disabled={!editingReward.name}
                className="px-4 py-2 bg-[#D4873A] rounded-lg hover:bg-[#d00440] disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
