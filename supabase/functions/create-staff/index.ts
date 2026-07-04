import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Not authenticated')

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !user) throw new Error('Not authenticated')

    // Verify caller is CEO or operations_manager
    const { data: caller } = await adminClient
      .from('staff')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (!caller || !['ceo', 'operations_manager'].includes(caller.role)) {
      throw new Error('Not authorized')
    }

    const { full_name, phone, staff_code, role, password } = await req.json()
    if (!full_name || !staff_code || !role || !password) throw new Error('Missing required fields')
    if (password.length < 6) throw new Error('Password must be at least 6 characters')

    const email = `${staff_code.toLowerCase()}@orderdesk.internal`
    const code  = staff_code.toUpperCase()

    // Create auth user
    const { data: authData, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) throw createErr

    // Insert staff record
    const { data: staffRecord, error: staffErr } = await adminClient
      .from('staff')
      .insert({ auth_user_id: authData.user.id, full_name, email, phone: phone || null, staff_code: code, role })
      .select()
      .single()

    if (staffErr) {
      // Roll back the auth user so we don't leave orphans
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw staffErr
    }

    return new Response(JSON.stringify({ staff: staffRecord }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
