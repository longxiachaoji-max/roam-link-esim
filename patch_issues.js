const fs = require('fs');

// ====== Fix 1: Frontend Top-up Issue ======
let pageCode = fs.readFileSync('src/app/page.tsx', 'utf-8');

const oldTopUpBlock = `            <div className="grid grid-cols-3 gap-4 mb-6">
              {[200, 500, 1000].map((amount) => (
                <button 
                  key={amount} 
                  onClick={() => {
                    // 模擬儲值操作
                    setUser({...user, token_balance: user.token_balance + amount});
                    setIsTopUpOpen(false);
                    showToast(\`🎉 成功儲值 NT$ \${amount}！\`);
                  }}
                  className="bg-white/5 border border-white/10 hover:border-yellow hover:text-yellow rounded-xl p-4 flex flex-col items-center gap-2 transition-all"
                >
                  <span className="font-bold text-lg">{amount}</span>
                </button>
              ))}
            </div>

            <button 
              className="w-full bg-gradient-to-r from-coral to-yellow text-dark font-black py-4 rounded-xl hover:-translate-y-1 transition-all flex justify-center items-center gap-2"
            >
              <CreditCard size={20} />
              信用卡結帳 (即將開放)
            </button>`;

const newTopUpBlock = `            <div className="grid grid-cols-3 gap-4 mb-6">
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
            </button>`;

pageCode = pageCode.replace(oldTopUpBlock, newTopUpBlock);
fs.writeFileSync('src/app/page.tsx', pageCode);
console.log('Fixed Frontend Top-up (page.tsx)');


// ====== Fix 2: Backend Admin Top-up Issue ======
let adminCode = fs.readFileSync('src/app/admin/customers/page.tsx', 'utf-8');

const oldAdminHandle = `  const handleAddTokens = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(addAmount);
    
    if (isNaN(amount) || amount === 0) {
      showToast("⚠️ 請輸入有效的調整金額 (不可為 0)");
      return;
    }

    if (!reason.trim()) {
      showToast("⚠️ 請填寫手動調整的原因");
      return;
    }

    if (!selectedCustomer) return;

    // 模擬更新本地狀態
    const updatedCustomers = customers.map(c => 
      c.id === selectedCustomer.id 
        ? { ...c, token_balance: Math.max(0, c.token_balance + amount) } // 確保餘額不會變負數
        : c
    );
    
    setCustomers(updatedCustomers);
    
    console.log(\`[Log] \${selectedCustomer.email} 餘額變更: \${amount > 0 ? '+' : ''}\${amount}. 原因: \${reason}\`);

    showToast(\`✅ 成功為 \${selectedCustomer.email} \${amount > 0 ? '加值' : '扣除'} NT$\${Math.abs(amount)}\`);
    setSelectedCustomer(null);
    setAddAmount("");
    setReason("");
  };`;

const newAdminHandle = `  const handleAddTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(addAmount);
    
    if (isNaN(amount) || amount === 0) {
      showToast("⚠️ 請輸入有效的調整金額 (不可為 0)");
      return;
    }

    if (!reason.trim()) {
      showToast("⚠️ 請填寫手動調整的原因");
      return;
    }

    if (!selectedCustomer) return;

    const newBalance = Math.max(0, selectedCustomer.token_balance + amount);

    // Call Supabase update
    const { error } = await supabase
      .from('customers')
      .update({ token_balance: newBalance })
      .eq('id', selectedCustomer.id);

    if (error) {
      showToast("❌ 調整失敗: " + error.message);
      return;
    }

    // 更新本地狀態
    const updatedCustomers = customers.map(c => 
      c.id === selectedCustomer.id 
        ? { ...c, token_balance: newBalance }
        : c
    );
    
    setCustomers(updatedCustomers);
    console.log(\`[Log] \${selectedCustomer.email} 餘額變更: \${amount > 0 ? '+' : ''}\${amount}. 原因: \${reason}\`);

    showToast(\`✅ 成功為 \${selectedCustomer.email} \${amount > 0 ? '加值' : '扣除'} NT$\${Math.abs(amount)}\`);
    setSelectedCustomer(null);
    setAddAmount("");
    setReason("");
  };`;

adminCode = adminCode.replace(oldAdminHandle, newAdminHandle);
fs.writeFileSync('src/app/admin/customers/page.tsx', adminCode);
console.log('Fixed Backend Admin Top-up (page.tsx)');

