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
  Coins,
  MoreHorizontal
};

export default function CategoryIcon({ category, size = 18, className = '' }) {
  const cat = CATEGORIES.find(c => c.name === category) || CATEGORIES[CATEGORIES.length - 1];
  const IconComponent = ICON_MAP[cat.icon] || MoreHorizontal;

  return (
    <div className={`flex items-center justify-center rounded-xl p-2.5 ${cat.color} ${className}`}>
      <IconComponent size={size} />
    </div>
  );
}
