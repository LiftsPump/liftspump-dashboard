import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), 'src', 'data', 'exercises.json')

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const json = JSON.parse(raw)
    return NextResponse.json({ exercises: json })
  } catch (e) {
    return NextResponse.json({ exercises: [] })
  }
}

