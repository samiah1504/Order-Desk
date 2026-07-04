const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' }

  const URL  = process.env.VITE_SUPABASE_URL
  const ANON = process.env.VITE_SUPABASE_ANON_KEY
  const SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY

  const ok  = (r, body) => ({ statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const err = (msg)     => ({ statusCode: 400, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) })

  try {
    const authHeader = event.headers.authorization
    if (!authHeader) return err('Not authenticated')

    // Verify the caller's JWT
    const userRes = await fetch(`${URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: authHeader },
    })
    if (!userRes.ok) return err('Not authenticated')
    const { id: userId } = await userRes.json()

    // Check caller is CEO or operations_manager
    const callerRes = await fetch(`${URL}/rest/v1/staff?auth_user_id=eq.${userId}&select=role&limit=1`, {
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
    })
    const [caller] = await callerRes.json()
    if (!caller || !['ceo', 'operations_manager'].includes(caller.role)) return err('Not authorized')

    const { full_name, phone, staff_code, role, password } = JSON.parse(event.body)
    if (!full_name || !staff_code || !role || !password) return err('Missing required fields')
    if (password.length < 6) return err('Password must be at least 6 characters')

    const email = `${staff_code.toLowerCase()}@orderdesk.internal`
    const code  = staff_code.toUpperCase()

    // Create auth user
    const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
    const createData = await createRes.json()
    if (!createRes.ok) return err(createData.message || createData.msg || 'Failed to create auth user')
    const authUserId = createData.id

    // Insert staff record
    const staffRes = await fetch(`${URL}/rest/v1/staff`, {
      method: 'POST',
      headers: {
        apikey: SRK, Authorization: `Bearer ${SRK}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify({ auth_user_id: authUserId, full_name, email, phone: phone || null, staff_code: code, role }),
    })
    const staffData = await staffRes.json()
    if (!staffRes.ok) {
      // Roll back auth user
      await fetch(`${URL}/auth/v1/admin/users/${authUserId}`, {
        method: 'DELETE',
        headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
      })
      return err(staffData.message || 'Failed to create staff record')
    }

    return ok(null, { staff: Array.isArray(staffData) ? staffData[0] : staffData })
  } catch (e) {
    return err(e.message || 'Unexpected error')
  }
}
