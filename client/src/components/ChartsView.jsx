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
import { formatKRW } from '../constants';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

// Modern calm palette
const SLATE_PALETTE = [
  '#18181b', // zinc-900
  '#3f3f46', // zinc-700
  '#71717a', // zinc-500
  '#a1a1aa', // zinc-400
  '#d4d4d8', // zinc-300
  '#e4e4e7', // zinc-200
  '#52525b',
  '#27272a'
];

export default function ChartsView({ stats }) {
  const { categories = [], dailyTrend = [] } = stats || {};

  // Doughnut Chart Data (Category breakdown)
  const doughnutData = {
    labels: categories.map(c => c.category),
    datasets: [
      {
        data: categories.map(c => c.amount),
        backgroundColor: categories.map((_, i) => SLATE_PALETTE[i % SLATE_PALETTE.length]),
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${formatKRW(context.raw || 0)}`
        }
      }
    },
    cutout: '74%'
  };

  // Daily Trend Bar Chart Data
  const barData = {
    labels: dailyTrend.map(d => `${d.day}일`),
    datasets: [
      {
        label: '일별 지출',
        data: dailyTrend.map(d => d.expense),
        backgroundColor: '#27272a', // zinc-800
        borderRadius: 4,
        maxBarThickness: 14
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
        ticks: { font: { size: 10 }, color: '#a1a1aa', maxTicksLimit: 15 }
      },
      y: {
        grid: { color: '#f4f4f5' },
        ticks: {
          font: { size: 10 },
          color: '#a1a1aa',
          callback: (value) => (value >= 10000 ? `${value / 10000}만` : value)
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      {/* Category Breakdown Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/70 shadow-xs flex flex-col">
        <h3 className="text-xs sm:text-sm font-bold text-zinc-900 mb-3 flex items-center justify-between">
          <span>카테고리별 지출</span>
          <span className="text-[11px] text-zinc-400 font-normal">비율 분석</span>
        </h3>

        {categories.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-zinc-400 text-xs">
            지출 내역이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
            {/* Donut Chart */}
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0">
              <Doughnut data={doughnutData} options={doughnutOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-zinc-400">총 {categories.length}개</span>
                <span className="text-xs font-semibold text-zinc-700">항목</span>
              </div>
            </div>

            {/* Category List */}
            <div className="w-full space-y-2 max-h-44 overflow-y-auto pr-1">
              {categories.map((c, i) => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: SLATE_PALETTE[i % SLATE_PALETTE.length] }}
                    />
                    <span className="font-medium text-zinc-700">{c.category}</span>
                    <span className="text-zinc-400 text-[11px]">({c.percentage}%)</span>
                  </div>
                  <span className="font-semibold text-zinc-900">{formatKRW(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Daily Spending Trend Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/70 shadow-xs flex flex-col">
        <h3 className="text-xs sm:text-sm font-bold text-zinc-900 mb-3 flex items-center justify-between">
          <span>일별 지출 추이</span>
          <span className="text-[11px] text-zinc-400 font-normal">일별 통계</span>
        </h3>

        <div className="h-40 sm:h-44 w-full mt-1">
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
    </div>
  );
}
