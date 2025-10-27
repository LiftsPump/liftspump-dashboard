import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/utils/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_ID = process.env.USER_INSIGHTS_MODEL || 'gemini-1.5-flash'

const formatDate = (iso: string | null) => {
  if (!iso) return 'n/a'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const computeBmi = (heightIn: number | null, weightLb: number | null) => {
  if (!heightIn || !weightLb || heightIn <= 0) return null
  const hMeters = heightIn * 0.0254
  const wKg = weightLb * 0.45359237
  const bmi = wKg / (hMeters * hMeters)
  return Math.round(bmi * 10) / 10
}

const buildBaselineSummary = (routines: any[] = []) => {
  if (!routines.length) return 'No workouts logged yet. Encourage a starter program to build momentum.'
  const total = routines.length
  const lastDate = formatDate(routines[0]?.date ?? null)
  const types = routines.reduce<Record<string, number>>((acc, r) => {
    const key = String(r?.type ?? 'unknown').toLowerCase()
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const typeMix = Object.entries(types)
    .map(([name, count]) => `${count} ${name}`)
    .join(', ')
  const durations = routines
    .map((r) => (typeof r?.duration === 'number' ? r.duration : null))
    .filter((v): v is number => v != null)
  const avgDuration = durations.length
    ? Math.round(durations.reduce((acc, v) => acc + v, 0) / durations.length)
    : null
  const durationText = avgDuration ? `${avgDuration} min avg` : 'no duration data'
  return `Logged ${total} workouts. Last session: ${lastDate}. Mix: ${typeMix || 'mixed'}. Avg duration: ${durationText}.`
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const url = new URL(req.url)
  const targetUser = url.searchParams.get('user_id')

  if (!targetUser) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: trainerRows, error: trainerError } = await supabase
    .from('trainer')
    .select('trainer_id, subs')
    .eq('creator_id', user.id)
    .limit(1)

  if (trainerError) {
    return NextResponse.json({ error: trainerError.message }, { status: 500 })
  }

  const trainerRow = trainerRows?.[0] ?? null
  if (!trainerRow) {
    return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 })
  }

  const subs: string[] = Array.isArray(trainerRow.subs) ? (trainerRow.subs as string[]) : []
  if (!subs.includes(targetUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profile')
    .select('creator_id, first_name, last_name, email, username, height, weight, last_synced')
    .eq('creator_id', targetUser)
    .limit(1)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const { data: routineRows, error: routineError } = await supabase
    .from('routines')
    .select('id, name, type, text, picture, days, weekly, date, duration')
    .eq('creator_id', targetUser)
    .order('date', { ascending: false })
    .limit(20)

  if (routineError) {
    return NextResponse.json({ error: routineError.message }, { status: 500 })
  }

  const fallback = buildBaselineSummary(routineRows ?? [])

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ summary: fallback })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODEL_ID })

    const bmi = computeBmi(profileRow?.height ?? null, profileRow?.weight ?? null)
    const profileLines = [
      `Name: ${(profileRow?.first_name || profileRow?.last_name) ? `${profileRow?.first_name ?? ''} ${profileRow?.last_name ?? ''}`.trim() : (profileRow?.username || profileRow?.email || targetUser)}`,
      `Email: ${profileRow?.email || 'n/a'}`,
      `Height (in): ${profileRow?.height ?? 'n/a'}`,
      `Weight (lb): ${profileRow?.weight ?? 'n/a'}`,
      `BMI Estimate: ${bmi ?? 'n/a'}`,
      `Last synced: ${formatDate(profileRow?.last_synced ?? null)}`,
    ].join('\n')

    const recentSessions = (routineRows ?? []).slice(0, 10).map((r) => {
      const date = formatDate(r?.date ?? null)
      const duration = r?.duration ? `${r.duration} min` : 'n/a'
      return `- ${date}: ${r?.name || r?.type || 'Session'} (${duration})`
    }).join('\n') || '- No recent sessions recorded.'

    const prompt = [
      'You are an elite fitness coach generating quick AI insights for another trainer about their client.',
      'Respond with exactly three concise bullet insights followed by a final single-sentence action recommendation (<=25 words).',
      'Use plain English, no markdown code fences.',
      'Focus on training consistency, intensity, and next best steps. Be positive but direct.',
      '',
      'Client profile:',
      profileLines,
      '',
      'Training snapshot:',
      fallback,
      '',
      'Recent sessions (latest first):',
      recentSessions,
    ].join('\n')

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.6,
      },
    })

    const raw = result.response.text()?.trim()
    if (!raw) {
      return NextResponse.json({ summary: fallback })
    }

    return NextResponse.json({ summary: raw })
  } catch (err: any) {
    return NextResponse.json({ summary: fallback, warning: err?.message || 'Gemini request failed' })
  }
}
