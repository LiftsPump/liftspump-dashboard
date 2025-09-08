import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'tiers.json')

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const tiers = Array.isArray(payload?.tiers) ? payload.tiers : null
    if (!tiers) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const withIds = tiers.map((t: any) => ({
      ...t,
      stripePriceId: t?.stripePriceId || `price_${crypto.randomBytes(10).toString('hex')}`,
    }))

    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(DATA_FILE, JSON.stringify({ tiers: withIds }, null, 2), 'utf8')

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Unable to save' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const json = JSON.parse(raw)
    return NextResponse.json(json)
  } catch {
    // If not found, return empty default
    return NextResponse.json({ tiers: [] }, { status: 200 })
  }
}
