import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabase } from '@/lib/supabase';

// 延後初始化或提供 fallback，避免 Vercel 建置期間因為沒有環境變數而崩潰
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build');

export async function POST(request: Request) {
  try {
    const { name, email, items, total } = await request.json();

    // 1. 建立訂單紀錄 (模擬)
    /*
    const { data: order, error } = await supabase
      .from('orders')
      .insert([
        { customer_name: name, customer_email: email, total_amount: total, status: 'paid' }
      ])
      .select()
      .single();
    */

    // 2. 寄送含 QR Code 的 Email 給客戶
    const emailResponse = await resend.emails.send({
      from: 'Roam Link eSIM <onboarding@resend.dev>', // 正式上線會換成您的專屬網域信箱
      to: email,
      subject: '✈️ 您的 Roam Link eSIM 購買成功！(內附 QR Code 安裝指南)',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #FF4E6A;">感謝您的購買，${name}！</h2>
          <p>您購買的 eSIM 方案已準備就緒，以下是您的訂單明細：</p>
          <ul style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            ${items.map((item: any) => `<li>${item.flag} ${item.country} ${item.data} (${item.days}) - NT$${item.price}</li>`).join('')}
          </ul>
          <h3>您的 eSIM QR Code ⬇️</h3>
          <p>請使用手機掃描下方 QR Code，或手動輸入啟用碼來加入行動方案。</p>
          <div style="text-align: center; border: 2px dashed #ccc; padding: 20px; margin: 20px 0;">
            <p style="font-size: 12px; color: #888;">[系統將自動抓取庫存的 QR Code 顯示於此]</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=LPA:1$smdp2.apple.com$模擬的啟動碼" alt="eSIM QR Code" />
            <br/><br/>
            <p><strong>手動輸入位址：</strong> smdp2.apple.com</p>
            <p><strong>手動輸入啟用碼：</strong> ABCD-EFGH-IJKL-MNOP</p>
          </div>
          <p>祝您旅途愉快！</p>
          <p><strong>一飛通全球漫遊 團隊敬上</strong></p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: '訂單成立且郵件已寄出' });
  } catch (error) {
    return NextResponse.json({ success: false, error: '系統錯誤' }, { status: 500 });
  }
}
