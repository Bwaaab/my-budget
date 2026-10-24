import React, { useState, useEffect } from 'react';
import {
  Heart,
  Plus,
  Check,
  ExternalLink,
  Trash2,
  DollarSign,
  Sparkles,
  ShoppingBag,
  Star,
  CheckCircle2,
  ArrowRightCircle
} from 'lucide-react';
import { formatKRW } from '../constants';

export default function Wishlist({ remainingBudget = 0, onConvertToExpense }) {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('budget_wishlist');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return [
      {
        id: 1,
        title: '에어팟 프로 2세대',
        price: 320000,
        category: '전자기기',
        priority: 5,
        link: 'https://www.apple.com/kr/airpods-pro/',
        memo: '노이즈 캔슬링 필요, 특가 할인할 때 구매',
        status: 'pending', // 'pending' | 'purchased'
        createdAt: '2026-10-20'
      },
      {
        id: 2,
        title: '나이키 러닝화',
        price: 139000,
        category: '패션/잡화',
        priority: 4,
        link: '',
        memo: '가을 러닝용 운동화 교체',
        status: 'pending',
        createdAt: '2026-10-22'
      }
    ];
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filter, setFilter] = useState('pending'); // 'all' | 'pending' | 'purchased'

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: '쇼핑',
    priority: 5,
    link: '',
    memo: ''
  });

  useEffect(() => {
    localStorage.setItem('budget_wishlist', JSON.stringify(items));
  }, [items]);

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

    setItems([newItem, ...items]);
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
      setItems(items.filter(i => i.id !== id));
    }
  };

  const handleMarkPurchased = (item) => {
    if (confirm(`'${item.title}'을(를) 구매 완료 처리하고 이번 달 가계부 지출에 등록할까요?`)) {
      // 1. Update status
      setItems(items.map(i => i.id === item.id ? { ...i, status: 'purchased' } : i));
      // 2. Add to actual expenses
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

  // Calculations
  const pendingItems = items.filter(i => i.status === 'pending');
  const totalPendingAmount = pendingItems.reduce((acc, i) => acc + i.price, 0);
  const affordableCount = pendingItems.filter(i => remainingBudget >= i.price).length;

  return (
    <div className="space-y-4">
      {/* Wishlist Header & Summary Banner */}
      <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-pink-100 text-xs font-semibold backdrop-blur-xs mb-1">
            <Heart className="w-3.5 h-3.5 fill-pink-200 text-pink-200" />
            <span>나만의 위시리스트 & 살 것 모아보기</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            사고 싶은 것 {pendingItems.length}개 · 총 {formatKRW(totalPendingAmount)}
          </h2>
          <p className="text-xs sm:text-sm text-pink-100 mt-1">
            {remainingBudget > 0 ? (
              <span>
                이번 달 남은 예산(<strong className="font-bold underline">{formatKRW(remainingBudget)}</strong>)으로 바로 살 수 있는 항목이 <strong>{affordableCount}개</strong> 있습니다!
              </span>
            ) : (
              <span>충동구매 대신 위시리스트에 담아두고 계획적으로 소비해보세요.</span>
            )}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-white text-rose-600 hover:bg-rose-50 font-bold text-xs sm:text-sm rounded-2xl shadow-md transition active:scale-95 flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>사고 싶은 것 추가</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'pending' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            살 예정 ({pendingItems.length})
          </button>
          <button
            onClick={() => setFilter('purchased')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'purchased' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            구매 완료 ({items.filter(i => i.status === 'purchased').length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            전체 ({items.length})
          </button>
        </div>
      </div>

      {/* Wishlist Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">등록된 위시리스트 항목이 없습니다</h4>
          <p className="text-xs text-slate-400 mt-1">사고 싶은 전자기기, 옷, 취미용품을 담아보세요!</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-xs transition"
          >
            + 첫 번째 항목 추가하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredItems.map(item => {
            const isAffordable = remainingBudget >= item.price && item.status === 'pending';
            const isPurchased = item.status === 'purchased';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl p-4 sm:p-5 border transition-all flex flex-col justify-between ${
                  isPurchased
                    ? 'border-emerald-200 bg-emerald-50/20 opacity-80'
                    : isAffordable
                    ? 'border-rose-200 shadow-sm hover:shadow-md'
                    : 'border-slate-200/80 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div>
                  {/* Category & Badges */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {item.category || '쇼핑'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isPurchased && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> 구매완료
                        </span>
                      )}
                      {isAffordable && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 animate-pulse">
                          ✨ 예산 내 구매 가능
                        </span>
                      )}
                      {/* Priority Stars */}
                      <div className="flex text-amber-400">
                        {Array.from({ length: item.priority || 3 }).map((_, idx) => (
                          <Star key={idx} className="w-3 h-3 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className={`text-base font-bold text-slate-900 ${isPurchased ? 'line-through text-slate-500' : ''}`}>
                    {item.title}
                  </h3>

                  {/* Price */}
                  <div className="mt-1">
                    <span className="text-xl font-black text-rose-600 tracking-tight">
                      {formatKRW(item.price)}
                    </span>
                  </div>

                  {/* Memo */}
                  {item.memo && (
                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded-xl">
                      {item.memo}
                    </p>
                  )}

                  {/* External Link */}
                  {item.link && (
                    <a
                      href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>상품 링크 바로가기</span>
                    </a>
                  )}
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {item.createdAt} 등록
                  </span>

                  <div className="flex items-center gap-1">
                    {!isPurchased && (
                      <button
                        onClick={() => handleMarkPurchased(item)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl flex items-center gap-1 transition"
                        title="구매 완료 처리하고 가계부에 등록"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>구매함</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span>사고 싶은 것 등록하기</span>
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  상품명 / 품목 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 에어팟 프로 2세대, 닌텐도 게임"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  예상 가격 (원) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="300000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full text-lg font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    카테고리
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    갖고 싶은 정도
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="5">⭐⭐⭐⭐⭐ 필수</option>
                    <option value="4">⭐⭐⭐⭐ 강력 희망</option>
                    <option value="3">⭐⭐⭐ 보통</option>
                    <option value="2">⭐⭐ 고민 중</option>
                    <option value="1">⭐ 나중에 천천히</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  구매 링크 URL (선택)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  메모 (선택)
                </label>
                <input
                  type="text"
                  placeholder="할인 행사 때 사기, 사이즈 등"
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-md shadow-rose-200 transition active:scale-95"
                >
                  위시리스트에 담기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
