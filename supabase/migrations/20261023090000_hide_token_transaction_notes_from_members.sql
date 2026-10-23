-- 後台儲值／調整的備註原因與收款金額不能讓會員看到。
-- 網站只透過 /api/member/topup-history（service role）讀取並過濾說明，
-- 前端沒有直接查 token_transactions，所以移除會員直接讀取原始資料的權限。
drop policy if exists "Members read own token transactions" on public.token_transactions;
drop policy if exists "Users can view their own token transactions" on public.token_transactions;
