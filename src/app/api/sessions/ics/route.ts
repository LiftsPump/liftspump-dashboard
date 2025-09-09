import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

const SESSIONS_FILE = path.join(process.cwd(), '.data', 'sessions.json')

function escapeIcs(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return new NextResponse('missing id', { status: 400 })
  let data: any
  try { data = JSON.parse(await fs.readFile(SESSIONS_FILE, 'utf8')) } catch { data = { sessions: [] } }
  const s = (data.sessions as any[]).find(x => x.id === id)
  if (!s) return new NextResponse('not found', { status: 404 })
  const dtStart = s.start_iso.replace(/[-:]/g, '').replace('.000', '')
  const dtEnd = s.end_iso.replace(/[-:]/g, '').replace('.000', '')
  const uid = createHash('md5').update(id).digest('hex') + '@liftspump'
  const title = s.title || 'Coaching session'
  const body = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//LiftsPump//Sessions//EN\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${dtStart}\nDTSTART:${dtStart}\nDTEND:${dtEnd}\nSUMMARY:${escapeIcs(title)}\nDESCRIPTION:${escapeIcs(s.meet_url)}\nURL:${escapeIcs(s.meet_url)}\nEND:VEVENT\nEND:VCALENDAR\n`
  return new NextResponse(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="session-${id}.ics"` } })
}

