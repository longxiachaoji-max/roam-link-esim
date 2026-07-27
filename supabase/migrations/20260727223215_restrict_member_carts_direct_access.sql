drop policy if exists "Deny direct member cart access" on public.member_carts;
create policy "Deny direct member cart access"
on public.member_carts
as restrictive
for all
to authenticated
using (false)
with check (false);
