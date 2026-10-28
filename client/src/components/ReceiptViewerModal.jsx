import React from 'react';
import { X, Download } from 'lucide-react';

export default function ReceiptViewerModal({ isOpen, onClose, imagePath }) {
  if (!isOpen || !imagePath) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/80 animate-fade-in">
      <div className="bg-slate-900 rounded-3xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between text-white">
          <span className="text-xs font-semibold text-slate-300">원본 영수증 / 캡처 사진</span>
          <div className="flex items-center gap-2">
            <a
              href={imagePath}
              download
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition"
              title="다운로드"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4 flex items-center justify-center overflow-auto flex-1">
          <img
            src={imagePath}
            alt="Receipt"
            className="max-w-full max-h-[75vh] object-contain rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}
