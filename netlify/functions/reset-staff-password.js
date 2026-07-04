const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' }

  const URL  = process.env.VITE_SUPABASE_URL
  const ANON = process.env.VITE_SUPABASE_ANON_KEY
  const SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY

  const ok  = (body) => ({ statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const err = (msg)  => ({ statusCode: 400, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) })

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

    const { staff_id, new_password } = JSON.parse(event.body)
    if (!staff_id || !new_password) return err('Missing required fields')
    if (new_password.length < 6) return err('Password must be at least 6 characters')

    // Fetch the target staff record
    const targetRes = await fetch(`${URL}/rest/v1/staff?id=eq.${staff_id}&select=id,auth_user_id,staff_code&limit=1`, {
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
    })
    const [target] = await targetRes.json()
    if (!target) return err('Staff member not found')

    if (target.auth_user_id) {
      // Auth user exists — update the password
      const updateRes = await fetch(`${URL}/auth/v1/admin/users/${target.auth_user_id}`, {
        method: 'PUT',
        headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: new_password }),
      })
      if (!updateRes.ok) {
        const d = await updateRes.json()
        return err(d.message || 'Failed to update password')
      }
    } else {
      // No auth account yet — create one and link it
      const email = `${target.staff_code.toLowerCase()}@orderdesk.internal`
      const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: new_password, email_confirm: true }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) return err(createData.message || 'Failed to create auth user')

      const linkRes = await fetch(`${URL}/rest/v1/staff?id=eq.${staff_id}`, {
        method: 'PATCH',
        headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_user_id: createData.id, email }),
      })
      if (!linkRes.ok) {
        await fetch(`${URL}/auth/v1/admin/users/${createData.id}`, {
          method: 'DELETE',
          headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
        })
        return err('Failed to link auth account')
      }
    }

    return ok({ success: true })
  } catch (e) {
    return err(e.message || 'Unexpected error')
  }
}
