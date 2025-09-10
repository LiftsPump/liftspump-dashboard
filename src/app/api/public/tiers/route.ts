import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServer } from '@/utils/supabase/server'

type Tier = { key: string; name: string; price: number; active: boolean }

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const trainer = url.searchParams.get('trainer_id')
  if (!trainer) return NextResponse.json({ tiers: [] })

  try {
    const supabase = createSupabaseServer()
    const { data, error } = await supabase
      .from('tiers')
      .select('key,name,price,active')
      .eq('trainer', trainer)
      .eq('active', true)
      .order('price', { ascending: true })
    if (error) return NextResponse.json({ tiers: [] })
    const tiers: Tier[] = (data ?? []).map((r: any) => ({
      key: r.key ?? 'tier',
      name: r.name ?? 'Tier',
      price: typeof r.price === 'number' ? (r.price >= 100 ? r.price / 100 : r.price) : 0,
      active: !!r.active,
    }))
    return NextResponse.json({ tiers })
  } catch {
    return NextResponse.json({ tiers: [] })
  }
}

