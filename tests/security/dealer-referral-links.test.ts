import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tracked referral links are private and clicks are incremented atomically", async () => {
  const migration = await readFile(
    new URL(
      "../../supabase/migrations/20260904010000_dealer_referral_tracking_links.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /dealer_referral_links enable row level security/i);
  assert.match(
    migration,
    /revoke all on public\.dealer_referral_links from public, anon, authenticated/i,
  );
  assert.match(migration, /click_count = link\.click_count \+ 1/i);
  assert.match(
    migration,
    /grant execute[\s\S]+record_dealer_referral_link_click[\s\S]+to service_role/i,
  );
});

test("admin must authenticate and can only create a link for the dealer's active code", async () => {
  const route = await readFile(
    new URL(
      "../../src/app/api/admin/dealer-referral-links/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(route, /requireAdminUser\(request\)/);
  assert.match(route, /\.eq\("dealer_id", dealerId\)/);
  assert.match(route, /\.eq\("is_active", true\)/);
  assert.match(route, /\.eq\("sales_mode", "referral"\)/);
});

test("public tracking route redirects only to the fixed website with a referral code", async () => {
  const route = await readFile(
    new URL("../../src/app/r/[slug]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /const \{ slug \} = await params/);
  assert.match(route, /const siteUrl = "https:\/\/firstesim\.space"/);
  assert.match(route, /record_dealer_referral_link_click/);
  assert.match(route, /target\.searchParams\.set\("ref", referralCode\)/);
  assert.match(route, /Cache-Control", "no-store/);
});

test("admin dealer area exposes named promotion links and traffic counts", async () => {
  const page = await readFile(
    new URL("../../src/app/admin/dealers/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /宣傳網址與流量/);
  assert.match(page, /來源名稱/);
  assert.match(page, /點擊次數/);
  assert.match(page, /最後點擊/);
});
