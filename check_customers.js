const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data } = await supabase.from('customers').select('*');
  console.log("Customers in DB:", data);
  if(data && data.length > 0) {
    const id = data[0].id;
    console.log("Attempting to update customer:", id);
    const { data: updated, error } = await supabase.from('customers').update({ token_balance: data[0].token_balance + 100 }).eq('id', id).select();
    console.log("Update result:", updated, "Error:", error);
  }
}
run();
