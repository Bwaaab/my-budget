import React from 'react';
import {
  Utensils,
  Coffee,
  ShoppingCart,
  Car,
  ShoppingBag,
  Film,
  HeartPulse,
  Home,
  Landmark,
  PiggyBank,
  Coins,
  MoreHorizontal
} from 'lucide-react';
import { CATEGORIES } from '../constants';

const ICON_MAP = {
  Utensils,
  Coffee,
  ShoppingCart,
  Car,
  ShoppingBag,
  Film,
  HeartPulse,
  Home,
  Landmark,
  PiggyBank,
  Coins,
  MoreHorizontal
};

export default function CategoryIcon({ category, size = 16, className = '', inverted = false }) {
  const cat = CATEGORIES.find(c => c.name === category) || CATEGORIES[CATEGORIES.length - 1];
  const IconComponent = ICON_MAP[cat.icon] || MoreHorizontal;

  return (
    <div
      className={`flex items-center justify-center rounded-xl p-2 transition-colors ${
        inverted
          ? 'bg-zinc-900 text-white border border-zinc-900 shadow-xs'
          : 'bg-zinc-100 text-zinc-700 border border-zinc-200/50'
      } ${className}`}
    >
      <IconComponent size={size} />
    </div>
  );
}
