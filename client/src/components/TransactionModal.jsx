import React, { useState, useEffect } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import { CATEGORIES, PAYMENT_METHODS, formatKRW, isSavingTx, getNecessity, cleanNumber, normalizeDateYMD, normalizeTimeHM } from '../constants';

export default function TransactionModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData
}) {
  const isEditing = !!(initialData && initialData.id);

  const [formData, setFormData] = useState({
    type: 'expense',
    necessity: 'need',
    amount: '',
    merchant: '',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    category: '식비',
    payment_method: '신용카드',
    memo: ''
  });

  useEffect(() => {
    if (initialData) {
      const saving = isSavingTx(initialData);
      setFormData({
        id: initialData.id,
        type: saving ? 'saving' : initialData.type || 'expense',
        necessity: saving ? 'need' : getNecessity(initialData),
        amount: initialData.amount ? String(initialData.amount) : '',
        merchant: initialData.merchant || '',
        date: initialData.date || new Date().toISOString().slice(0, 10),
        time: initialData.time || new Date().toTimeString().slice(0, 5),
        category: saving ? '저축/투자' : initialData.category || '식비',
        payment_method: initialData.payment_method || (saving ? '계좌이체' : '신용카드'),
        memo: initialData.memo || '',
        image_path: initialData.image_path || ''
      });
    } else {
      setFormData({
        type: 'expense',
        necessity: 'need',
        amount: '',
        merchant: '',
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5),
        category: '식비',
        payment_method: '신용카드',
        memo: ''
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanAmt = cleanNumber(formData.amount);
    const cleanMerchant = (formData.merchant || '').trim();
    if (!cleanAmt || !cleanMerchant) return;

    onSave({
      ...formData,
      amount: cleanAmt,
      merchant: cleanMerchant,
      date: normalizeDateYMD(formData.date),
      time: normalizeTimeHM(formData.time) || new Date().toTimeString().slice(0, 5)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            {isEditing ? '내역 수정' : '내역 직접 등록'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type Selection */}
          <div className="flex bg-zinc-100 rounded-xl p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  type: 'expense',
                  category: formData.category === '저축/투자' ? '식비' : formData.category
                })
              }
              className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                formData.type === 'expense'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600'
              }`}
            >
              지출
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  type: 'saving',
                  category: '저축/투자',
                  payment_method: '계좌이체'
                })
              }
              className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                formData.type === 'saving'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600'
              }`}
            >
              저축 · 투자
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  type: 'income',
                  category: formData.category === '저축/투자' ? '급여' : formData.category
                })
              }
              className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                formData.type === 'income'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600'
              }`}
            >
              수입
            </button>
          </div>

          {/* Necessity Toggle (Only for expense) */}
          {formData.type === 'expense' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                지출 성격
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, necessity: 'need' })}
                  className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    formData.necessity !== 'want'
                      ? 'bg-zinc-900 text-white shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${formData.necessity !== 'want' ? 'bg-zinc-200' : 'bg-zinc-400'}`} />
                  <span>필수</span>
                  <span className={`text-[10px] ${formData.necessity !== 'want' ? 'text-zinc-300' : 'text-zinc-400'}`}>(생활비)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, necessity: 'want' })}
                  className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    formData.necessity === 'want'
                      ? 'bg-zinc-900 text-white shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${formData.necessity === 'want' ? 'bg-zinc-400' : 'bg-zinc-400'}`} />
                  <span>선택</span>
                  <span className={`text-[10px] ${formData.necessity === 'want' ? 'text-zinc-300' : 'text-zinc-400'}`}>(아낄 돈)</span>
                </button>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              금액 (원)
            </label>
            <div className="relative">
              <input
                type="number"
                required
                placeholder="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full text-xl font-extrabold px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                {formData.amount ? formatKRW(formData.amount) : '원'}
              </span>
            </div>
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              상호 / 사용처
            </label>
            <input
              type="text"
              required
              placeholder="예: 김밥천국, 스타벅스, 이마트"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className="w-full text-xs sm:text-sm px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                일자
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full text-xs px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                시간
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full text-xs px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              카테고리
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-zinc-50 rounded-xl border border-zinc-100">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      category: cat.name,
                      type:
                        cat.name === '저축/투자'
                          ? 'saving'
                          : formData.type === 'saving'
                          ? 'expense'
                          : formData.type
                    })
                  }
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                    formData.category === cat.name
                      ? 'bg-zinc-900 text-white shadow-xs font-bold'
                      : 'bg-white text-zinc-600 hover:bg-zinc-200/60 border border-zinc-200/50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method & Memo */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                결제 수단
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full text-xs px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                메모
              </label>
              <input
                type="text"
                placeholder="메모를 입력하세요"
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                className="w-full text-xs px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('이 내역을 삭제하시겠습니까?')) {
                    onDelete(formData.id);
                    onClose();
                  }
                }}
                className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-xl shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? '수정 완료' : '등록하기'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
