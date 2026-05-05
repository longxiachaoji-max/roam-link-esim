-- ============================================================================
-- eSIM Project (Roam Link) - Initial Supabase Schema
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CUSTOMERS
-- ============================================================================
-- 儲存客戶資料與推薦人/活動代幣
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    token_balance INTEGER DEFAULT 0, -- 推薦人/活動代幣餘額
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 2. PRODUCTS (商品)
-- ============================================================================
-- 定義前台顯示的 eSIM 方案 (包含國家、用量)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL, -- 方案名稱 (e.g., "日本 5日 吃到飽")
    country VARCHAR(100) NOT NULL, -- 國家代碼或名稱
    data_limit VARCHAR(100), -- 數據用量 (e.g., "Unlimited", "1GB/day", "10GB")
    validity_days INTEGER NOT NULL, -- 有效天數
    price DECIMAL(10, 2) NOT NULL, -- 價格
    is_active BOOLEAN DEFAULT true, -- 是否上架
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 3. eSIM INVENTORY (庫存)
-- ============================================================================
-- 存放真正的 SM-DP+ 地址與啟用碼
CREATE TABLE e_sim_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    iccid VARCHAR(50) UNIQUE, -- 晶片序號
    smdp_address VARCHAR(255) NOT NULL, -- SM-DP+ 地址
    activation_code VARCHAR(255) NOT NULL, -- 啟用碼
    status VARCHAR(50) DEFAULT 'AVAILABLE', -- 'AVAILABLE' (可用), 'SOLD' (已售出), 'EXPIRED' (過期)
    expiry_date TIMESTAMP WITH TIME ZONE, -- eSIM 庫存本身之有效期限
    sold_at TIMESTAMP WITH TIME ZONE, -- 售出時間
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 4. PROMO CODES / REFERRALS (活動代碼)
-- ============================================================================
-- 透過生成隨機碼，用戶輸入後可獲得代幣
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    reward_tokens INTEGER NOT NULL, -- 兌換可獲得之代幣數量
    max_uses INTEGER DEFAULT 1, -- 最大可使用次數
    used_count INTEGER DEFAULT 0, -- 已使用次數
    expires_at TIMESTAMP WITH TIME ZONE, -- 兌換期限
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 5. ORDERS (訂單)
-- ============================================================================
-- 記錄客戶購買明細
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    total_amount DECIMAL(10, 2) NOT NULL, -- 總金額
    tokens_used INTEGER DEFAULT 0, -- 該筆訂單折抵之代幣
    payment_method VARCHAR(50), -- 支付方式 ('CREDIT_CARD', 'TOKENS', 'TAP_PAY', 'ECPAY')
    payment_status VARCHAR(50) DEFAULT 'PENDING', -- 支付狀態 ('PENDING', 'PAID', 'REFUNDED')
    order_status VARCHAR(50) DEFAULT 'CREATED', -- 訂單狀態 ('CREATED', 'COMPLETED', 'CANCELLED')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 6. ORDER ITEMS (訂單項目)
-- ============================================================================
-- 訂單與商品的對應關係，並與賣出的庫存綁定
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    inventory_id UUID REFERENCES e_sim_inventory(id), -- 訂單成立且付款後，配發具體庫存
    price DECIMAL(10, 2) NOT NULL, -- 該項目的購買時價格
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ============================================================================
-- TRIGGERS (自動更新 updated_at)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_e_sim_inventory_modtime BEFORE UPDATE ON e_sim_inventory FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
