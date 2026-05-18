'use client';

import { useState, useEffect } from 'react';

interface PromoCode {
  id: string;
  code: string;
  reward_tokens: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  reward_type: string;
  created_at: string;
}

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formRewardTokens, setFormRewardTokens] = useState('');
  const [formMaxUses, setFormMaxUses] = useState('1');
  const [formExpiresAt, setFormExpiresAt] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchPromoCodes = async () => {
    try {
      const res = await fetch('/api/admin/promo-codes');
      const json = await res.json();
      if (json.promoCodes) setPromoCodes(json.promoCodes);
    } catch (err) {
      console.error('Error fetching promo codes:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPromoCodes(); }, []);

  const getStatus = (code: PromoCode) => {
    if (code.expires_at && new Date(code.expires_at) < new Date()) return 'expired';
    if (code.used_count >= code.max_uses) return 'depleted';
    return 'active';
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'active': return { text: '有效', cls: 'bg-green-500/20 text-green-400 border-green-500/30' };
      case 'expired': return { text: '已過期', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'depleted': return { text: '已用完', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      default: return { text: '未知', cls: 'bg-white/10 text-white/50 border-white/20' };
    }
  };

  const totalCodes = promoCodes.length;
  const activeCodes = promoCodes.filter(c => getStatus(c) === 'active').length;
  const inactiveCodes = totalCodes - activeCodes;

  const resetForm = () => {
    setFormCode('');
    setFormRewardTokens('');
    setFormMaxUses('1');
    setFormExpiresAt('');
  };

  const handleAdd = async () => {
    if (isSubmitting || !formCode || !formRewardTokens) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formCode,
          reward_tokens: Number(formRewardTokens),
          max_uses: Number(formMaxUses) || 1,
          expires_at: formExpiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '新增失敗');
      showToast('✅ 優惠代碼已新增');
      setIsAddModalOpen(false);
      resetForm();
      fetchPromoCodes();
    } catch (err: any) {
      showToast('❌ ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (code: PromoCode) => {
    setEditingCode(code);
    setFormCode(code.code);
    setFormRewardTokens(String(code.reward_tokens));
    setFormMaxUses(String(code.max_uses));
    setFormExpiresAt(code.expires_at ? code.expires_at.slice(0, 16) : '');
    setIsEditModalOpen(true);
  };

  const handleEdit = async () => {
    if (isSubmitting || !editingCode) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCode.id,
          code: formCode,
          reward_tokens: Number(formRewardTokens),
          max_uses: Number(formMaxUses) || 1,
          expires_at: formExpiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '更新失敗');
      showToast('✅ 優惠代碼已更新');
      setIsEditModalOpen(false);
      resetForm();
      setEditingCode(null);
      fetchPromoCodes();
    } catch (err: any) {
      showToast('❌ ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/promo-codes?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '刪除失敗');
      showToast('✅ 已刪除');
      setDeleteConfirmId(null);
      fetchPromoCodes();
    } catch (err: any) {
      showToast('❌ ' + err.message);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '無期限';
    return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="text-white/50">載入中...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">優惠代碼管理</h1>
          <p className="text-sm text-white/40 mt-1">管理推薦碼與優惠代碼</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsAddModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          ＋ 新增代碼
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="text-sm text-white/40 mb-1">總代碼數</div>
          <div className="text-2xl font-black text-white">{totalCodes}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="text-sm text-white/40 mb-1">有效代碼</div>
          <div className="text-2xl font-black text-green-400">{activeCodes}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="text-sm text-white/40 mb-1">已過期 / 用完</div>
          <div className="text-2xl font-black text-red-400">{inactiveCodes}</div>
        </div>
      </div>

      {/* Promo Codes Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="text-left p-4 font-medium">代碼</th>
                <th className="text-left p-4 font-medium">獎勵點數</th>
                <th className="text-left p-4 font-medium">使用次數</th>
                <th className="text-left p-4 font-medium">到期日</th>
                <th className="text-left p-4 font-medium">狀態</th>
                <th className="text-right p-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white/30">
                    尚無優惠代碼
                  </td>
                </tr>
              ) : (
                promoCodes.map((code) => {
                  const status = getStatus(code);
                  const label = statusLabel(status);
                  return (
                    <tr key={code.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <span className="font-mono font-bold text-white bg-white/10 px-2 py-1 rounded">{code.code}</span>
                      </td>
                      <td className="p-4 text-yellow-400 font-bold">NT$ {code.reward_tokens}</td>
                      <td className="p-4 text-white/70">{code.used_count} / {code.max_uses}</td>
                      <td className="p-4 text-white/50">{formatDate(code.expires_at)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${label.cls}`}>
                          {label.text}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(code)}
                            className="text-white/40 hover:text-white text-xs border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            編輯
                          </button>
                          {deleteConfirmId === code.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDelete(code.id)}
                                className="text-red-400 text-xs border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                              >
                                確認
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-white/40 text-xs border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(code.id)}
                              className="text-red-400/60 hover:text-red-400 text-xs border border-white/10 hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              刪除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-[#1A1A2E] w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
            <h3 className="text-xl font-bold text-white mb-6">新增優惠代碼</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/50 mb-1">代碼</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="例如：WELCOME2026"
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-white text-sm placeholder:text-white/30 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">獎勵點數 (NT$)</label>
                <input
                  type="number"
                  value={formRewardTokens}
                  onChange={(e) => setFormRewardTokens(e.target.value)}
                  placeholder="例如：100"
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-white text-sm placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">最大使用次數</label>
                <input
                  type="number"
                  value={formMaxUses}
                  onChange={(e) => setFormMaxUses(e.target.value)}
                  placeholder="1"
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-white text-sm placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">到期日（選填）</label>
                <input
                  type="datetime-local"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-white text-sm placeholder:text-white/30"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={isSubmitting || !formCode || !formRewardTokens}
                className={`w-full py-3 rounded-lg text-sm font-bold transition-all ${
                  isSubmitting || !formCode || !formRewardTokens
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isSubmitting ? '新增中...' : '新增代碼'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingCode && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-[#1A1A2E] w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => { setIsEditModalOpen(false); setEditingCode(null); }} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
            <h3 className="text-xl font-bold text-white mb-6">編輯優惠代碼</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/50 mb-1">代碼</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-white text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">獎勵點數 (NT$)</label>
                <input
                  type="number"
                  value={formRewardTokens}
                  onChange={(e) => setFormRewardTokens(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">最大使用次數</label>
                <input
                  type="number"
                  value={formMaxUses}
                  onChange={(e) => setFormMaxUses(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">到期日（選填）</label>
                <input
                  type="datetime-local"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-white text-sm"
                />
              </div>
              <div className="text-xs text-white/30">
                已使用次數：{editingCode.used_count}
              </div>
              <button
                onClick={handleEdit}
                disabled={isSubmitting || !formCode || !formRewardTokens}
                className={`w-full py-3 rounded-lg text-sm font-bold transition-all ${
                  isSubmitting || !formCode || !formRewardTokens
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isSubmitting ? '更新中...' : '更新代碼'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl z-[300] animate-fade-in-up text-sm whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
