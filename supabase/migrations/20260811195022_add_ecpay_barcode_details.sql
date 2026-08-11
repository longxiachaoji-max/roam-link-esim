alter table public.orders
  add column if not exists ecpay_trade_no text,
  add column if not exists ecpay_barcode_1 text,
  add column if not exists ecpay_barcode_2 text,
  add column if not exists ecpay_barcode_3 text,
  add column if not exists ecpay_barcode_expires_at timestamptz,
  add column if not exists ecpay_barcode_created_at timestamptz;

comment on column public.orders.ecpay_trade_no is
  'ECPay provider-side transaction number returned when a payment code is created.';
comment on column public.orders.ecpay_barcode_1 is
  'First Code 39 segment for an ECPay convenience-store barcode payment.';
comment on column public.orders.ecpay_barcode_2 is
  'Second Code 39 segment for an ECPay convenience-store barcode payment.';
comment on column public.orders.ecpay_barcode_3 is
  'Third Code 39 segment for an ECPay convenience-store barcode payment.';
comment on column public.orders.ecpay_barcode_expires_at is
  'Payment deadline returned by ECPay for the convenience-store barcode.';
