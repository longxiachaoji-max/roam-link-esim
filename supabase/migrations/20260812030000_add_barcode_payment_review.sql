alter table public.orders
  add column if not exists ecpay_payment_method text,
  add column if not exists ecpay_merchant_trade_no text,
  add column if not exists payment_proof_path text,
  add column if not exists payment_proof_uploaded_at timestamptz,
  add column if not exists manual_payment_confirmed_at timestamptz,
  add column if not exists manual_payment_confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists ecpay_paid_at timestamptz;

alter table public.orders
  drop constraint if exists orders_ecpay_payment_method_check;

alter table public.orders
  add constraint orders_ecpay_payment_method_check
  check (
    ecpay_payment_method is null
    or ecpay_payment_method in ('Credit', 'ApplePay', 'BARCODE')
  );

create unique index if not exists idx_orders_ecpay_merchant_trade_no
  on public.orders (ecpay_merchant_trade_no)
  where ecpay_merchant_trade_no is not null;

create index if not exists idx_orders_barcode_review
  on public.orders (payment_status, created_at desc)
  where ecpay_payment_method = 'BARCODE';

comment on column public.orders.payment_proof_path is
  'Private Storage object path for a member-uploaded barcode payment receipt.';
comment on column public.orders.manual_payment_confirmed_at is
  'Time an administrator manually approved payment before the ECPay settlement callback.';
comment on column public.orders.ecpay_paid_at is
  'Time ECPay confirmed that the payment was received.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'barcode-payment-proofs',
  'barcode-payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
