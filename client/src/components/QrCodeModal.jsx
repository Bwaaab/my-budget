import React, { useState } from 'react';
import { X, Smartphone, Copy, Check, QrCode } from 'lucide-react';

export default function QrCodeModal({ isOpen, onClose, networkInfo, googleSheetsUrl }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Use networkInfo if local server provided it, otherwise use current page URL (for GitHub Pages)
  let baseMobileUrl = (networkInfo?.mobileUrl || window.location.href).split('?')[0];
  if (googleSheetsUrl) {
    baseMobileUrl += `?sheet=${encodeURIComponent(googleSheetsUrl)}`;
  }
  const mobileUrl = baseMobileUrl;
  const qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(mobileUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-zinc-200 flex flex-col text-center">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">스마트폰 연결</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 flex flex-col items-center">
          {/* QR Code Container */}
          <div className="p-2.5 bg-white rounded-xl border border-zinc-200 shadow-xs inline-block">
            <img
              src={qrCodeDataUrl}
              alt="Smartphone Connect QR"
              className="w-48 h-48 sm:w-52 sm:h-52 rounded-lg object-contain"
            />
          </div>

          <p className="text-xs text-zinc-500">
            스마트폰 카메라로 위 QR 코드를 비추면 즉시 열립니다
          </p>

          {/* URL with Copy Button */}
          <div className="w-full">
            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl p-1.5 text-xs text-zinc-700">
              <span className="font-mono flex-1 truncate text-left select-all px-1.5 text-[11px]">
                {mobileUrl}
              </span>
              <button
                onClick={handleCopy}
                className="px-2 py-1 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                {copied ? <Check className="w-3 h-3 text-zinc-900" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? '복사됨' : '복사'}</span>
              </button>
            </div>
          </div>

          {/* Guide Steps */}
          <div className="w-full bg-zinc-50 rounded-xl p-3.5 text-left space-y-1.5 text-[11px] text-zinc-600 border border-zinc-200/60">
            <div className="font-semibold text-zinc-800">
              📱 모바일 홈 화면 추가 방법
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-zinc-500 leading-relaxed">
              <li>스마트폰 기본 카메라로 QR 코드를 스캔합니다.</li>
              <li>모바일 브라우저 메뉴에서 <strong>'홈 화면에 추가'</strong>를 누릅니다.</li>
              <li>진짜 앱처럼 홈 화면에 아이콘이 생겨 언제든 바로 열 수 있습니다.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
