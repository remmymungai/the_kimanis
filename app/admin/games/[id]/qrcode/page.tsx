"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

export default function QRCodePage() {
  const params = useParams();
  const gameId = params?.id as string;
  const [qrDataUrl, setQrDataUrl] = useState("");
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join` : "";

  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, {
      width: 512,
      margin: 2,
      color: { dark: "#1A1A1A", light: "#F5F0E8" },
    }).then(setQrDataUrl);
  }, [joinUrl]);

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-dark">Scan to Join</h1>
        <p className="text-muted-foreground mt-2">Remmy &amp; Mbete&apos;s Engagement Party</p>
      </div>

      {qrDataUrl ? (
        <div className="bg-white rounded-3xl p-6 shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Join QR Code" className="w-64 h-64" />
        </div>
      ) : (
        <div className="w-64 h-64 rounded-3xl bg-muted flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-olive border-t-transparent animate-spin" />
        </div>
      )}

      <p className="text-muted-foreground text-center text-base font-medium">
        {joinUrl}
      </p>

      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Point your phone camera at the QR code to join the party games!
      </p>
    </div>
  );
}
