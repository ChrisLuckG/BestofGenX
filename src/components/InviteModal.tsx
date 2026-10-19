"use client";

import { useState, useEffect } from "react";
import { X, Mail, MessageCircle, QrCode, Copy, Check, Share2 } from "lucide-react";
import BrandedModal from "./BrandedModal";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  referralCount?: number;
}

// Invite friends modal: share via Email, WhatsApp, QR or copy link.
// Each successful signup credits 500 points to the inviter (handled server-side).
export default function InviteModal({ isOpen, onClose, userId, username, referralCount = 0 }: InviteModalProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [origin, setOrigin] = useState("https://bestofgenx.com");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  if (!isOpen) return null;

  const inviteUrl = `${origin}/mobile?ref=${userId}`;
  const shareText = `Join me on Best of GenX — the daily 80s/90s/2000s challenge. You'll get a 500-point welcome bonus. ${inviteUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const shareEmail = () => {
    const subject = encodeURIComponent("Join me on Best of GenX");
    const body = encodeURIComponent(shareText);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Best of GenX", text: shareText, url: inviteUrl });
      } catch {
        // user cancelled
      }
    }
  };

  // QR code from a free public service - no extra dependency required.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(inviteUrl)}`;

  return (
    <BrandedModal
      isOpen
      onClose={onClose}
      eyebrow="Share Best of GenX"
      title="Invite friends"
      icon={Share2}
      bandFooter={<p className="text-white/90 text-sm font-bold">+5.00 BOGX for every friend who joins</p>}
    >
          <p className="text-gray-700 text-sm md:text-base leading-relaxed mb-4">Share Best of GenX with your crew, {username}.</p>

          {referralCount > 0 && (
            <div className="text-center mb-4 text-[12px] text-gray-500">
              You've already invited <span className="font-bold text-gray-900">{referralCount}</span> friend{referralCount === 1 ? "" : "s"}.
            </div>
          )}

          {showQr ? (
            <div className="flex flex-col items-center mb-4">
              <div className="p-3 bg-white border border-warm rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="Invite QR code" width={240} height={240} className="rounded-lg" />
              </div>
              <button
                onClick={() => setShowQr(false)}
                className="mt-3 text-[13px] text-gray-500 hover:text-gray-700"
              >
                Back to share options
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                onClick={shareEmail}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-warm bg-cream hover:bg-[#E36B11]/5 transition-colors"
              >
                <Mail className="w-5 h-5 text-[#E36B11]" />
                <span className="text-[11px] font-bold text-gray-700">Email</span>
              </button>
              <button
                onClick={shareWhatsApp}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-warm bg-cream hover:bg-[#E36B11]/5 transition-colors"
              >
                <MessageCircle className="w-5 h-5 text-[#E36B11]" />
                <span className="text-[11px] font-bold text-gray-700">WhatsApp</span>
              </button>
              <button
                onClick={() => setShowQr(true)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-warm bg-cream hover:bg-[#E36B11]/5 transition-colors"
              >
                <QrCode className="w-5 h-5 text-[#E36B11]" />
                <span className="text-[11px] font-bold text-gray-700">QR Code</span>
              </button>
            </div>
          )}

          {/* Copy link */}
          <div className="flex items-center gap-2 p-2 pl-3 rounded-xl border border-warm bg-cream/50 mb-3">
            <span className="flex-1 truncate text-[12px] text-gray-700">{inviteUrl}</span>
            <button
              onClick={copyLink}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                copied
                  ? "bg-green-500 text-white"
                  : "bg-[#E36B11] text-white hover:bg-[#C4772A]"
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <button
              onClick={nativeShare}
              className="w-full py-2.5 rounded-xl text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              More sharing options...
            </button>
          )}
    </BrandedModal>
  );
}
