"use client";

import { useEffect, useRef, useState } from "react";
import { generateQrSvg } from "@/lib/qrcode";
import { Download, Mountain } from "lucide-react";

const PORTAL_BASE = "https://trailtag-production.up.railway.app/r";

/**
 * The printable sticker design: QR code + Trailtag branding + a short
 * explainer line, framed like an actual weatherproof car sticker — this is
 * what gets printed and stuck to a windshield, so it needs to look
 * trustworthy and legible at a glance, not just "a QR code".
 */
export default function VehicleQrSticker({ qrToken, plate }: { qrToken: string; plate: string }) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalUrl = `${PORTAL_BASE}/${qrToken}`;

  useEffect(() => {
    generateQrSvg(portalUrl, { color: "#061907" }).then(setSvgMarkup);
  }, [portalUrl]);

  function downloadSvg() {
    if (!containerRef.current) return;
    const stickerSvg = buildPrintableSvg(svgMarkup ?? "", plate);
    const blob = new Blob([stickerSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trailtag-sticker-${plate.replace(/\s+/g, "")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPng() {
    const stickerSvg = buildPrintableSvg(svgMarkup ?? "", plate);
    const img = new Image();
    const svgBlob = new Blob([stickerSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const scale = 4; // print-quality resolution
      const canvas = document.createElement("canvas");
      canvas.width = 400 * scale;
      canvas.height = 520 * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, 400, 520);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `trailtag-sticker-${plate.replace(/\s+/g, "")}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <div>
      {/* On-screen preview, styled to look like the physical sticker */}
      <div
        ref={containerRef}
        className="w-full max-w-[280px] mx-auto rounded-2xl border-2 border-forest-950 bg-white p-6 text-center shadow-lg"
      >
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Mountain className="w-4 h-4 text-forest-700" strokeWidth={2.2} />
          <span className="font-display font-bold text-sm text-forest-950 tracking-tight">Trailtag</span>
        </div>
        <p className="text-[10px] text-stone mb-4 leading-tight">
          Im Notfall: Code scannen für Standort &amp; Notfalldaten
        </p>
        <div className="bg-white rounded-lg p-2 mx-auto" style={{ width: 160, height: 160 }}>
          {svgMarkup ? (
            <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
          ) : (
            <div className="w-full h-full bg-forest-100 animate-pulse rounded" />
          )}
        </div>
        <p className="text-[9px] text-stone mt-4">Kein App-Download für Ersthelfer nötig</p>
      </div>

      <div className="flex gap-2 mt-4 justify-center">
        <button
          onClick={downloadPng}
          className="flex items-center gap-1.5 rounded-xl bg-forest-700 text-white px-4 py-2 text-xs font-semibold hover:bg-forest-600 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> PNG herunterladen
        </button>
        <button
          onClick={downloadSvg}
          className="flex items-center gap-1.5 rounded-xl border border-forest-950/15 text-forest-950/70 px-4 py-2 text-xs font-semibold hover:border-forest-950/30 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> SVG (Druckvorlage)
        </button>
      </div>
    </div>
  );
}

/**
 * Builds the full standalone SVG file for download — same visual design as
 * the on-screen preview, but as one self-contained document (no external
 * font/icon dependencies) so it prints reliably anywhere.
 */
function buildPrintableSvg(qrSvgInner: string, plate: string): string {
  // The qrcode lib emits its own <svg viewBox="0 0 NxN" ...>...</svg> where N
  // depends on the QR version (which varies with URL length) — extract both
  // the inner markup and the actual viewBox rather than assuming a fixed size.
  const viewBoxMatch = qrSvgInner.match(/viewBox="([^"]+)"/);
  const innerMatch = qrSvgInner.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 29 29";
  const qrInner = innerMatch ? innerMatch[1] : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
  <rect x="4" y="4" width="392" height="512" rx="20" fill="#ffffff" stroke="#061907" stroke-width="4"/>
  <text x="200" y="60" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="28" fill="#061907">Trailtag</text>
  <text x="200" y="95" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">Im Notfall: Code scannen für</text>
  <text x="200" y="113" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">Standort &amp; Notfalldaten</text>
  <g transform="translate(60, 140)">
    <svg width="280" height="280" viewBox="${qrViewBox}">${qrInner}</svg>
  </g>
  <text x="200" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#6b7280">Kein App-Download für Ersthelfer nötig</text>
  <text x="200" y="485" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="16" fill="#061907">${escapeXml(plate)}</text>
</svg>`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
