import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient as createServerSupabase } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 45

const MODEL_ID = process.env.USER_INSIGHTS_MODEL || 'gemini-2.5-pro'

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
  const userClient = await createServerSupabase()
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const url = new URL(req.url)
  const targetUser = url.searchParams.get('user_id')

  if (!targetUser) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
  }

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: trainerRows, error: trainerError } = await userClient
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

  const { data: profileRow, error: profileError } = await userClient
    .from('profile')
    .select('creator_id, first_name, last_name, email, username, height, weight, last_synced')
    .eq('creator_id', targetUser)
    .limit(1)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const { data: rateRows, error: rateError } = await admin
    .from('ratelimits')
    .select('creator_id, summary, date')
    .eq('creator_id', targetUser)
    .order('date', { ascending: false })

  if (rateError && rateError.code !== 'PGRST116') {
    return NextResponse.json({ error: rateError.message }, { status: 500 })
  }

  // Use most recent row if available
  const latest = Array.isArray(rateRows) && rateRows.length ? rateRows[0] : null

  // If there is a recent summary (within past 24h), return it and skip generation.
  const nowMs = Date.now()
  const lastMs = latest?.date ? new Date(latest.date as string).getTime() : 0
  const isFresh = Number.isFinite(lastMs) && lastMs > 0 && nowMs - lastMs <= 24 * 60 * 60 * 1000

  if (isFresh && latest?.summary) {
    return NextResponse.json({ summary: latest.summary, cached: true })
  }

  const { data: routineRows, error: routineError } = await userClient
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
    return NextResponse.json({
      summary: fallback,
      warning: 'Gemini API key is not configured.',
    })
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
      'Bullets must start with "•". Use plain English, no code fences.',
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
    })

    const primaryCandidate = result.response.candidates?.find((candidate) => {
      const reason = candidate.finishReason ?? ''
      return reason !== 'SAFETY'
    }) ?? result.response.candidates?.[0]

    if (!primaryCandidate) {
      return NextResponse.json({
        summary: fallback,
        warning: 'Gemini returned no candidates.',
      })
    }

    const blocked = primaryCandidate.safetyRatings?.find((rating) => (rating.probability || '').includes('HIGH'))
    if (blocked) {
      return NextResponse.json({
        summary: fallback,
        warning: `Gemini blocked the insight (${blocked.category}).`,
      })
    }

    const textParts = primaryCandidate.content?.parts
      ?.map((part: any) => {
        if (typeof part?.text === 'string' && part.text.trim()) {
          return part.text
        }
        if (Array.isArray(part?.parts)) {
          const nestedText = part.parts
            .map((nested: any) => (typeof nested?.text === 'string' ? nested.text : ''))
            .filter(Boolean)
            .join('\n')
          if (nestedText.trim()) return nestedText
        }
        return ''
      })
      .filter(Boolean) ?? []

    let combined = textParts.join('\n').trim()
    if (!combined) {
      combined = result.response.text()?.trim() || ''
    }

    if (!combined && typeof primaryCandidate.content?.parts === 'undefined') {
      const rawText = (primaryCandidate as any).text
      if (typeof rawText === 'string') {
        combined = rawText.trim()
      }
    }

    if (!combined) {
      return NextResponse.json({
        summary: fallback,
        warning: 'Gemini produced an empty insight.',
      })
    }

    // Reset existing rows for this user and save the new summary snapshot.
    const { error: upsertErr } = await admin
      .from('ratelimits')
      .upsert(
        {
          creator_id: targetUser,
          date: new Date().toISOString(),
          voiceminutes: 0,
          assitanttokens: 0, // match current DB column name
          summary: combined,
        },
        { onConflict: 'creator_id' }
      )
      .select('creator_id')
    if (upsertErr) {
      console.error('ratelimits upsert failed', upsertErr)
    }
    return NextResponse.json({ summary: combined })
  } catch (err: any) {
    console.error('Gemini user insights failed', err)
    return NextResponse.json({
      summary: fallback,
      warning: err?.message || 'Gemini request failed',
    })
  }
}
