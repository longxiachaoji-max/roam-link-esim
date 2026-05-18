import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await req.json();
    if (!data.base64) {
      return NextResponse.json({ error: '缺少 PDF 資料' }, { status: 400 });
    }

    const buffer = Buffer.from(data.base64, 'base64');
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    // 解析 PDF 文字
    // 這裡使用通用的 Regex 來尋找 SM-DP+ 和 Activation Code 和 ICCID
    // 廠商的 PDF 格式可能有所不同，但通常會包含類似 "SM-DP+ Address", "Activation Code" 等字眼
    // 或者直接找 LPA:1$smdp.xxx$activation_code 格式
    
    let items = [];

    // 方法 1: 尋找 LPA 格式的字串 (e.g. LPA:1$smdp.plus.com$ACTIVATION-CODE)
    const lpaRegex = /LPA:1\$([^$]+)\$([a-zA-Z0-9-]+)/gi;
    let match;
    const lpaSet = new Set();
    while ((match = lpaRegex.exec(text)) !== null) {
      const smdp = match[1].trim();
      const code = match[2].trim();
      if (!lpaSet.has(code)) {
        items.push({
          smdp_address: smdp,
          activation_code: code,
          iccid: '',
        });
        lpaSet.add(code);
      }
    }

    // 尋找 ICCID (通常是 19 或 20 位的數字，開頭為 89)
    const iccidRegex = /89[0-9]{17,18}/g;
    const iccids = [...text.matchAll(iccidRegex)].map(m => m[0]);
    
    // 如果有找到 ICCID，盡量按順序對應到找到的 eSIM 上
    // (這是一個猜測性的對應，因為 PDF 裡的排列順序可能會對齊)
    items.forEach((item, index) => {
      if (iccids[index]) {
        item.iccid = iccids[index];
      }
    });

    // 方法 2: 如果沒有抓到 LPA 格式，嘗試找一般的文字欄位
    // 這邊保留簡單擴充，但大部分供應商的 PDF 掃描結果都會有 LPA 字串或是分開的欄位
    if (items.length === 0) {
      // 假設廠商是用文字寫 SM-DP+ Address: xxxx \n Activation Code: xxxx
      // 這裡可以依據實際測試到的 PDF 再進一步強化 Regex
    }

    return NextResponse.json({ 
      success: true, 
      items, 
      rawTextPreview: text.substring(0, 500) 
    });

  } catch (error: any) {
    console.error('PDF 解析錯誤:', error);
    return NextResponse.json({ error: error.message || '無法解析此 PDF 檔案' }, { status: 500 });
  }
}