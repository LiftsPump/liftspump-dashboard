import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServer } from '@/utils/supabase/server'

type Settings = {
  slotMinutes: number
  bufferMinutes: number
  workStart: number
  workEnd: number
  days: number[]
}

const DEFAULTS: Settings = { slotMinutes: 15, bufferMinutes: 0, workStart: 8, workEnd: 17, days: [0,1,2,3,4] }

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const trainer = url.searchParams.get('trainer_id')
  if (!trainer) return NextResponse.json({ settings: DEFAULTS })
  const supabase = createSupabaseServer()
  const { data } = await supabase
    .from('trainer_session_settings')
    .select('slot_minutes,buffer_minutes,work_start,work_end,days')
    .eq('trainer', trainer)
    .limit(1)
  if (!data || !data[0]) return NextResponse.json({ settings: DEFAULTS })
  const r = data[0] as any
  return NextResponse.json({ settings: {
    slotMinutes: r.slot_minutes ?? DEFAULTS.slotMinutes,
    bufferMinutes: r.buffer_minutes ?? DEFAULTS.bufferMinutes,
    workStart: r.work_start ?? DEFAULTS.workStart,
    workEnd: r.work_end ?? DEFAULTS.workEnd,
    days: Array.isArray(r.days) ? r.days : DEFAULTS.days,
  } })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const trainer = String(body?.trainer_id || '')
  const settings = body?.settings as Partial<Settings> | undefined
  if (!trainer || !settings) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const next: any = {
    trainer,
    slot_minutes: Math.max(5, Math.min(120, Number(settings.slotMinutes ?? DEFAULTS.slotMinutes))),
    buffer_minutes: Math.max(0, Math.min(120, Number(settings.bufferMinutes ?? DEFAULTS.bufferMinutes))),
    work_start: Math.max(0, Math.min(23, Number(settings.workStart ?? DEFAULTS.workStart))),
    work_end: Math.max(1, Math.min(24, Number(settings.workEnd ?? DEFAULTS.workEnd))),
    days: Array.isArray(settings.days) ? (settings.days as number[]).filter(n => n>=0 && n<7) : DEFAULTS.days,
  }
  const supabase = createSupabaseServer()
  const { data, error } = await supabase.from('trainer_session_settings').upsert(next, { onConflict: 'trainer' }).select('*').limit(1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const r = data?.[0] as any
  return NextResponse.json({ ok: true, settings: {
    slotMinutes: r.slot_minutes,
    bufferMinutes: r.buffer_minutes,
    workStart: r.work_start,
    workEnd: r.work_end,
    days: r.days,
  } })
}
