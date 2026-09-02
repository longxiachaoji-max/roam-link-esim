'use client';

import { useEffect } from 'react';
import { rememberReferralCode } from '@/lib/referral-link';

export default function ReferralLinkCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code) rememberReferralCode(code);
  }, []);

  return null;
}
