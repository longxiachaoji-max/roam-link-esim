import { supabase } from '@/lib/supabase';

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const send = (accessToken?: string) => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers });
  };

  const { data } = await supabase.auth.getSession();
  const response = await send(data.session?.access_token);
  if (response.status !== 401 || !data.session) return response;

  const { data: refreshed } = await supabase.auth.refreshSession();
  if (!refreshed.session?.access_token) return response;
  return send(refreshed.session.access_token);
}
