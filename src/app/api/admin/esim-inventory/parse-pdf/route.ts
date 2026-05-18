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

    // 尋找 ICCID (通常是 19 或 20 位的數字，開頭為 89)
    const iccidRegex = /89[0-9]{17,18}/g;
    const iccids = [...text.matchAll(iccidRegex)].map(m => m[0]);

    // 方法 1: 尋找明確的 SM-DP+ Address 和 Activation Code 標籤
    const smdpRegex = /SM-DP\+\s*Address\s*:?\s*([a-zA-Z0-9.-]+)/gi;
    const actRegex = /Activation\s*Code\s*:?\s*([a-zA-Z0-9-]+)/gi;
    
    let smdpMatches = [...text.matchAll(smdpRegex)];
    let actMatches = [...text.matchAll(actRegex)];
    
    if (smdpMatches.length > 0 && actMatches.length > 0) {
      // 假設它們是成對出現的
      const count = Math.min(smdpMatches.length, actMatches.length);
      for (let i = 0; i < count; i++) {
        items.push({
          smdp_address: smdpMatches[i][1].trim(),
          activation_code: actMatches[i][1].trim(),
          iccid: '',
        });
      }
    }

    // 方法 2: 尋找 LPA 格式的字串 (e.g. LPA:1$smdp.plus.com$ACTIVATION-CODE)
    // 允許內部有換行或空白（因為 PDF 掃描可能斷行）
    if (items.length === 0) {
      const lpaRegex = /LPA:1\$([a-zA-Z0-9.-\s]+)\$([a-zA-Z0-9-\s]+)/gi;
      let match;
      const lpaSet = new Set();
      while ((match = lpaRegex.exec(text)) !== null) {
        const smdp = match[1].replace(/\s+/g, '');
        // 如果 Activation Code 後面接著其他文字，可能會被抓進來，這裡假設它是一連串英數字
        let code = match[2].replace(/\s+/g, '');
        // 防止把後面的 iOS 或 Android 字眼抓進來
        code = code.replace(/iOS.*|Android.*/i, '');
        
        if (!lpaSet.has(code)) {
          items.push({
            smdp_address: smdp,
            activation_code: code,
            iccid: '',
          });
          lpaSet.add(code);
        }
      }
    }

    // 如果有找到 ICCID，盡量按順序對應到找到的 eSIM 上
    items.forEach((item, index) => {
      if (iccids[index]) {
        item.iccid = iccids[index];
      }
    });

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