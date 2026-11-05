import { auth } from './firebaseAuth';
import { UploadedImage } from '../types';

/**
 * Photo uploads for the website. Photos go to Cloudflare R2 through the Pages
 * Functions in /functions (same origin as the app, or VITE_IMAGES_API_BASE).
 */
const API_BASE = (import.meta.env.VITE_IMAGES_API_BASE || '').replace(/\/$/, '');

const MAX_SIDE = 2000;
const QUALITY = 0.86;

/** Shrinks big phone photos to at most 2000px and re-encodes them as WebP. */
export const prepareImage = async (
  file: File
): Promise<{ blob: Blob; width: number; height: number }> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY));
  if (blob && blob.type === 'image/webp') return { blob, width, height };
  // Older Safari can't encode WebP: fall back to JPEG.
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!jpeg) throw new Error('Não foi possível processar a imagem');
  return { blob: jpeg, width, height };
};

const authHeader = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Entra de novo.');
  return `Bearer ${await user.getIdToken()}`;
};

export const uploadImage = async (
  file: File,
  folder: 'portfolio' | 'artworks'
): Promise<UploadedImage> => {
  const { blob, width, height } = await prepareImage(file);
  const res = await fetch(`${API_BASE}/api/images?folder=${folder}`, {
    method: 'POST',
    headers: { authorization: await authHeader(), 'content-type': blob.type },
    body: blob,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(
      res.status === 403
        ? 'Sem permissão para carregar fotos.'
        : `Falha no envio da foto (${res.status}${detail?.error ? `: ${detail.error}` : ''})`
    );
  }
  const { key, url } = (await res.json()) as { key: string; url: string };
  return { key, url, width, height };
};

export const deleteImage = async (key: string): Promise<void> => {
  if (!key) return;
  const res = await fetch(`${API_BASE}/api/images/${key}`, {
    method: 'DELETE',
    headers: { authorization: await authHeader() },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Falha ao apagar a foto (${res.status})`);
};
