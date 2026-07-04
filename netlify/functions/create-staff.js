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

    const { full_name, phone, staff_code, role, password } = JSON.parse(event.body)
    if (!full_name || !staff_code || !role || !password) throw new Error('Missing required fields')
    if (password.length < 6) throw new Error('Password must be at least 6 characters')

    const email = `${staff_code.toLowerCase()}@orderdesk.internal`
    const code  = staff_code.toUpperCase()

    const { data: authData, error: createErr } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (createErr) throw createErr

    const { data: staffRecord, error: staffErr } = await adminClient
      .from('staff')
      .insert({ auth_user_id: authData.user.id, full_name, email, phone: phone || null, staff_code: code, role })
      .select()
      .single()

    if (staffErr) {
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw staffErr
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff: staffRecord }),
    }
  } catch (err) {
    return {
      statusCode: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
