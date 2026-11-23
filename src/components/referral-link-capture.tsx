'use client';

import { useEffect } from 'react';
import { rememberReferralCode } from '@/lib/referral-link';
import { captureAttribution } from '@/lib/attribution-client';

export default function ReferralLinkCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code) rememberReferralCode(code);
    captureAttribution();
  }, []);

  return null;
}
