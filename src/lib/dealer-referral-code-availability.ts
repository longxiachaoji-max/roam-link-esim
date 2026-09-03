import type { SupabaseClient } from "@supabase/supabase-js";
import { readReferralConfig } from "@/lib/referrals";

export async function dealerReferralCodeIsAvailable(
  supabase: SupabaseClient,
  code: string,
  excludeDealerId = "",
) {
  const dealerQuery = supabase
    .from("dealers")
    .select("id")
    .eq("referral_code", code);
  if (excludeDealerId) dealerQuery.neq("id", excludeDealerId);

  const [
    { data: codeConflict, error: codeError },
    { data: dealerConflict, error: dealerError },
    { data: promoConflict, error: promoError },
    referral,
  ] = await Promise.all([
    supabase
      .from("dealer_referral_codes")
      .select("dealer_id")
      .eq("code", code)
      .maybeSingle(),
    dealerQuery.maybeSingle(),
    supabase.from("promo_codes").select("id").eq("code", code).maybeSingle(),
    readReferralConfig(supabase),
  ]);

  if (codeError) throw codeError;
  if (dealerError) throw dealerError;
  if (promoError) throw promoError;

  const codeOwnedByApplicant =
    excludeDealerId && codeConflict?.dealer_id === excludeDealerId;
  const memberConflict = Object.values(referral.config.customers).some(
    (rule) => rule.code === code,
  );
  return !(
    (codeConflict && !codeOwnedByApplicant) ||
    dealerConflict ||
    promoConflict ||
    memberConflict
  );
}
