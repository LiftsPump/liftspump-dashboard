import { NextResponse } from 'next/server'
import exercises from '@/data/exercises.json'

export async function GET() {
  try {
    return NextResponse.json({ exercises })
  } catch (e) {
    return NextResponse.json({ exercises: [] })
  }
}
