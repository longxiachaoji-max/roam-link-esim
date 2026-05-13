const fs = require('fs');

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

    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          amount: amount,
          reason: reason
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || '調整失敗');
      }

      // 更新本地狀態
      const updatedCustomers = customers.map(c => 
        c.id === selectedCustomer.id 
          ? { ...c, token_balance: result.newBalance }
          : c
      );
      
      setCustomers(updatedCustomers);
      console.log(\`[Log] \${selectedCustomer.email} 餘額變更: \${amount > 0 ? '+' : ''}\${amount}. 原因: \${reason}\`);
      showToast(\`✅ 成功為 \${selectedCustomer.email} \${amount > 0 ? '加值' : '扣除'} NT$\${Math.abs(amount)}\`);
      setSelectedCustomer(null);
      setAddAmount("");
      setReason("");
      
      // 再抓取一次最新資料確保同步
      fetchCustomers();
    } catch (err: any) {
      showToast("❌ " + err.message);
    }
  };`;

adminCode = adminCode.replace(oldAdminHandle, newAdminHandle);
fs.writeFileSync('src/app/admin/customers/page.tsx', adminCode);
console.log('Fixed Backend Admin Top-up properly this time');
