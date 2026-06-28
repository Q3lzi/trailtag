"use client";

/**
 * Thin wrapper around the `qrcode` npm package's SVG renderer. SVG (not
 * canvas/PNG) is used because it stays crisp at any print size — a sticker
 * meant to be read by a phone camera from a car window needs to scale
 * cleanly, not pixelate.
 */
export async function generateQrSvg(url: string, options?: { margin?: number; color?: string }): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toString(url, {
    type: "svg",
    margin: options?.margin ?? 1,
    color: { dark: options?.color ?? "#061907", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}