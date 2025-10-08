import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServer } from '@/utils/supabase/server'

type ExerciseRow = {
  id: string
  trainer: string
  name: string
  category: string | null
  equipment: string | null
  primary_muscles: string[]
  secondary_muscles: string[]
  instructions: string[]
  ecode: string
  images: string[]
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const trainer = url.searchParams.get('trainer_id')
  if (!trainer) return NextResponse.json({ exercises: [] })

  const supabase = createSupabaseServer()
  const { data, error } = await supabase
    .from('exercises_custom')
    .select('id,trainer,name,category,equipment,primary_muscles,secondary_muscles,instructions,ecode,images')
    .eq('trainer', trainer)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ exercises: [] })
  const mapped = (data as ExerciseRow[]).map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    equipment: r.equipment,
    primaryMuscles: r.primary_muscles || [],
    secondaryMuscles: r.secondary_muscles || [],
    instructions: r.instructions || [],
    ecode: r.ecode || "",
    images: r.images || [],
  }))
  return NextResponse.json({ exercises: mapped })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const trainer = String(body?.trainer_id || '')
  const exercise = body?.exercise as any
  if (!trainer || !exercise || !exercise.name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = createSupabaseServer()
  // Upsert based on id when provided, else insert new
  // TODO make sure exercise ecode is unique to that trainer
  const row = {
    id: exercise.id || undefined,
    trainer,
    name: String(exercise.name),
    category: exercise.category ?? null,
    equipment: exercise.equipment ?? null,
    primary_muscles: Array.isArray(exercise.primaryMuscles) ? exercise.primaryMuscles : [],
    secondary_muscles: Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles : [],
    instructions: Array.isArray(exercise.instructions) ? exercise.instructions : [],
    ecode: String(trainer+exercise.ecode),
    images: Array.isArray(exercise.images) ? exercise.images : [],
  }
  let res
  if (row.id) {
    res = await supabase.from('exercises_custom').update(row).eq('id', row.id).select('*').limit(1)
  } else {
    res = await supabase.from('exercises_custom').insert(row).select('*').limit(1)
  }
  const { data, error } = res as any
  if (error || !data || !data[0]) return NextResponse.json({ error: error?.message || 'Save failed' }, { status: 500 })
  const r = data[0] as ExerciseRow
  const saved = {
    id: r.id,
    name: r.name,
    category: r.category,
    equipment: r.equipment,
    primaryMuscles: r.primary_muscles || [],
    secondaryMuscles: r.secondary_muscles || [],
    instructions: r.instructions || [],
    ecode: r.ecode || "",
    images: r.images || [],
  }
  return NextResponse.json({ exercise: saved })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const trainer = url.searchParams.get('trainer_id')
  const id = url.searchParams.get('id')
  if (!trainer || !id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const supabase = createSupabaseServer()
  const { error } = await supabase.from('exercises_custom').delete().eq('id', id).eq('trainer', trainer)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
