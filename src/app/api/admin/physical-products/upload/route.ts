import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getPhysicalStoreAdmin, requirePhysicalStoreAdmin } from '@/lib/physical-store';

export const runtime = 'nodejs';

const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif']
]);

export async function POST(request: Request) {
  try {
    await requirePhysicalStoreAdmin(request);
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: '請選擇圖片' }, { status: 400 });
    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension) return NextResponse.json({ error: '只支援 JPG、PNG、WebP 或 AVIF 圖片' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: '圖片不可超過 5MB' }, { status: 400 });

    const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const supabase = getPhysicalStoreAdmin();
    const { error } = await supabase.storage.from('physical-products').upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from('physical-products').getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, path });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '圖片上傳失敗' }, { status: 500 });
  }
}
