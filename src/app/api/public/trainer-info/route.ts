import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const trainer = url.searchParams.get('trainer_id')
  if (!trainer) return NextResponse.json({ error: 'missing trainer_id' }, { status: 400 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ photo_url: null, subs_count: 0, tiers_count: 0 })

  try {
    const admin = createAdminClient(supabaseUrl, serviceKey)
    // Attempt to fetch optional fields; if it errors, fallback to mandatory ones
    let tRow: any[] | null = null
    try {
      const { data, error } = await admin
        .from('trainer')
        .select('photo_url, subs, display_name, bio')
        .eq('trainer_id', trainer)
        .limit(1)
      if (error) throw error
      tRow = data as any[]
    } catch {
      const { data } = await admin
        .from('trainer')
        .select('photo_url, subs')
        .eq('trainer_id', trainer)
        .limit(1)
      tRow = data as any[]
    }
    const photo = (tRow?.[0]?.photo_url as string) || null
    const subs = Array.isArray(tRow?.[0]?.subs) ? (tRow![0]!.subs as string[]) : []
    const subsCount = subs.length
    const displayName = (tRow?.[0]?.display_name as string) || null
    const bio = (tRow?.[0]?.bio as string) || null
    const { count: tiersCount } = await admin
      .from('tiers')
      .select('*', { count: 'exact', head: true })
      .eq('trainer', trainer)
      .eq('active', true)
    return NextResponse.json({ photo_url: photo, subs_count: subsCount, tiers_count: typeof tiersCount === 'number' ? tiersCount : 0, display_name: displayName, bio })
  } catch {
    return NextResponse.json({ photo_url: null, subs_count: 0, tiers_count: 0, display_name: null, bio: null })
  }
}
