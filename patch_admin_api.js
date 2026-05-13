const fs = require('fs');

let adminCode = fs.readFileSync('src/app/admin/customers/page.tsx', 'utf-8');

const oldAdminHandle = `  const handleAddTokens = async (e: React.FormEvent) => {
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

    // Call Supabase API to bypass client RLS issues if any, or use the direct supabase call
    // Actually we added /api/admin/customers route previously, let's just use supabase direct.
    // If it fails silently we need to check RLS.
    // We will just do the direct call and log the error.
    const { data, error } = await supabase
      .from('customers')
      .update({ token_balance: newBalance })
      .eq('id', selectedCustomer.id)
      .select();

    if (error) {
      showToast("❌ 調整失敗: " + error.message);
      console.error(error);
      return;
    }
    
    if (!data || data.length === 0) {
      // Possible RLS block since anon key cannot update by default
      // For a quick fix, let's call the API if it exists, or just log.
      showToast("❌ 調整失敗: RLS Policy 可能阻擋了更新。請確認已開啟資料表 UPDATE 權限");
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

    // Call internal Next.js API route to bypass Row Level Security (RLS) limitations
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      showToast(\`✅ 成功為 \${selectedCustomer.email} \${amount > 0 ? '加值' : '扣除'} NT$\${Math.abs(amount)}\`);
      setSelectedCustomer(null);
      setAddAmount("");
      setReason("");
    } catch (err: any) {
      showToast("❌ " + err.message);
    }
  };`;

adminCode = adminCode.replace(oldAdminHandle, newAdminHandle);
fs.writeFileSync('src/app/admin/customers/page.tsx', adminCode);
console.log('Admin correctly mapped to API route');
