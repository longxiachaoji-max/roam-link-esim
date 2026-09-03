import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/server-auth";
import { dealerReferralCodeIsAvailable } from "@/lib/dealer-referral-code-availability";
import {
  MIN_REFERRAL_CODE_LENGTH,
  normalizeReferralCode,
  referralCodeLength,
} from "@/lib/referral-code";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = normalizeReferralCode(String(body.code || ""));
    if (referralCodeLength(code) < MIN_REFERRAL_CODE_LENGTH) {
      return NextResponse.json(
        {
          error: `推薦碼至少需要 ${MIN_REFERRAL_CODE_LENGTH} 個中英文字或數字`,
        },
        { status: 400 },
      );
    }

    const available = await dealerReferralCodeIsAvailable(
      getServerSupabase(),
      code,
    );
    if (!available) {
      return NextResponse.json(
        { error: "此推薦碼已被使用，請更換其他推薦碼" },
        { status: 409 },
      );
    }
    return NextResponse.json({ available: true, code });
  } catch (error) {
    console.error("Dealer referral code availability check failed:", error);
    return NextResponse.json(
      { error: "推薦碼檢查失敗，請稍後再試" },
      { status: 500 },
    );
  }
}
