"use client";

import { ApiError, WEB_HEADER } from "./api";

/**
 * Fotos dos registros. No iPhone, <input type="file" accept="image/*"> oferece câmera e galeria; a foto (HEIC ou JPEG
 * grande) é redesenhada num canvas com o lado maior de 1600 px e vira JPEG antes de subir, como o mobile faz com o
 * expo-image-manipulator. O envio passa por /api/upload (src/app/api/upload/route.ts).
 */
const MAX_SIDE = 1600;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível abrir esta foto. Tente outra.")); };
    img.src = url;
  });
}

export type ShrinkOptions = { maxSide?: number; quality?: number };

export async function shrinkPhoto(file: File, { maxSide = MAX_SIDE, quality = 0.82 }: ShrinkOptions = {}): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a foto.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Não foi possível preparar a foto.")), "image/jpeg", quality));
}

/**
 * Reduz e envia; devolve as chaves privadas (photo_keys) na mesma ordem. Um PDF (chat do Bobby) sobe sem mudança. O Bobby usa { maxSide: 768, quality: 0.6 },
 * perto do que o mobile manda para a análise (768 px).
 */
export async function uploadEventPhotos(files: File[], options?: ShrinkOptions): Promise<string[]> {
  const keys: string[] = [];
  for (const file of files) {
    const body = new FormData();
    if (file.type === "application/pdf") body.append("file", file, file.name || "arquivo.pdf");
    else body.append("file", await shrinkPhoto(file, options), "foto.jpg");
    const res = await fetch("/api/upload", { method: "POST", body, headers: { [WEB_HEADER]: "1" } });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.object_key) throw new ApiError(res.status, data ?? { detail: "Não foi possível enviar a foto." });
    keys.push(data.object_key);
  }
  return keys;
}
