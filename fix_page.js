const fs = require('fs');

let pageCode = fs.readFileSync('src/app/page.tsx', 'utf-8');

// The replacement in patch_home_navbar.js probably failed because of some whitespace difference.
// Let's remove the whole block programmatically.
// Find `{/* 儲值對話框 */}` to the end of the modal.

pageCode = pageCode.replace(/\{\/\* 儲值對話框 \*\/\}[\s\S]*?<\/div>\n      \)\}/, '');
pageCode = pageCode.replace(/const \[isTopUpOpen, setIsTopUpOpen\] = useState\(false\);/g, '');

// Fix the navigation bar click event if it still has `setIsTopUpOpen`
pageCode = pageCode.replace(/onClick=\{\(\) => setIsTopUpOpen\(true\)\}/g, 'onClick={() => window.location.href="/member"}');

fs.writeFileSync('src/app/page.tsx', pageCode);
console.log('Fixed page.tsx compilation errors');
