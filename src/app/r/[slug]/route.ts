import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/server-auth";

const SLUG_PATTERN = /^[a-z0-9]{16}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  const siteUrl = "https://firstesim.space";
  const target = new URL("/", siteUrl);

  if (SLUG_PATTERN.test(normalizedSlug)) {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.rpc(
      "record_dealer_referral_link_click",
      { p_slug: normalizedSlug },
    );
    if (!error) {
      const referralCode = String(data?.[0]?.referral_code || "");
      if (referralCode) target.searchParams.set("ref", referralCode);
    } else {
      console.error("Referral link tracking failed:", error);
    }
  }

  const response = NextResponse.redirect(target, 302);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
