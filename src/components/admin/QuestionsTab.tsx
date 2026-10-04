"use client";

import { useState, useEffect } from "react";
import { Trash2, Loader2, Sparkles, Search, ChevronUp, ChevronDown } from "lucide-react";
import ImagePickerModal from "./ImagePickerModal";
import { useConfirm } from "./ConfirmModal";

interface Question {
  _id: string;
  questionNumber?: number;
  question: string;
  options: string[];
  correctAnswer: string;
  theme: string;

  topic?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  maxReward: number;
  timesPlayed: number;
  timesCorrect: number;
  active: boolean;
  image?: string;
  createdAt: string;
}

const THEMES = ['MUSIC', 'SPORTS', 'TV & MOVIES', 'GAMING', 'POLITIK'] as const;

export default function QuestionsTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [themeCounts, setThemeCounts] = useState<Record<string, number>>({});
  const [difficultyCounts, setDifficultyCounts] = useState<Record<string, number>>({});
  
  // Filters
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState<'diff' | 'pts' | 'num' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Editing Answer/Options
  const [editingAnswer, setEditingAnswer] = useState<{
    questionId: string;
    options: string[];
    correctAnswer: string;
  } | null>(null);
  
  // Image Picker
  const [imagePickerQuestion, setImagePickerQuestion] = useState<{ id: string; searchTerm: string } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  
  // Actions
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (themeFilter) params.set('theme', themeFilter);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);
      params.set('limit', '1000');
      
      const res = await fetch(`/api/questions?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setQuestions(data.questions);
        setTotal(data.total);
        setThemeCounts(data.themeCounts || {});
        setDifficultyCounts(data.difficultyCounts || {});
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [themeFilter, difficultyFilter]);

  // Filter & Sort
  let filteredQuestions = questions.filter(q => 
    !searchQuery || 
    q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  if (sortBy) {
    filteredQuestions = [...filteredQuestions].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'diff') {
        const diffOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
        cmp = diffOrder[a.difficulty] - diffOrder[b.difficulty];
      } else if (sortBy === 'pts') {
        cmp = a.maxReward - b.maxReward;
      } else if (sortBy === 'num') {
        cmp = (a.questionNumber || 0) - (b.questionNumber || 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  const toggleSort = (col: 'diff' | 'pts' | 'num') => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  // Update question field
  const updateQuestion = async (id: string, updates: Partial<Question>) => {
    try {
      await fetch(`/api/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchQuestions();
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  // Delete single question
  const deleteQuestion = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Question',
      message: 'Delete this question?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    setIsDeleting(id);
    try {
      await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      fetchQuestions();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  // Delete selected
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: 'Delete Questions',
      message: `Delete ${selectedIds.size} questions?`,
      confirmLabel: 'Delete All',
      variant: 'danger',
    });
    if (!ok) return;
    
    setIsDeletingBulk(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      }
      setSelectedIds(new Set());
      fetchQuestions();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Generate new questions
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/admin/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          count: generateCount, 
          theme: themeFilter || undefined,
          difficulty: difficultyFilter || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Generated ${data.generated} questions!`);
        fetchQuestions();
      }
    } catch (error) {
      console.error('Generate error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save answer edit
  const saveAnswerEdit = async () => {
    if (!editingAnswer) return;
    
    await updateQuestion(editingAnswer.questionId, {
      options: editingAnswer.options,
      correctAnswer: editingAnswer.correctAnswer,
    });
    setEditingAnswer(null);
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // Select all visible
  const selectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map(q => q._id)));
    }
  };

  return (
    <div className="space-y-3">
      {/* Stats Bar */}
      <div className="bg-paper rounded-lg px-3 py-2 border border-gray-200">
        <div className="flex justify-center gap-4 text-xs">
          <span className="text-gray-500">Total: <strong className="text-gray-900">{total}</strong></span>
          <span className="text-green-400">Easy: <strong>{difficultyCounts['Easy'] || 0}</strong></span>
          <span className="text-yellow-400">Medium: <strong>{difficultyCounts['Medium'] || 0}</strong></span>
          <span className="text-red-400">Hard: <strong>{difficultyCounts['Hard'] || 0}</strong></span>
        </div>
        
        {/* Theme Filter Buttons */}
        <div className="flex flex-wrap justify-center gap-1 mt-2 pt-2 border-t border-gray-200">
          <button
            onClick={() => setThemeFilter(null)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              themeFilter === null ? 'bg-[#E36B11] text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            ALL
          </button>
          {THEMES.map(theme => (
            <button
              key={theme}
              onClick={() => setThemeFilter(themeFilter === theme ? null : theme)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                themeFilter === theme ? 'bg-[#E36B11] text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              } ${(themeCounts[theme] || 0) === 0 ? 'opacity-40' : ''}`}
            >
              {theme} <span className="text-[8px] opacity-70">({themeCounts[theme] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Difficulty Filter */}
        <select
          value={difficultyFilter || ''}
          onChange={e => setDifficultyFilter(e.target.value || null)}
          className="px-2 py-1 bg-gray-100 rounded text-xs"
        >
          <option value="">All Difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-gray-100 rounded text-xs"
          />
        </div>

        {/* Bulk Delete */}
        {selectedIds.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={isDeletingBulk}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs flex items-center gap-1"
          >
            {isDeletingBulk ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Delete {selectedIds.size}
          </button>
        )}

        {/* Generate */}
        <div className="flex items-center gap-1 ml-auto">
          <select
            value={generateCount}
            onChange={e => setGenerateCount(parseInt(e.target.value))}
            className="px-2 py-1 bg-gray-100 rounded text-xs"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs flex items-center gap-1"
          >
            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Generate
          </button>
        </div>
      </div>

      {/* Questions Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-paper sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left w-6">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0}
                    onChange={selectAll}
                    className="w-3 h-3 cursor-pointer"
                  />
                </th>
                <th 
                  className="px-2 py-2 text-left text-gray-600 w-12 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('num')}
                >
                  <span className="flex items-center gap-0.5">
                    # {sortBy === 'num' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </span>
                </th>
                <th className="px-2 py-2 text-left text-gray-600 w-12">Img</th>
                <th className="px-2 py-2 text-left text-gray-600 w-20">Theme</th>
                <th 
                  className="px-2 py-2 text-left text-gray-600 w-16 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('diff')}
                >
                  <span className="flex items-center gap-0.5">
                    Diff {sortBy === 'diff' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </span>
                </th>
                <th className="px-2 py-2 text-left text-gray-600">Question</th>
                <th className="px-2 py-2 text-left text-gray-600 w-28">Answer</th>
                <th 
                  className="px-2 py-2 text-left text-gray-600 w-14 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('pts')}
                >
                  <span className="flex items-center gap-0.5">
                    Pts {sortBy === 'pts' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </span>
                </th>
                <th className="px-2 py-2 text-right text-gray-600 w-10">Del</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map((q) => (
                <tr 
                  key={q._id} 
                  className={`border-t border-gray-200 hover:bg-gray-50 ${
                    selectedIds.has(q._id) ? 'bg-red-900/20' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(q._id)}
                      onChange={() => toggleSelect(q._id)}
                      className="w-3 h-3 cursor-pointer"
                    />
                  </td>
                  
                  {/* Number */}
                  <td className="px-2 py-1 text-gray-500 font-mono" title={`ID: ${q._id}`}>
                    {q.questionNumber || '-'}
                  </td>
                  
                  {/* Image */}
                  <td className="px-2 py-1">
                    <button 
                      onClick={() => setImagePickerQuestion({ id: q._id, searchTerm: q.topic || q.question.slice(0, 30) })}
                      className="cursor-pointer"
                    >
                      {q.image ? (
                        <img src={q.image} alt="" className="w-8 h-8 rounded object-cover hover:ring-2 hover:ring-[#E36B11]" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500 text-[8px] hover:bg-gray-200">+</div>
                      )}
                    </button>
                  </td>
                  
                  {/* Theme */}
                  <td className="px-2 py-1">
                    <select
                      value={q.theme}
                      onChange={(e) => updateQuestion(q._id, { theme: e.target.value as any })}
                      className="px-1 py-0.5 rounded text-[10px] cursor-pointer bg-gray-100 border border-gray-300 text-gray-600"
                    >
                      {THEMES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Difficulty */}
                  <td className="px-2 py-1">
                    <select
                      value={q.difficulty}
                      onChange={(e) => {
                        const diff = e.target.value as 'Easy' | 'Medium' | 'Hard';
                        const reward = diff === 'Easy' ? 0.05 : diff === 'Medium' ? 0.10 : 0.15;
                        updateQuestion(q._id, { difficulty: diff, maxReward: reward });
                      }}
                      className={`px-1 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                        q.difficulty === 'Easy' ? 'bg-green-500/30 text-green-400' :
                        q.difficulty === 'Medium' ? 'bg-yellow-500/30 text-yellow-400' :
                        'bg-red-500/30 text-red-400'
                      }`}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </td>
                  
                  {/* Question */}
                  <td className="px-2 py-1 text-gray-600 max-w-[250px] truncate" title={q.question}>
                    {q.question}
                  </td>
                  
                  {/* Answer (with edit popup) */}
                  <td className="px-2 py-1 relative">
                    <button
                      onClick={() => setEditingAnswer({
                        questionId: q._id,
                        options: [...q.options],
                        correctAnswer: q.correctAnswer,
                      })}
                      className="text-green-400 font-medium max-w-[100px] truncate hover:underline cursor-pointer"
                      title="Click to edit options"
                    >
                      {q.correctAnswer}
                    </button>
                    
                    {/* Answer Edit Popup */}
                    {editingAnswer?.questionId === q._id && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-paper border border-gray-300 rounded-lg shadow-xl p-3 min-w-[220px]">
                        <div className="text-[10px] text-gray-500 mb-2">Options (click to set correct):</div>
                        {editingAnswer.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => setEditingAnswer({ ...editingAnswer, correctAnswer: opt })}
                              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                                editingAnswer.correctAnswer === opt
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-gray-300 hover:border-green-400'
                              }`}
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...editingAnswer.options];
                                const oldVal = newOpts[optIdx];
                                newOpts[optIdx] = e.target.value;
                                setEditingAnswer({
                                  ...editingAnswer,
                                  options: newOpts,
                                  correctAnswer: editingAnswer.correctAnswer === oldVal ? e.target.value : editingAnswer.correctAnswer
                                });
                              }}
                              className="flex-1 bg-gray-100 rounded px-2 py-1 text-xs text-gray-900"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={saveAnswerEdit}
                            className="flex-1 bg-green-600 hover:bg-green-700 rounded px-2 py-1 text-xs font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingAnswer(null)}
                            className="flex-1 bg-gray-200 hover:bg-gray-100 rounded px-2 py-1 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  
                  {/* Points */}
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={q.maxReward}
                      onChange={(e) => updateQuestion(q._id, { maxReward: parseFloat(e.target.value) || 0.10 })}
                      step="0.01"
                      className="w-12 bg-gray-100 rounded px-1 py-0.5 text-[10px] text-cyan-400"
                    />
                  </td>
                  
                  {/* Delete */}
                  <td className="px-2 py-1 text-right">
                    <button
                      onClick={() => deleteQuestion(q._id)}
                      disabled={isDeleting === q._id}
                      className="text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {isDeleting === q._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredQuestions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No questions found
            </div>
          )}
        </div>
      )}

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={!!imagePickerQuestion}
        onClose={() => setImagePickerQuestion(null)}
        onSelect={async (url) => {
          if (imagePickerQuestion) {
            await updateQuestion(imagePickerQuestion.id, { image: url });
          }
          setImagePickerQuestion(null);
        }}
        searchTerm={imagePickerQuestion?.searchTerm}
        showAiGenerate={true}
        aiPromptContext={`Quiz question about: ${imagePickerQuestion?.searchTerm}`}
      />
      <ConfirmDialog />
    </div>
  );
}
