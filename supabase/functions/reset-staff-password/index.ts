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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Not authenticated')

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !user) throw new Error('Not authenticated')

    const { data: caller } = await adminClient
      .from('staff')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (!caller || !['ceo', 'operations_manager'].includes(caller.role)) {
      throw new Error('Not authorized')
    }

    const { staff_id, new_password } = await req.json()
    if (!staff_id || !new_password) throw new Error('Missing required fields')
    if (new_password.length < 6) throw new Error('Password must be at least 6 characters')

    // Fetch the target staff record
    const { data: target, error: fetchErr } = await adminClient
      .from('staff')
      .select('id, auth_user_id, staff_code, email')
      .eq('id', staff_id)
      .single()

    if (fetchErr || !target) throw new Error('Staff member not found')

    if (target.auth_user_id) {
      // Auth user exists — just update the password
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(
        target.auth_user_id,
        { password: new_password }
      )
      if (updateErr) throw updateErr
    } else {
      // No auth user yet (seeded staff) — create one now
      const email = `${target.staff_code.toLowerCase()}@orderdesk.internal`
      const { data: authData, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password: new_password,
        email_confirm: true,
      })
      if (createErr) throw createErr

      // Link auth user to staff record
      const { error: linkErr } = await adminClient
        .from('staff')
        .update({ auth_user_id: authData.user.id, email })
        .eq('id', staff_id)

      if (linkErr) {
        await adminClient.auth.admin.deleteUser(authData.user.id)
        throw linkErr
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
