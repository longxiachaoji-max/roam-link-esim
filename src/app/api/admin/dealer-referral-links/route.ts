import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  authenticationErrorResponse,
  getServerSupabase,
  requireAdminUser,
} from "@/lib/server-auth";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const supabase = getServerSupabase();
    const [{ data: links, error: linksError }, { data: codes, error: codesError }] =
      await Promise.all([
        supabase
          .from("dealer_referral_links")
          .select(
            "id, dealer_id, referral_code_id, name, slug, click_count, last_clicked_at, created_at, dealer_referral_codes ( code )",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("dealer_referral_codes")
          .select("id, dealer_id, code, is_active")
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
      ]);
    if (linksError) throw linksError;
    if (codesError) throw codesError;
    return NextResponse.json({ links: links || [], codes: codes || [] });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error("Admin referral links read failed:", error);
    return NextResponse.json(
      { error: "讀取宣傳網址資料失敗" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const supabase = getServerSupabase();
    const body = await request.json();
    const dealerId = String(body.dealerId || "");
    const referralCodeId = String(body.referralCodeId || "");
    const name = String(body.name || "").trim().slice(0, 80);

    if (
      !UUID_PATTERN.test(dealerId) ||
      !UUID_PATTERN.test(referralCodeId) ||
      !name
    ) {
      return NextResponse.json(
        { error: "請選擇經銷商、推薦碼並填寫網址名稱" },
        { status: 400 },
      );
    }

    const [{ data: dealer, error: dealerError }, { data: code, error: codeError }] =
      await Promise.all([
        supabase
          .from("dealers")
          .select("id")
          .eq("id", dealerId)
          .eq("status", "approved")
          .eq("sales_mode", "referral")
          .maybeSingle(),
        supabase
          .from("dealer_referral_codes")
          .select("id")
          .eq("id", referralCodeId)
          .eq("dealer_id", dealerId)
          .eq("is_active", true)
          .maybeSingle(),
      ]);
    if (dealerError) throw dealerError;
    if (codeError) throw codeError;
    if (!dealer || !code) {
      return NextResponse.json(
        { error: "此經銷商或推薦碼目前不可建立宣傳網址" },
        { status: 409 },
      );
    }

    const slug = randomBytes(8).toString("hex");
    const { data, error } = await supabase
      .from("dealer_referral_links")
      .insert({
        dealer_id: dealerId,
        referral_code_id: referralCodeId,
        name,
        slug,
      })
      .select(
        "id, dealer_id, referral_code_id, name, slug, click_count, last_clicked_at, created_at, dealer_referral_codes ( code )",
      )
      .single();
    if (error) throw error;
    return NextResponse.json({ link: data }, { status: 201 });
  } catch (error) {
    const authError = authenticationErrorResponse(error);
    if (authError) return authError;
    console.error("Admin referral link create failed:", error);
    return NextResponse.json({ error: "建立宣傳網址失敗" }, { status: 500 });
  }
}
