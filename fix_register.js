const fs = require('fs');

let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Add state for confirm password
code = code.replace(
  'const [authPassword, setAuthPassword] = useState("");',
  'const [authPassword, setAuthPassword] = useState("");\n  const [authConfirmPassword, setAuthConfirmPassword] = useState("");'
);

// 2. Update handleRegister
const oldHandleRegister = `  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      showToast("❌ 註冊失敗: " + error.message);
    } else {
      showToast("✅ 註冊成功，請登入。");
      setIsRegisterMode(false);
    }
  };`;

const newHandleRegister = `  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authPassword !== authConfirmPassword) {
      showToast("❌ 兩次密碼輸入不一致");
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      showToast("❌ 註冊失敗: " + error.message);
    } else {
      // 這裡如果 Supabase 開啟了 Email Confirm，會需要收信驗證。
      // 開發期建議到 Supabase 關閉 Confirm email 功能。
      showToast("✅ 註冊成功，請登入測試。");
      setIsRegisterMode(false);
      setAuthConfirmPassword(""); // 清空
    }
  };`;
code = code.replace(oldHandleRegister, newHandleRegister);

// 3. Update Form UI to include Confirm Password
const oldFormFields = `              <div>
                <label className="block text-sm text-muted mb-2">密碼</label>
                <input required type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan" />
              </div>
              
              {!isRegisterMode && (`;

const newFormFields = `              <div>
                <label className="block text-sm text-muted mb-2">密碼</label>
                <input required type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan" />
              </div>

              {isRegisterMode && (
                <div>
                  <label className="block text-sm text-muted mb-2">確認密碼</label>
                  <input required type="password" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan" />
                </div>
              )}
              
              {!isRegisterMode && (`;

code = code.replace(oldFormFields, newFormFields);

fs.writeFileSync('src/app/page.tsx', code);
console.log('Register form patched.');
