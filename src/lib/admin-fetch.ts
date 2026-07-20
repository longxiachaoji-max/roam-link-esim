import { authenticatedFetch } from '@/lib/authenticated-fetch';

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return authenticatedFetch(input, init);
}
