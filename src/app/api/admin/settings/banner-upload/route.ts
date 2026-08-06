import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { detectImageType } from '@/lib/image-upload';
import {
  authenticationErrorResponse,
  getServerSupabase,
  requireAdminUser
} from '@/lib/server-auth';

export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: '請選擇圖片' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: '只支援 JPG、PNG、WebP 或 AVIF 圖片' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '壓縮後圖片不可超過 5MB' }, { status: 400 });
    }

    const fileBody = await file.arrayBuffer();
    const detectedType = detectImageType(new Uint8Array(fileBody));
    if (!detectedType || detectedType.mimeType !== file.type) {
      return NextResponse.json({ error: '圖片格式與檔案內容不一致' }, { status: 400 });
    }

    const path = `home-banners/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${detectedType.extension}`;
    const supabase = getServerSupabase();
    const { error } = await supabase.storage.from('physical-products').upload(path, fileBody, {
      contentType: detectedType.mimeType,
      cacheControl: '31536000',
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from('physical-products').getPublicUrl(path);
    if (!data.publicUrl?.startsWith('https://')) throw new Error('無法產生圖片公開網址');
    return NextResponse.json({ url: data.publicUrl, path });
  } catch (error: unknown) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error('Home banner upload failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : '圖片上傳失敗'
    }, { status: 500 });
  }
}
