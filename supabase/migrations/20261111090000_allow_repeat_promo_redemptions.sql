-- 舊的唯一限制讓同一會員對同一優惠碼只能有一筆紀錄，
-- 和後台「每人可用次數」大於 1 的設定衝突，導致第二次使用時結帳失敗（23505）。
-- 次數上限已由結帳函式與 API 依 max_uses_per_user 檢查；保留一般索引供查詢。
alter table public.promo_redemptions
  drop constraint if exists promo_redemptions_customer_id_promo_code_id_key;
