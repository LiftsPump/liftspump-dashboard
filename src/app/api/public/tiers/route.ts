import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServer } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const trainer = url.searchParams.get('trainer_id')
  if (!trainer) return NextResponse.json({ tiers: [] })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

  try {
    let rows: any[] | null = null
    if (supabaseUrl && serviceKey) {
      const admin = createAdminClient(supabaseUrl, serviceKey)
      const { data, error } = await admin
        .from('tiers')
        .select('key,name,price,active')
        .eq('trainer', trainer)
        .eq('active', true)
        .order('price', { ascending: true })
      if (!error) rows = data ?? []
    } else {
      const supabase = createSupabaseServer()
      const { data } = await supabase
        .from('tiers')
        .select('key,name,price,active')
        .eq('trainer', trainer)
        .eq('active', true)
        .order('price', { ascending: true })
      rows = data ?? []
    }

    const tiers = (rows ?? []).map((t: any) => ({
      key: t.key,
      name: t.name,
      price: typeof t.price === 'number' ? (t.price >= 100 ? t.price / 100 : t.price) : 0,
      active: true,
    }))
    return NextResponse.json({ tiers })
  } catch {
    return NextResponse.json({ tiers: [] })
  }
}
