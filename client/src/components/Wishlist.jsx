import React, { useState, useEffect } from 'react';
import {
  Heart,
  Plus,
  Check,
  ExternalLink,
  Trash2,
  ShoppingBag,
  Star,
  CheckCircle2
} from 'lucide-react';
import { formatKRW } from '../constants';

export default function Wishlist({
  items: externalItems,
  onUpdateItems,
  remainingBudget = 0,
  onConvertToExpense,
  onSyncWishlist
}) {
  const [localItems, setLocalItems] = useState(() => {
    const saved = localStorage.getItem('budget_wishlist');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return [];
  });

  const items = externalItems !== undefined ? externalItems : localItems;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filter, setFilter] = useState('pending');

  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: '쇼핑',
    priority: 5,
    link: '',
    memo: ''
  });

  const updateItems = (newItems) => {
    if (onUpdateItems) {
      onUpdateItems(newItems);
    } else {
      setLocalItems(newItems);
    }
    localStorage.setItem('budget_wishlist', JSON.stringify(newItems));
    if (onSyncWishlist) {
      onSyncWishlist(newItems);
    }
  };

  useEffect(() => {
    if (externalItems === undefined) {
      const saved = localStorage.getItem('budget_wishlist');
      if (saved) {
        try { setLocalItems(JSON.parse(saved)); } catch (_) {}
      }
    }
  }, [externalItems]);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.price) return;

    const newItem = {
      id: Date.now(),
      title: formData.title.trim(),
      price: Number(formData.price),
      category: formData.category,
      priority: Number(formData.priority) || 3,
      link: formData.link.trim(),
      memo: formData.memo.trim(),
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10)
    };

    updateItems([newItem, ...items]);
    setFormData({
      title: '',
      price: '',
      category: '쇼핑',
      priority: 5,
      link: '',
      memo: ''
    });
    setIsAddModalOpen(false);
  };

  const handleDeleteItem = (id) => {
    if (confirm('이 위시리스트 항목을 삭제하시겠습니까?')) {
      updateItems(items.filter(i => i.id !== id));
    }
  };

  const handleMarkPurchased = (item) => {
    if (confirm(`'${item.title}'을(를) 구매 완료 처리하고 이번 달 가계부 지출에 등록할까요?`)) {
      updateItems(items.map(i => i.id === item.id ? { ...i, status: 'purchased' } : i));
      if (onConvertToExpense) {
        onConvertToExpense({
          type: 'expense',
          amount: item.price,
          merchant: item.title,
          category: item.category || '쇼핑',
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toTimeString().slice(0, 5),
          payment_method: '카드',
          memo: `[위시리스트 구매] ${item.memo || ''}`
        });
      }
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const pendingItems = items.filter(i => i.status === 'pending');
  const totalPendingAmount = pendingItems.reduce((acc, i) => acc + i.price, 0);
  const affordableCount = pendingItems.filter(i => remainingBudget >= i.price).length;

  return (
    <div className="space-y-4">
      {/* Calm & Minimal Header Banner */}
      <div className="bg-zinc-900 rounded-2xl p-5 sm:p-6 text-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1 text-zinc-400 text-xs font-medium mb-1">
            <Heart className="w-3.5 h-3.5 text-zinc-400" />
            <span>위시리스트</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            사고 싶은 것 {pendingItems.length}개 · 총 {formatKRW(totalPendingAmount)}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {remainingBudget > 0 ? (
              <span>
                이번 달 남은 예산(<strong className="text-zinc-200">{formatKRW(remainingBudget)}</strong>)으로 살 수 있는 항목: <strong>{affordableCount}개</strong>
              </span>
            ) : (
              <span>계획적인 소비를 위해 사고 싶은 것들을 미리 적어두세요.</span>
            )}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>항목 추가</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-zinc-100 p-0.5 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'pending' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
            }`}
          >
            살 예정 ({pendingItems.length})
          </button>
          <button
            onClick={() => setFilter('purchased')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'purchased' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
            }`}
          >
            구매 완료 ({items.filter(i => i.status === 'purchased').length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
            }`}
          >
            전체 ({items.length})
          </button>
        </div>
      </div>

      {/* Wishlist Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-zinc-200/70 shadow-xs">
          <ShoppingBag className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-zinc-700">등록된 위시리스트 항목이 없습니다</h4>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-3 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl transition"
          >
            + 항목 추가
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map(item => {
            const isAffordable = remainingBudget >= item.price && item.status === 'pending';
            const isPurchased = item.status === 'purchased';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between ${
                  isPurchased
                    ? 'border-zinc-200 bg-zinc-50/50 opacity-60'
                    : isAffordable
                    ? 'border-zinc-400/80 shadow-xs'
                    : 'border-zinc-200/70 shadow-xs'
                }`}
              >
                <div>
                  {/* Category & Badges */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                      {item.category || '쇼핑'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isPurchased && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-zinc-500" /> 구매완료
                        </span>
                      )}
                      {isAffordable && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                          예산 내 가능
                        </span>
                      )}
                      {/* Priority Stars */}
                      <div className="flex text-zinc-400">
                        {Array.from({ length: item.priority || 3 }).map((_, idx) => (
                          <Star key={idx} className="w-2.5 h-2.5 fill-zinc-400" />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className={`text-sm sm:text-base font-bold text-zinc-900 ${isPurchased ? 'line-through text-zinc-400' : ''}`}>
                    {item.title}
                  </h3>

                  {/* Price */}
                  <div className="mt-1">
                    <span className="text-lg font-black text-zinc-900 tracking-tight">
                      {formatKRW(item.price)}
                    </span>
                  </div>

                  {/* Memo */}
                  {item.memo && (
                    <p className="text-[11px] text-zinc-500 mt-2 bg-zinc-50 p-2 rounded-xl">
                      {item.memo}
                    </p>
                  )}

                  {/* External Link */}
                  {item.link && (
                    <a
                      href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-900 hover:underline font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>상품 링크 바로가기</span>
                    </a>
                  )}
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-3 mt-3 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">
                    {item.createdAt}
                  </span>

                  <div className="flex items-center gap-1">
                    {!isPurchased && (
                      <button
                        onClick={() => handleMarkPurchased(item)}
                        className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded-xl flex items-center gap-1 transition"
                        title="구매 완료 처리하고 가계부에 등록"
                      >
                        <Check className="w-3 h-3" />
                        <span>구매함</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 rounded-lg transition"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-zinc-200 flex flex-col">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900">
                위시리스트 등록
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  상품명 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 에어팟 프로, 러닝화"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-zinc-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  예상 가격 (원) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="300000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full text-base font-bold px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-zinc-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    카테고리
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                  >
                    <option value="전자기기">전자기기</option>
                    <option value="패션/잡화">패션/잡화</option>
                    <option value="생활용품">생활용품</option>
                    <option value="취미/문화">취미/문화</option>
                    <option value="도서/강의">도서/강의</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    희망 정도
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                  >
                    <option value="5">필수 (5점)</option>
                    <option value="4">강력 희망 (4점)</option>
                    <option value="3">보통 (3점)</option>
                    <option value="2">고민 중 (2점)</option>
                    <option value="1">나중에 (1점)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  구매 링크 URL (선택)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  메모 (선택)
                </label>
                <input
                  type="text"
                  placeholder="사이즈, 할인 행사 등"
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  className="w-full text-xs px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  위시리스트 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
