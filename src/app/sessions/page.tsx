"use client";
import Header from "../../components/Header";
import Navigation from "../../components/Navigation";
import styles from "../page.module.css";
import { Box, Paper, Stack, Typography, Button, TextField, MenuItem, Snackbar, IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";

type Eligible = { user_id: string; email?: string; name?: string };
type SessionItem = { id: string; trainer: string; user_id: string; user_email?: string | null; start_iso: string; end_iso: string; meet_url: string; title?: string };

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

  // Settings state
  type Settings = { slotMinutes: number; bufferMinutes: number; workStart: number; workEnd: number; days: number[] }
  const [settings, setSettings] = useState<Settings>({ slotMinutes: 15, bufferMinutes: 0, workStart: 8, workEnd: 17, days: [0,1,2,3,4] })
  const saveSettings = async () => {
    if (!trainerId) return
    await fetch('/api/sessions/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trainer_id: trainerId, settings }) })
    setSnack('Settings saved')
  }

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

  // Weekly grid helper
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date()
    const day = d.getDay() // 0..6 Sun..Sat
    const diff = (day === 0 ? -6 : 1 - day) // Monday start
    d.setDate(d.getDate() + diff)
    d.setHours(0,0,0,0)
    return d
  })
  const hours = Array.from({ length: Math.max(1, settings.workEnd - settings.workStart) }, (_, i) => settings.workStart + i)
  const minutes = Array.from({ length: Math.ceil(60 / Math.max(5, settings.slotMinutes)) }, (_, i) => i * Math.max(5, settings.slotMinutes))
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i*24*60*60*1000))

  const setFromSlot = (dayDate: Date, h: number, m: number) => {
    const d = new Date(dayDate)
    d.setHours(h, m, 0, 0)
    setDate(d.toISOString().slice(0,10))
    setTime(d.toTimeString().slice(0,5))
  }

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
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>Weekly calendar</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7*24*60*60*1000))}>Prev</Button>
                  <Button size="small" onClick={() => setWeekStart(new Date())}>Today</Button>
                  <Button size="small" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7*24*60*60*1000))}>Next</Button>
                </Stack>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: `100px repeat(7, 1fr)`, borderTop: '1px solid #2a2a2a', borderLeft: '1px solid #2a2a2a', userSelect: 'none' }}>
                {/* Header row */}
                <Box />
                {days.map((d, i) => (
                  <Box key={i} sx={{ borderRight: '1px solid #2a2a2a', p: 1, textAlign: 'center', fontWeight: 700, opacity: settings.days.includes(i) ? 1 : 0.4 }}>{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Box>
                ))}
                {/** Drag selection state */}
                {/* Track selection in component state */}
                
              {hours.map((h) => (
                <>
                  <Box key={`h-${h}`} sx={{ borderRight: '1px solid #2a2a2a', borderBottom: '1px solid #2a2a2a', p: 1 }}>{`${String(h).padStart(2,'0')}:00`}</Box>
                  {days.map((d, di) => (
                      <GridColumn
                        key={`c-${h}-${di}`}
                        dayIndex={di}
                        date={d}
                        hour={h}
                        minutesList={minutes}
                        onPick={setFromSlot}
                        enabled={settings.days.includes(di)}
                      />
                    ))}
                </>
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

// A small interactive column component that supports mouse drag selection
function GridColumn({ dayIndex, date, hour, minutesList, onPick, enabled }: { dayIndex: number; date: Date; hour: number; minutesList: number[]; onPick: (d: Date, h: number, m: number) => void; enabled: boolean }) {
  const [dragging, setDragging] = useState(false)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  return (
    <Box sx={{ display: 'grid', gridTemplateRows: `repeat(${minutesList.length}, 1fr)` }}
      onMouseLeave={() => { setDragging(false); setHoverIndex(null) }}>
      {minutesList.map((m, mi) => (
        <Box key={mi}
          onMouseDown={(e) => { if (!enabled) return; e.preventDefault(); setDragging(true); onPick(date, hour, m); setHoverIndex(mi) }}
          onMouseEnter={() => { if (dragging && enabled) { setHoverIndex(mi) } }}
          onMouseUp={() => { setDragging(false) }}
          sx={{
            borderRight: '1px solid #2a2a2a',
            borderBottom: mi === minutesList.length - 1 ? '1px solid #2a2a2a' : 'none',
            p: 0.5,
            cursor: enabled ? 'crosshair' : 'not-allowed',
            bgcolor: hoverIndex === mi ? 'rgba(26,224,128,0.12)' : 'transparent',
            '&:hover': { bgcolor: enabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)' },
            opacity: enabled ? 1 : 0.4,
          }}
        />
      ))}
    </Box>
  )
}
