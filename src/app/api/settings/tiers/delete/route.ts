import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServer } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const trainerId = String(payload?.trainer_id || '')
    const key = String(payload?.key || '')
    if (!trainerId || !key) return NextResponse.json({ error: 'Missing trainer_id or key' }, { status: 400 })

    // Verify the requester owns this trainer
    const supabase = createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: t } = await supabase
      .from('trainer')
      .select('trainer_id')
      .eq('trainer_id', trainerId)
      .eq('creator_id', uid)
      .limit(1)
    if (!t || !t[0]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Perform delete with service role to bypass RLS
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const keySR = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
    if (!url || !keySR) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    const admin = createAdminClient(url, keySR)
    await admin.from('tiers').delete().eq('trainer', trainerId).eq('key', key)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 })
  }
}

