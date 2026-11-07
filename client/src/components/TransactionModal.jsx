import React, { useState, useEffect } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import {
  CATEGORIES,
  PAYMENT_METHODS,
  formatKRW,
  isSavingTx,
  isSavingWithdrawTx,
  isPointTx,
  isPointUseTx,
  getNecessity,
  cleanNumber,
  normalizeDateYMD,
  normalizeTimeHM,
  todayYMD,
  nowHM,
  getMerchantFieldInfo
} from '../constants';

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
    pointMode: 'earn', // 'earn' | 'use'
    savingMode: 'deposit', // 'deposit' | 'withdraw'
    necessity: 'need',
    amount: '',
    merchant: '',
    date: todayYMD(),
    time: nowHM(),
    category: '식비',
    payment_method: '신용카드',
    memo: ''
  });
  const merchantField = getMerchantFieldInfo(
    formData.type,
    formData.pointMode,
    formData.type === 'saving' && formData.savingMode === 'withdraw'
  );

  useEffect(() => {
    if (initialData) {
      if (initialData.defaultType === 'point' && !initialData.id) {
        setFormData({
          type: 'point',
          pointMode: initialData.pointMode || 'earn',
          savingMode: 'deposit',
          necessity: 'need',
          amount: '',
          merchant: '',
          date: todayYMD(),
          time: nowHM(),
          category: '포인트',
          payment_method: '네이버페이(포인트)',
          memo: ''
        });
        return;
      }

      if (initialData.defaultType === 'saving' && !initialData.id) {
        const isWithdraw = initialData.savingMode === 'withdraw';
        setFormData({
          type: 'saving',
          pointMode: 'earn',
          savingMode: isWithdraw ? 'withdraw' : 'deposit',
          necessity: 'need',
          amount: '',
          merchant: '',
          date: todayYMD(),
          time: nowHM(),
          category: isWithdraw ? '저축/투자(인출)' : '저축/투자',
          payment_method: '계좌이체',
          memo: isWithdraw ? '[투자금 인출]' : ''
        });
        return;
      }

      const point = isPointTx(initialData);
      const saving = !point && isSavingTx(initialData);
      const savingWithdraw = saving && isSavingWithdrawTx(initialData);
      setFormData({
        id: initialData.id,
        type: point ? 'point' : saving ? 'saving' : initialData.type || 'expense',
        pointMode: point && isPointUseTx(initialData) ? 'use' : 'earn',
        savingMode: savingWithdraw ? 'withdraw' : 'deposit',
        necessity: saving ? 'need' : getNecessity(initialData),
        amount: initialData.amount ? String(initialData.amount) : '',
        merchant: initialData.merchant || '',
        date: initialData.date || todayYMD(),
        time: initialData.time || nowHM(),
        category: point ? '포인트' : saving ? (savingWithdraw ? '저축/투자(인출)' : '저축/투자') : initialData.category || '식비',
        payment_method: point ? '네이버페이(포인트)' : initialData.payment_method || (saving ? '계좌이체' : '신용카드'),
        memo: initialData.memo || '',
        image_path: initialData.image_path || ''
      });
    } else {
      setFormData({
        type: 'expense',
        pointMode: 'earn',
        savingMode: 'deposit',
        necessity: 'need',
        amount: '',
        merchant: '',
        date: todayYMD(),
        time: nowHM(),
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

    if (formData.type === 'point') {
      const isUse = formData.pointMode === 'use';
      onSave({
        ...formData,
        type: isUse ? 'expense' : 'income',
        category: '포인트',
        payment_method: '네이버페이(포인트)',
        necessity: isUse ? 'need' : undefined,
        amount: cleanAmt,
        merchant: cleanMerchant,
        date: normalizeDateYMD(formData.date),
        time: normalizeTimeHM(formData.time) || nowHM()
      });
      onClose();
      return;
    }

    if (formData.type === 'saving') {
      const isWithdraw = formData.savingMode === 'withdraw';
      let memo = (formData.memo || '').trim();
      if (isWithdraw && !memo.includes('[투자금 인출]')) {
        memo = `[투자금 인출] ${memo}`.trim();
      }
      onSave({
        ...formData,
        type: 'saving',
        saving_mode: isWithdraw ? 'withdraw' : 'deposit',
        savingMode: isWithdraw ? 'withdraw' : 'deposit',
        category: isWithdraw ? '저축/투자(인출)' : '저축/투자',
        payment_method: formData.payment_method || '계좌이체',
        necessity: undefined,
        amount: cleanAmt,
        merchant: cleanMerchant,
        date: normalizeDateYMD(formData.date),
        time: normalizeTimeHM(formData.time) || nowHM(),
        memo
      });
      onClose();
      return;
    }

    onSave({
      ...formData,
      amount: cleanAmt,
      merchant: cleanMerchant,
      date: normalizeDateYMD(formData.date),
      time: normalizeTimeHM(formData.time) || nowHM()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/60 animate-fade-in">
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
                  category: ['저축/투자', '포인트'].includes(formData.category) ? '식비' : formData.category,
                  payment_method: formData.payment_method === '네이버페이(포인트)' ? '신용카드' : formData.payment_method
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
                  ? 'bg-zinc-900 text-white shadow-xs'
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
                  category: ['저축/투자', '포인트'].includes(formData.category) ? '급여' : formData.category,
                  payment_method: formData.payment_method === '네이버페이(포인트)' ? '계좌이체' : formData.payment_method
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
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  type: 'point',
                  pointMode: formData.pointMode || 'earn',
                  category: '포인트',
                  payment_method: '네이버페이(포인트)'
                })
              }
              className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                formData.type === 'point'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600'
              }`}
            >
              포인트
            </button>
          </div>

          {/* Saving Mode Toggle (Only for saving) */}
          {formData.type === 'saving' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                저축 · 투자 구분
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      savingMode: 'deposit',
                      category: '저축/투자'
                    })
                  }
                  className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    formData.savingMode !== 'withdraw'
                      ? 'bg-zinc-900 text-white shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span>+ 저축·투자</span>
                  <span className={`text-[10px] ${formData.savingMode !== 'withdraw' ? 'text-zinc-300' : 'text-zinc-400'}`}>(모으기)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      savingMode: 'withdraw',
                      category: '저축/투자(인출)'
                    })
                  }
                  className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    formData.savingMode === 'withdraw'
                      ? 'bg-zinc-900 text-white shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span>- 투자금 회수</span>
                  <span className={`text-[10px] ${formData.savingMode === 'withdraw' ? 'text-zinc-300' : 'text-zinc-400'}`}>(가용자산 추가)</span>
                </button>
              </div>
            </div>
          )}

          {/* Point Mode Toggle (Only for point) */}
          {formData.type === 'point' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                포인트 구분
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, pointMode: 'earn' })}
                  className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    formData.pointMode !== 'use'
                      ? 'bg-zinc-900 text-white shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span>+ 적립</span>
                  <span className={`text-[10px] ${formData.pointMode !== 'use' ? 'text-zinc-300' : 'text-zinc-400'}`}>(모은 포인트)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, pointMode: 'use' })}
                  className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    formData.pointMode === 'use'
                      ? 'bg-zinc-900 text-white shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span>- 사용</span>
                  <span className={`text-[10px] ${formData.pointMode === 'use' ? 'text-zinc-300' : 'text-zinc-400'}`}>(쓴 포인트)</span>
                </button>
              </div>
            </div>
          )}

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
              {formData.type === 'point'
                ? '포인트 금액 (P)'
                : formData.type === 'saving' && formData.savingMode === 'withdraw'
                  ? '가용자산으로 복귀할 금액 (원)'
                  : '금액 (원)'}
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
                {formData.amount
                  ? formData.type === 'point'
                    ? `${formatKRW(formData.amount).replace('원', '')}P`
                    : formatKRW(formData.amount)
                  : formData.type === 'point'
                  ? 'P'
                  : '원'}
              </span>
            </div>
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              {merchantField.label}
            </label>
            <input
              type="text"
              required
              placeholder={merchantField.placeholder}
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

          {/* Category Chips & Payment Method (Hidden when type === 'point' for clean UI) */}
          {formData.type !== 'point' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  카테고리
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-zinc-50 rounded-xl border border-zinc-100">
                  {CATEGORIES.filter((cat) => cat.name !== '포인트').map((cat) => (
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
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                메모 (선택)
              </label>
              <input
                type="text"
                placeholder="추가 메모가 있다면 입력하세요"
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white outline-none"
              />
            </div>
          )}

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
