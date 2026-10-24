import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { CATEGORY_COLORS, formatKRW } from '../constants';
import CategoryIcon from './CategoryIcon';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

export default function ChartsView({ stats }) {
  const { categories = [], dailyTrend = [] } = stats || {};

  // Doughnut Chart Data (Category breakdown)
  const doughnutData = {
    labels: categories.map(c => c.category),
    datasets: [
      {
        data: categories.map(c => c.amount),
        backgroundColor: categories.map(c => CATEGORY_COLORS[c.category] || '#94a3b8'),
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.raw || 0;
            return ` ${formatKRW(val)}`;
          }
        }
      }
    },
    cutout: '72%'
  };

  // Daily Trend Bar Chart Data
  const barData = {
    labels: dailyTrend.map(d => `${d.day}일`),
    datasets: [
      {
        label: '일별 지출',
        data: dailyTrend.map(d => d.expense),
        backgroundColor: '#6366f1',
        borderRadius: 4,
        maxBarThickness: 16
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` 지출: ${formatKRW(context.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, maxTicksLimit: 15 }
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 10 },
          callback: (value) => (value >= 10000 ? `${value / 10000}만` : value)
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Category Breakdown Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 flex items-center justify-between">
          <span>카테고리별 지출 분석</span>
          <span className="text-xs text-slate-400 font-normal">상위 항목</span>
        </h3>

        {categories.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-400 text-sm">
            이번 달 지출 내역이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
            {/* Donut Chart */}
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex-shrink-0">
              <Doughnut data={doughnutData} options={doughnutOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-400">총 {categories.length}개</span>
                <span className="text-xs font-semibold text-slate-700">분류</span>
              </div>
            </div>

            {/* Category List */}
            <div className="w-full space-y-2 max-h-48 overflow-y-auto pr-1">
              {categories.map((c) => (
                <div key={c.category} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[c.category] || '#94a3b8' }}
                    />
                    <span className="font-medium text-slate-700">{c.category}</span>
                    <span className="text-slate-400 text-xs">({c.percentage}%)</span>
                  </div>
                  <span className="font-semibold text-slate-900">{formatKRW(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Daily Spending Trend Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 flex items-center justify-between">
          <span>일별 지출 추이</span>
          <span className="text-xs text-slate-400 font-normal">날짜별 추이</span>
        </h3>

        <div className="h-44 sm:h-48 w-full mt-2">
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
    </div>
  );
}
