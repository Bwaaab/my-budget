import React, { useState } from 'react';
import { X, Smartphone, Copy, Check, Wifi, ExternalLink } from 'lucide-react';

export default function QrCodeModal({ isOpen, onClose, networkInfo }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !networkInfo) return null;

  const { mobileUrl = '', qrCodeDataUrl = '', localIp = '' } = networkInfo;

  const handleCopy = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col text-center">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">스마트폰 연결</h2>
              <p className="text-xs text-slate-500">QR 코드로 모바일에서 즉시 접속</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 flex flex-col items-center">
          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-2xl border-2 border-indigo-100 shadow-md inline-block">
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="Smartphone Connect QR"
                className="w-52 h-52 sm:w-60 sm:h-60 rounded-xl"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                QR 코드를 생성하는 중...
              </div>
            )}
          </div>

          {/* URL with Copy */}
          <div className="w-full">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-700">
              <span className="font-mono flex-1 truncate text-left select-all px-1">
                {mobileUrl}
              </span>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '복사됨' : '복사'}</span>
              </button>
            </div>
          </div>

          {/* Guide Steps */}
          <div className="w-full bg-indigo-50/60 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-700 border border-indigo-100">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1">
              <Wifi className="w-4 h-4 text-indigo-600" />
              <span>연결 및 모바일 전용 캡처 앱 안내</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed">
              <li>스마트폰 기본 <strong>카메라 앱</strong>으로 위 QR 코드를 비춥니다.</li>
              <li>화면에 뜨는 링크를 누르면 스마트폰에서 가계부가 바로 열립니다!</li>
              <li>모바일 브라우저 메뉴에서 <strong>'홈 화면에 추가'</strong>를 누르면 일반 앱처럼 홈 화면에 등록됩니다.</li>
            </ol>
            <div className="pt-2 border-t border-indigo-200/60 mt-2 space-y-1">
              <span className="font-bold text-emerald-800 flex items-center gap-1">
                <span>📊 구글 시트 직통 모바일 페이지:</span>
              </span>
              <a
                href={`${mobileUrl}/mobile.html`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline font-mono break-all block"
              >
                {mobileUrl}/mobile.html ↗
              </a>
              <p className="text-[11px] text-slate-500">
                PC가 완전히 꺼져 있어도 폰에서 이 페이지를 열면 바로 영수증을 캡처해서 구글 시트에 24시간 저장할 수 있습니다!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
