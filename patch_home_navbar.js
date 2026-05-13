const fs = require('fs');

let pageCode = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Remove TopUp state and replace with navigation
pageCode = pageCode.replace(
  'const [isTopUpOpen, setIsTopUpOpen] = useState(false); // 新增儲值介面狀態',
  '// TopUp modal moved to /member'
);

pageCode = pageCode.replace(
  '<button onClick={() => setIsTopUpOpen(true)} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full transition-colors border border-white/5">',
  '<button onClick={() => window.location.href="/member"} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full transition-colors border border-white/5">'
);

// 2. Remove the top up modal block in page.tsx to clean up
const oldTopUpModal = `{isTopUpOpen && user && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-[#1A1A2E] w-full max-w-sm rounded-3xl p-8 shadow-2xl relative">
            <button onClick={() => setIsTopUpOpen(false)} className="absolute top-4 right-4 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-white">✕</button>
            
            <h3 className="text-2xl font-black mb-6 text-center">儲值金加值</h3>
            
            <div className="bg-card-bg border border-white/10 rounded-xl p-4 mb-6 text-center">
                <p className="text-muted text-sm mb-2">您目前的儲值金餘額</p>
                <p className="text-4xl font-black text-yellow">NT$ {user.token_balance}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {[200, 500, 1000].map((amount) => (
                <button 
                  key={amount} 
                  onClick={() => {
                    showToast(\`⚠️ 正在導向 NT$ \${amount} 結帳 (等待綠界串接)\`);
                    // 在這裡應該要導向結帳頁面或是呼叫 API 產生付款連結
                  }}
                  className="bg-white/5 border border-white/10 hover:border-yellow hover:text-yellow rounded-xl p-4 flex flex-col items-center gap-2 transition-all"
                >
                  <span className="font-bold text-lg">{amount}</span>
                </button>
              ))}
            </div>

            <button 
              className="w-full bg-white/20 text-white/50 font-black py-4 rounded-xl flex justify-center items-center gap-2 cursor-not-allowed"
              disabled
            >
              <CreditCard size={20} />
              信用卡結帳 (等待綠界科技串接)
            </button>
          </div>
        </div>
      )}`;

pageCode = pageCode.replace(oldTopUpModal, '');

fs.writeFileSync('src/app/page.tsx', pageCode);
console.log('Homepage patched to navigate to /member');
