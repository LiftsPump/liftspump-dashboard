import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServer } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const trainer = url.searchParams.get('trainer_id')
  if (!trainer) return NextResponse.json({ sessions: [] })
  const supabase = createSupabaseServer()
  const { data, error } = await supabase
    .from('trainer_sessions')
    .select('id,trainer,user_id,user_email,title,start_at,end_at,meet_url')
    .eq('trainer', trainer)
    .order('start_at', { ascending: true })
  if (error) return NextResponse.json({ sessions: [] })
  const mapped = (data || []).map((r: any) => ({
    id: r.id,
    trainer: r.trainer,
    user_id: r.user_id || '',
    user_email: r.user_email || null,
    title: r.title || undefined,
    start_iso: new Date(r.start_at).toISOString(),
    end_iso: new Date(r.end_at).toISOString(),
    meet_url: r.meet_url,
  }))
  return NextResponse.json({ sessions: mapped })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const trainer = String(body?.trainer_id || '')
  const userId = String(body?.user_id || '')
  const userEmail = (body?.user_email ? String(body.user_email) : null) as string | null
  const startIso = String(body?.start_iso || '')
  const title = (body?.title ? String(body.title) : '') as string
  const durationMin = Math.max(5, Math.min(240, Number(body?.duration_min || 15)))
  if (!trainer || !userId || !startIso) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const start = new Date(startIso)
  if (isNaN(start.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  const end = new Date(start.getTime() + durationMin * 60 * 1000)
  const slug = Math.random().toString(36).slice(2,5) + '-' + Math.random().toString(36).slice(2,4) + '-' + Math.random().toString(36).slice(2,3)
  const meetUrl = `https://meet.google.com/${slug}`
  const supabase = createSupabaseServer()
  const row = {
    trainer,
    user_id: userId || null,
    user_email: userEmail,
    title: title || '15 min coaching session',
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    meet_url: meetUrl,
  }
  const { data, error } = await supabase.from('trainer_sessions').insert(row).select('*').limit(1)
  if (error) {
    // Overlap exclusion returns code 23xxx; map to 409
    const status = String(error.code || '').startsWith('23') ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  const r = data?.[0]
  const out = {
    id: r.id,
    trainer: r.trainer,
    user_id: r.user_id || '',
    user_email: r.user_email || null,
    title: r.title || undefined,
    start_iso: new Date(r.start_at).toISOString(),
    end_iso: new Date(r.end_at).toISOString(),
    meet_url: r.meet_url,
  }
  return NextResponse.json({ session: out })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const supabase = createSupabaseServer()
  const { error } = await supabase.from('trainer_sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const id = String(body?.id || '')
  const startIso = String(body?.start_iso || '')
  const title = body?.title ? String(body.title) : undefined
  const durationMin = Math.max(5, Math.min(240, Number(body?.duration_min || 15)))
  if (!id || !startIso) return NextResponse.json({ error: 'Missing id or start_iso' }, { status: 400 })
  const start = new Date(startIso)
  if (isNaN(start.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  const end = new Date(start.getTime() + durationMin * 60 * 1000)
  const supabase = createSupabaseServer()
  const patch: any = { start_at: start.toISOString(), end_at: end.toISOString() }
  if (typeof title === 'string') patch.title = title
  const { data, error } = await supabase.from('trainer_sessions').update(patch).eq('id', id).select('*').limit(1)
  if (error) {
    const status = String(error.code || '').startsWith('23') ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  const r = data?.[0]
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const out = {
    id: r.id,
    trainer: r.trainer,
    user_id: r.user_id || '',
    user_email: r.user_email || null,
    title: r.title || undefined,
    start_iso: new Date(r.start_at).toISOString(),
    end_iso: new Date(r.end_at).toISOString(),
    meet_url: r.meet_url,
  }
  return NextResponse.json({ session: out })
}
