"use client";
import Header from "../../components/Header";
import Navigation from "../../components/Navigation";
import styles from "../page.module.css";
import { Box, Paper, Stack, Typography, Button, TextField, MenuItem, Snackbar, IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";

type Eligible = { user_id: string; email?: string; name?: string };
type SessionItem = { id: string; trainer: string; user_id: string; user_email?: string | null; start_iso: string; end_iso: string; meet_url: string; title?: string };

type SlotEvent = {
  type: "start" | "enter" | "end";
  dayIndex: number;
  date: Date;
  hour: number;
  minute: number;
};

const pad = (value: number) => String(value).padStart(2, "0");
const formatDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const makeSlotKey = (dateKey: string, hour: number, minute: number) => `${dateKey}T${pad(hour)}:${pad(minute)}`;

export default function SessionsPage() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const { isLoading } = useSessionContext();

  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [snack, setSnack] = useState<string | null>(null);

  const [pickUser, setPickUser] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [title, setTitle] = useState<string>("");

  const [availabilityMode, setAvailabilityMode] = useState(false);
  const [availabilityDrag, setAvailabilityDrag] = useState<{ day: number; start: number } | null>(null);
  const [availabilityPreview, setAvailabilityPreview] = useState<{ day: number; start: number; end: number } | null>(null);

  // Settings state
  type Settings = { slotMinutes: number; bufferMinutes: number; workStart: number; workEnd: number; days: number[] }
  const [settings, setSettings] = useState<Settings>({ slotMinutes: 15, bufferMinutes: 0, workStart: 8, workEnd: 17, days: [0,1,2,3,4] })
  const saveSettings = async () => {
    if (!trainerId) return
    await fetch('/api/sessions/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trainer_id: trainerId, settings }) })
    setSnack('Settings saved')
  }

  useEffect(() => {
    if (!availabilityMode) {
      setAvailabilityDrag(null)
      setAvailabilityPreview(null)
    }
  }, [availabilityMode])

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (isLoading) return;
      const uid = session?.user?.id || null;
      if (!uid) return;
      const { data } = await supabase
        .from('trainer')
        .select('trainer_id')
        .eq('creator_id', uid)
        .limit(1);
      const tId = (data?.[0]?.trainer_id as string) || null;
      if (!alive) return;
      setTrainerId(tId);
      if (!tId) return;
      try {
        // Load trainer settings
        try {
          const sres = await fetch(`/api/sessions/settings?trainer_id=${encodeURIComponent(tId)}`, { cache: 'no-store' })
          const sjson = await sres.json()
          if (sjson?.settings) setSettings(sjson.settings)
        } catch {}
        const res = await fetch(`/api/sessions/eligible?trainer_id=${encodeURIComponent(tId)}`, { cache: 'no-store' })
        const json = await res.json()
        const list: Eligible[] = Array.isArray(json?.users) ? json.users : []
        // Add a dummy user for local testing if none available
        setEligible(list.length ? list : [{ user_id: 'demo_user', email: 'demo@liftspump.test', name: 'Demo Client' }])
      } catch {
        // Fall back to a dummy user completely offline
        setEligible([{ user_id: 'demo_user', email: 'demo@liftspump.test', name: 'Demo Client' }])
      }
      try {
        const res = await fetch(`/api/sessions?trainer_id=${encodeURIComponent(tId)}`, { cache: 'no-store' })
        const json = await res.json()
        setItems(Array.isArray(json?.sessions) ? json.sessions : [])
      } catch {}
    };
    load();
    return () => { alive = false };
  }, [isLoading, session?.user?.id, supabase]);

  const schedule = async () => {
    if (!trainerId || !pickUser || !date || !time) { setSnack('Pick client, date, and time'); return; }
    const startIso = new Date(`${date}T${time}:00`).toISOString();
    try {
      const userEmail = eligible.find(e => e.user_id === pickUser)?.email || null
      const res = await fetch('/api/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainer_id: trainerId, user_id: pickUser, user_email: userEmail, start_iso: startIso, title, duration_min: Math.max(5, Math.min(240, (settings.slotMinutes + settings.bufferMinutes))) })
      })
      const json = await res.json()
      if (!res.ok) { setSnack(json?.error || 'Failed to schedule'); return; }
      setItems(prev => [...prev, json.session])
      setSnack('Session scheduled')
    } catch (e: any) { setSnack(e?.message || 'Failed'); }
  }

  const remove = async (id: string) => {
    try {
      await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== id))
      setSnack('Session removed')
    } catch {}
  }

  const upcoming = useMemo(() => items.slice().sort((a,b) => a.start_iso.localeCompare(b.start_iso)), [items])

  // Simple local reminders (page must be open)
  useEffect(() => {
    const now = Date.now()
    const timers: number[] = []
    upcoming.forEach(s => {
      const t = new Date(s.start_iso).getTime() - 5*60*1000 // 5 minutes before
      if (t > now) {
        const id = window.setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') {
            // eslint-disable-next-line no-new
            new Notification('Upcoming session', { body: `${new Date(s.start_iso).toLocaleTimeString()} — ${s.title || 'Coaching session'}`, tag: s.id })
          } else {
            setSnack('Reminder: session in 5 min')
          }
        }, t - now)
        timers.push(id)
      }
    })
    return () => { timers.forEach(clearTimeout) }
  }, [upcoming])

  const askNotify = async () => {
    try { if ('Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission() } catch {}
  }

  const slotMinutes = Math.max(5, settings.slotMinutes || 15)

  // Weekly grid helper
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date()
    const day = d.getDay() // 0..6 Sun..Sat
    const diff = (day === 0 ? -6 : 1 - day) // Monday start
    d.setDate(d.getDate() + diff)
    d.setHours(0,0,0,0)
    return d
  })

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i*24*60*60*1000)), [weekStart])

  const minutes = useMemo(() => {
    const perHour = Math.max(1, Math.floor(60 / slotMinutes))
    return Array.from({ length: perHour }, (_, i) => i * slotMinutes)
  }, [slotMinutes])

  const sessionBySlot = useMemo(() => {
    const map = new Map<string, SessionItem[]>()
    const stepMs = slotMinutes * 60 * 1000
    const guardLimit = Math.max(288, Math.ceil((24 * 60) / slotMinutes) + 2)
    items.forEach((item) => {
      const start = new Date(item.start_iso)
      const end = new Date(item.end_iso)
      let guard = 0
      let cursor = new Date(start)
      while (cursor < end && guard < guardLimit) {
        const key = makeSlotKey(formatDateKey(cursor), cursor.getHours(), cursor.getMinutes())
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(item)
        cursor = new Date(cursor.getTime() + stepMs)
        guard += 1
      }
      if (guard === 0) {
        const key = makeSlotKey(formatDateKey(start), start.getHours(), start.getMinutes())
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(item)
      }
    })
    return map
  }, [items, slotMinutes])

  const sessionHourBounds = useMemo(() => {
    if (!items.length) return null
    let minHour = 23
    let maxHour = 0
    items.forEach((item) => {
      const start = new Date(item.start_iso)
      const end = new Date(item.end_iso)
      minHour = Math.min(minHour, start.getHours())
      const endHour = end.getMinutes() ? end.getHours() + 1 : end.getHours()
      maxHour = Math.max(maxHour, endHour)
    })
    return { minHour, maxHour }
  }, [items])

  const hours = useMemo(() => {
    const minCandidate = Math.min(settings.workStart, sessionHourBounds?.minHour ?? settings.workStart, 6)
    const startHour = Math.max(0, minCandidate)
    const maxCandidate = Math.max(settings.workEnd, sessionHourBounds?.maxHour ?? settings.workEnd, startHour + 12)
    const endHour = Math.min(24, Math.max(startHour + 1, maxCandidate))
    return Array.from({ length: Math.max(1, endHour - startHour) }, (_, i) => startHour + i)
  }, [sessionHourBounds, settings.workEnd, settings.workStart])

  const selectedSlotKey = useMemo(() => (date && time ? `${date}T${time}` : null), [date, time])

  const toggleDay = useCallback((index: number) => {
    setSettings(prev => {
      const next = new Set(prev.days)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return { ...prev, days: Array.from(next).sort((a,b)=>a-b) }
    })
  }, [setSettings])

  const setFromSlot = useCallback((dayDate: Date, h: number, m: number) => {
    const d = new Date(dayDate)
    d.setHours(h, m, 0, 0)
    setDate(d.toISOString().slice(0,10))
    setTime(d.toTimeString().slice(0,5))
  }, [setDate, setTime])

  const handleSlotEvent = useCallback((event: SlotEvent) => {
    const { dayIndex, date: slotDate, hour, minute, type } = event
    const slotValue = hour + minute / 60
    if (availabilityMode) {
      if (type === 'start') {
        setAvailabilityDrag({ day: dayIndex, start: slotValue })
        setAvailabilityPreview({ day: dayIndex, start: slotValue, end: slotValue + slotMinutes / 60 })
      } else if (type === 'enter' && availabilityDrag && availabilityDrag.day === dayIndex) {
        const start = Math.min(availabilityDrag.start, slotValue)
        const end = Math.max(availabilityDrag.start, slotValue + slotMinutes / 60)
        setAvailabilityPreview({ day: dayIndex, start, end })
      } else if (type === 'end') {
        const baseline = availabilityDrag?.day === dayIndex ? availabilityDrag.start : slotValue
        const start = Math.min(baseline, slotValue)
        const end = Math.max(baseline + slotMinutes / 60, slotValue + slotMinutes / 60)
        setAvailabilityDrag(null)
        setAvailabilityPreview(null)
        setSettings(prev => {
          const daysSet = new Set(prev.days)
          daysSet.add(dayIndex)
          const workStart = Math.max(0, Math.floor(Math.min(start, prev.workEnd)))
          const workEnd = Math.min(24, Math.max(Math.ceil(end), workStart + 1))
          return { ...prev, workStart, workEnd, days: Array.from(daysSet).sort((a,b)=>a-b) }
        })
      }
    } else if (type === 'start') {
      setFromSlot(slotDate, hour, minute)
    }
  }, [availabilityDrag, availabilityMode, setFromSlot, slotMinutes, setSettings])

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
        <div className={styles.pageContent}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" fontWeight={800}>Sessions</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                High‑tier client coaching in 15‑minute slots
              </Typography>
            </Stack>
            <Paper sx={{ p: 2.5, border: '1px solid #2a2a2a',
              bgcolor: 'rgba(255,255,255,0.02)',
              backgroundImage: 'radial-gradient(800px 200px at -10% -40%, rgba(26,224,128,0.06), transparent)',
              borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={800}>Schedule a 15‑minute Google Meet</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mt: 1 }}>
                <TextField select label="Client (high‑tier)" size="small" value={pickUser} onChange={(e) => setPickUser(e.target.value)} sx={{ minWidth: 260 }}>
                  {eligible.map(u => (
                    <MenuItem key={u.user_id} value={u.user_id}>{u.name || u.email || u.user_id}</MenuItem>
                  ))}
                </TextField>
                <TextField label="Date" type="date" size="small" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField label="Time" type="time" size="small" value={time} onChange={(e) => setTime(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField label="Title (optional)" size="small" value={title} onChange={(e) => setTitle(e.target.value)} sx={{ flex: 1 }} />
                <Button variant="contained" onClick={schedule} disabled={!trainerId || !eligible.length}
                  sx={{
                    px: 3,
                    py: 1.1,
                    borderRadius: 999,
                    bgcolor: '#1AE080', color: '#0b0b0b',
                    boxShadow: '0 10px 24px rgba(26,224,128,0.25)',
                    '&:hover': { bgcolor: '#19c973', boxShadow: '0 12px 28px rgba(26,224,128,0.35)' }
                  }}
                >Schedule</Button>
                <Tooltip title="Enable browser reminders">
                  <IconButton onClick={askNotify}><EditCalendarIcon /></IconButton>
                </Tooltip>
              </Stack>
              <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.8 }}>Links are generated locally as meet.google.com/xxx; adjust as needed.</Typography>
            </Paper>

            {/* Weekly grid */}
            <Paper sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 1, gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>Weekly calendar</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                  <Button size="small" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7*24*60*60*1000))}>Prev</Button>
                  <Button size="small" onClick={() => setWeekStart(new Date())}>Today</Button>
                  <Button size="small" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7*24*60*60*1000))}>Next</Button>
                  <Button
                    size="small"
                    variant={availabilityMode ? 'contained' : 'outlined'}
                    onClick={() => setAvailabilityMode(v => !v)}
                  >{availabilityMode ? 'Done editing' : 'Edit availability'}</Button>
                </Stack>
              </Stack>
              {availabilityMode && (
                <Typography variant="caption" sx={{ mb: 1, display: 'block', color: 'rgba(255,255,255,0.7)' }}>
                  Drag across cells to set working hours. Click day names to toggle availability.
                </Typography>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: `100px repeat(7, 1fr)`, borderTop: '1px solid #2a2a2a', borderLeft: '1px solid #2a2a2a', userSelect: 'none' }}>
                {/* Header row */}
                <Box />
                {days.map((d, i) => {
                  const isActive = settings.days.includes(i)
                  return (
                    <Box
                      key={i}
                      onClick={availabilityMode ? () => toggleDay(i) : undefined}
                      sx={{
                        borderRight: '1px solid #2a2a2a',
                        p: 1,
                        textAlign: 'center',
                        fontWeight: 700,
                        opacity: isActive ? 1 : 0.4,
                        cursor: availabilityMode ? 'pointer' : 'default',
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                        '&:hover': availabilityMode ? { opacity: 1, transform: 'translateY(-2px)' } : undefined,
                      }}
                    >
                      {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Box>
                  )
                })}
                {/** Drag selection state */}
                {/* Track selection in component state */}
                {hours.map((h) => (
                  <Fragment key={`row-${h}`}>
                    <Box sx={{ borderRight: '1px solid #2a2a2a', borderBottom: '1px solid #2a2a2a', p: 1 }}>{`${String(h).padStart(2,'0')}:00`}</Box>
                    {days.map((d, di) => (
                      <GridColumn
                        key={`c-${h}-${di}`}
                        dayIndex={di}
                        date={d}
                        hour={h}
                        minutesList={minutes}
                        onSlotEvent={handleSlotEvent}
                        sessionMap={sessionBySlot}
                        selectedSlotKey={selectedSlotKey}
                        availabilityPreview={availabilityPreview}
                        availabilityMode={availabilityMode}
                        isDayActive={settings.days.includes(di)}
                        workStart={settings.workStart}
                        workEnd={settings.workEnd}
                      />
                    ))}
                  </Fragment>
                ))}
              </Box>
            </Paper>

            {/* Trainer settings */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Trainer availability</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField label="Slot minutes" type="number" size="small" value={settings.slotMinutes} onChange={(e) => setSettings({ ...settings, slotMinutes: Number(e.target.value) })} sx={{ maxWidth: 160 }} />
                <TextField label="Buffer minutes" type="number" size="small" value={settings.bufferMinutes} onChange={(e) => setSettings({ ...settings, bufferMinutes: Number(e.target.value) })} sx={{ maxWidth: 160 }} />
                <TextField label="Start hour" type="number" size="small" value={settings.workStart} onChange={(e) => setSettings({ ...settings, workStart: Number(e.target.value) })} sx={{ maxWidth: 160 }} />
                <TextField label="End hour" type="number" size="small" value={settings.workEnd} onChange={(e) => setSettings({ ...settings, workEnd: Number(e.target.value) })} sx={{ maxWidth: 160 }} />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label, i) => (
                    <Button key={i} variant={settings.days.includes(i) ? 'contained' : 'outlined'} size="small" onClick={() => {
                      const set = new Set(settings.days); if (set.has(i)) set.delete(i); else set.add(i); setSettings({ ...settings, days: Array.from(set).sort((a,b)=>a-b) })
                    }}>{label}</Button>
                  ))}
                </Box>
                <Button variant="contained" onClick={saveSettings}>Save</Button>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2.5, border: '1px solid #2a2a2a', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>Upcoming sessions</Typography>
              <Stack spacing={1}>
                {upcoming.map(s => (
                  <Paper key={s.id} sx={{ p: 1.5, border: '1px solid', borderColor: '#2a2a2a', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <Typography variant="body1" sx={{ minWidth: 260, fontWeight: 600 }}>{new Date(s.start_iso).toLocaleString()} – 15 min</Typography>
                      <Typography variant="body2" sx={{ flex: 1 }}>{s.title}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button size="small" variant="outlined" href={s.meet_url} target="_blank" rel="noopener noreferrer">Open Meet</Button>
                        <Tooltip title="Copy link"><IconButton size="small" onClick={() => navigator.clipboard?.writeText(s.meet_url)}><ContentCopyIcon fontSize="inherit" /></IconButton></Tooltip>
                        <Tooltip title="Add to Calendar"><IconButton size="small" component="a" href={`/api/sessions/ics?id=${encodeURIComponent(s.id)}`}><CalendarMonthIcon fontSize="inherit" /></IconButton></Tooltip>
                        <Tooltip title="Reschedule">
                          <IconButton size="small" onClick={async () => {
                            const d = prompt('New date (YYYY-MM-DD)', s.start_iso.slice(0,10));
                            if (!d) return;
                            const t = prompt('New time (HH:MM 24h)', new Date(s.start_iso).toTimeString().slice(0,5));
                            if (!t) return;
                            const start_iso = new Date(`${d}T${t}:00`).toISOString();
                            const res = await fetch('/api/sessions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, start_iso, duration_min: Math.max(5, Math.min(240, (settings.slotMinutes + settings.bufferMinutes))) }) })
                            const json = await res.json();
                            if (!res.ok) { setSnack(json?.error || 'Failed to reschedule'); return; }
                            setItems(prev => prev.map(x => x.id === s.id ? json.session : x))
                            setSnack('Session rescheduled')
                          }}><EditCalendarIcon fontSize="inherit" /></IconButton>
                        </Tooltip>
                        <IconButton size="small" color="error" onClick={() => remove(s.id)}><DeleteOutlineIcon fontSize="inherit" /></IconButton>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
                {!upcoming.length && <Typography variant="body2">No sessions yet.</Typography>}
              </Stack>
            </Paper>
          </Stack>
        </div>
      </main>
      <footer className={styles.footer}></footer>
      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack(null)} message={snack ?? ''} />
    </div>
  );
}

// Weekly planner column with session overlays and availability editing
function GridColumn({
  dayIndex,
  date,
  hour,
  minutesList,
  onSlotEvent,
  sessionMap,
  selectedSlotKey,
  availabilityPreview,
  availabilityMode,
  isDayActive,
  workStart,
  workEnd,
}: {
  dayIndex: number;
  date: Date;
  hour: number;
  minutesList: number[];
  onSlotEvent: (event: SlotEvent) => void;
  sessionMap: Map<string, SessionItem[]>;
  selectedSlotKey: string | null;
  availabilityPreview: { day: number; start: number; end: number } | null;
  availabilityMode: boolean;
  isDayActive: boolean;
  workStart: number;
  workEnd: number;
}) {
  const [dragging, setDragging] = useState(false)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const lastMinuteRef = useRef<number>(minutesList[0] ?? 0)
  const interactive = availabilityMode || isDayActive
  const dateKey = formatDateKey(date)

  const fireEvent = (type: SlotEvent["type"], minute: number) => {
    if (!interactive) return
    onSlotEvent({ type, dayIndex, date, hour, minute })
  }

  return (
    <Box
      sx={{ display: 'grid', gridTemplateRows: `repeat(${minutesList.length}, 1fr)` }}
      onMouseLeave={() => {
        if (dragging && interactive) {
          fireEvent('end', lastMinuteRef.current)
        }
        setDragging(false)
        setHoverIndex(null)
      }}
    >
      {minutesList.map((minute, mi) => {
        const slotStart = hour + minute / 60
        const slotKey = makeSlotKey(dateKey, hour, minute)
        const sessions = sessionMap.get(slotKey) ?? []
        const isAvailable = isDayActive && slotStart >= workStart && slotStart < workEnd
        const isPreview = availabilityPreview?.day === dayIndex && slotStart >= (availabilityPreview?.start ?? 0) && slotStart < (availabilityPreview?.end ?? 0)
        const isSelected = selectedSlotKey === slotKey

        let background = 'transparent'
        if (isAvailable) background = 'rgba(255,255,255,0.025)'
        if (isPreview) background = 'rgba(26,224,128,0.12)'
        if (isSelected) background = 'rgba(26,224,128,0.18)'
        if (sessions.length) background = 'rgba(26,224,128,0.32)'

        const session = sessions[0]
        const attendee = session?.user_email || session?.user_id || ''
        const sessionTitle = session?.title || 'Session'

        return (
          <Box
            key={mi}
            onMouseDown={(e) => {
              if (!interactive) return
              e.preventDefault()
              setDragging(true)
              setHoverIndex(mi)
              lastMinuteRef.current = minute
              fireEvent('start', minute)
            }}
            onMouseEnter={() => {
              if (dragging && interactive) {
                setHoverIndex(mi)
                lastMinuteRef.current = minute
                fireEvent('enter', minute)
              }
            }}
            onMouseUp={() => {
              if (interactive) {
                fireEvent('end', minute)
              }
              setDragging(false)
              setHoverIndex(null)
            }}
            sx={{
              borderRight: '1px solid #2a2a2a',
              borderBottom: mi === minutesList.length - 1 ? '1px solid #2a2a2a' : 'none',
              p: 0.5,
              minHeight: 36,
              cursor: availabilityMode ? 'crosshair' : (interactive ? 'pointer' : 'not-allowed'),
              bgcolor: background,
              opacity: interactive ? 1 : 0.35,
              transition: 'background-color 0.12s ease, opacity 0.12s ease',
              outline: availabilityMode && hoverIndex === mi ? '1px solid rgba(26,224,128,0.35)' : 'none',
              '&:hover': interactive ? { bgcolor: sessions.length ? 'rgba(26,224,128,0.36)' : 'rgba(26,224,128,0.12)' } : undefined,
            }}
          >
            {sessions.length > 0 ? (
              <Stack spacing={0.25} sx={{ px: 0.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', color: '#0b0b0b' }}>{sessionTitle}</Typography>
                {attendee && (
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#0b0b0b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attendee}</Typography>
                )}
                {sessions.length > 1 && (
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#0b0b0b' }}>{`+${sessions.length - 1} more`}</Typography>
                )}
              </Stack>
            ) : (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)' }}>
                {availabilityMode ? (isAvailable ? 'Available' : 'Off') : ''}
              </Typography>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
