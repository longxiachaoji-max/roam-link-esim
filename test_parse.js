const fs = require('fs');
const pdfParse = require('pdf-parse');

async function test() {
  const buffer = fs.readFileSync('/Users/chaojilongxia/.openclaw/media/inbound/樹林弟弟---2db9628b-0e0d-436d-a470-c5eab3b82f3f.pdf');
  const data = await pdfParse(buffer);
  const text = data.text;
  
  let items = [];
  
  // Find all ICCIDs
  const iccidRegex = /89[0-9]{17,18}/g;
  const iccids = [...text.matchAll(iccidRegex)].map(m => m[0]);
  
  // Match SM-DP+ and Activation Code specifically
  // Since they might be split across lines, let's use a very flexible regex on the original text
  // We can look for "SM-DP+Address:" followed by a value, and "ActivationCode:" followed by a value
  const smdpRegex = /SM-DP\+\s*Address\s*:?\s*([a-zA-Z0-9.-]+)/gi;
  const actRegex = /Activation\s*Code\s*:?\s*([a-zA-Z0-9-]+)/gi;
  
  let smdpMatches = [...text.matchAll(smdpRegex)];
  let actMatches = [...text.matchAll(actRegex)];
  
  if (smdpMatches.length > 0 && actMatches.length > 0 && smdpMatches.length === actMatches.length) {
      for (let i = 0; i < smdpMatches.length; i++) {
          items.push({
              smdp_address: smdpMatches[i][1],
              activation_code: actMatches[i][1],
              iccid: ''
          });
      }
  }

  // If that fails, try LPA format but ignoring spaces/newlines
  if (items.length === 0) {
      const lpaRegex = /LPA:1\$([a-zA-Z0-9.-\s]+)\$([a-zA-Z0-9-\s]+)/gi;
      let match;
      while ((match = lpaRegex.exec(text)) !== null) {
          const smdp = match[1].replace(/\s+/g, '');
          let code = match[2].replace(/\s+/g, '');
          // Sometimes code might trail into other words if there's no clear boundary.
          items.push({
              smdp_address: smdp,
              activation_code: code,
              iccid: ''
          });
      }
  }
  
  items.forEach((item, index) => {
      if (iccids[index]) {
          item.iccid = iccids[index];
      }
  });
  
  console.log(items);
}
test();
