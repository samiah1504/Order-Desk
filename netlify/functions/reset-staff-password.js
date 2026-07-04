const { createClient } = require('@supabase/supabase-js')

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' }

  try {
    const adminClient = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = event.headers.authorization
    if (!authHeader) throw new Error('Not authenticated')

    const callerClient = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
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

    const { staff_id, new_password } = JSON.parse(event.body)
    if (!staff_id || !new_password) throw new Error('Missing required fields')
    if (new_password.length < 6) throw new Error('Password must be at least 6 characters')

    const { data: target, error: fetchErr } = await adminClient
      .from('staff')
      .select('id, auth_user_id, staff_code')
      .eq('id', staff_id)
      .single()

    if (fetchErr || !target) throw new Error('Staff member not found')

    if (target.auth_user_id) {
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(
        target.auth_user_id,
        { password: new_password }
      )
      if (updateErr) throw updateErr
    } else {
      const email = `${target.staff_code.toLowerCase()}@orderdesk.internal`
      const { data: authData, error: createErr } = await adminClient.auth.admin.createUser({
        email, password: new_password, email_confirm: true,
      })
      if (createErr) throw createErr

      const { error: linkErr } = await adminClient
        .from('staff')
        .update({ auth_user_id: authData.user.id, email })
        .eq('id', staff_id)

      if (linkErr) {
        await adminClient.auth.admin.deleteUser(authData.user.id)
        throw linkErr
      }
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    }
  } catch (err) {
    return {
      statusCode: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
