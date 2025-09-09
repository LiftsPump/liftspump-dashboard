"use client";
import Header from "../../components/Header";
import Navigation from "../../components/Navigation";
import styles from "../page.module.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";
import { Box, Paper, Stack, Typography, TextField, Button, Chip, IconButton, Snackbar, ToggleButtonGroup, ToggleButton, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";

type Exercise = {
  id: string
  name: string
  category?: string | null
  equipment?: string | null
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  instructions?: string[]
  images?: string[]
  source?: 'builtin' | 'custom'
}

export default function ExercisesPage() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const { isLoading } = useSessionContext();

  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [builtin, setBuiltin] = useState<Exercise[]>([]);
  const [custom, setCustom] = useState<Exercise[]>([]);
  const [q, setQ] = useState(''); // raw input
  const [query, setQuery] = useState(''); // debounced query actually used for filtering
  const [snack, setSnack] = useState<string | null>(null);
  const [tab, setTab] = useState<'all'|'builtin'|'custom'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [equipFilter, setEquipFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const pageSize = 30

  const [openView, setOpenView] = useState<Exercise | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 150)
    return () => clearTimeout(t)
  }, [q])

  // Keyboard shortcut to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inInput = !!target?.closest('input,textarea,[contenteditable="true"]')
      if (e.key === '/' && !inInput) { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape') { setQ(''); setQuery('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Form state for new/edit custom exercise
  const [form, setForm] = useState<Partial<Exercise>>({ name: '', category: 'strength', equipment: '', primaryMuscles: [], secondaryMuscles: [], instructions: [], images: [] })
  const editingId = (form.id as string | undefined) || null

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (isLoading) return;
      // Trainer id
      const uid = session?.user?.id || null;
      if (uid) {
        const { data } = await supabase
          .from('trainer')
          .select('trainer_id')
          .eq('creator_id', uid)
          .limit(1);
        const tId = (data?.[0]?.trainer_id as string) || null;
        if (!alive) return;
        setTrainerId(tId);
        if (tId) {
          try {
            const r = await fetch(`/api/exercises/custom?trainer_id=${encodeURIComponent(tId)}`)
            const j = await r.json()
            const list = (Array.isArray(j?.exercises) ? j.exercises : []).map((e: any) => ({ ...e, source: 'custom' as const }))
            setCustom(list)
          } catch {}
        }
      }
      // Builtin
      try {
        const r = await fetch('/api/exercises/builtin')
        const j = await r.json()
        const list = (Array.isArray(j?.exercises) ? j.exercises : []).map((e: any) => ({ ...e, source: 'builtin' as const }))
        if (alive) setBuiltin(list)
      } catch {}
    }
    load();
    return () => { alive = false };
  }, [isLoading, session?.user?.id, supabase])

  const all = useMemo(() => [...custom, ...builtin], [custom, builtin])
  const allCategories = useMemo(() => Array.from(new Set(all.map(e => e.category).filter(Boolean) as string[])).sort(), [all])
  const allEquip = useMemo(() => Array.from(new Set(all.map(e => (e.equipment || '').toLowerCase()).filter(Boolean))).sort(), [all])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let base = all
    if (tab !== 'all') base = base.filter(e => e.source === tab)
    if (categoryFilter) base = base.filter(e => (e.category || '') === categoryFilter)
    if (equipFilter) base = base.filter(e => (e.equipment || '').toLowerCase() === equipFilter)
    if (!q) return base
    return base.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      (e.primaryMuscles || []).some(m => m.toLowerCase().includes(q)) ||
      (e.equipment || '').toLowerCase().includes(q)
    )
  }, [all, query, tab, categoryFilter, equipFilter])

  const requireSearch = tab !== 'custom' && query.trim().length < 1 && !categoryFilter && !equipFilter
  const gated = requireSearch ? [] : filtered
  const visible = useMemo(() => gated.slice(0, page * pageSize), [gated, page])

  const saveCustom = async () => {
    try {
      if (!trainerId) { setSnack('Create trainer first'); return }
      const payload = {
        ...form,
        name: String(form.name || '').trim(),
        primaryMuscles: String((form.primaryMuscles || []).join(',')).split(',').map(s => s.trim()).filter(Boolean),
        secondaryMuscles: String((form.secondaryMuscles || []).join(',')).split(',').map(s => s.trim()).filter(Boolean),
        instructions: String((form.instructions || []).join('\n')).split('\n').map(s => s.trim()).filter(Boolean),
        images: String((form.images || []).join(',')).split(',').map(s => s.trim()).filter(Boolean),
      }
      if (!payload.name) { setSnack('Name is required'); return }
      const res = await fetch('/api/exercises/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trainer_id: trainerId, exercise: { ...payload, id: editingId || undefined } }) })
      const json = await res.json()
      if (!res.ok) { setSnack(json?.error || 'Failed to save'); return }
      const saved = { ...(json.exercise as Exercise), source: 'custom' as const }
      setCustom(prev => {
        const i = prev.findIndex(x => x.id === saved.id)
        if (i >= 0) { const cp = prev.slice(); cp[i] = saved; return cp }
        return [saved, ...prev]
      })
      setForm({ name: '', category: 'strength', equipment: '', primaryMuscles: [], secondaryMuscles: [], instructions: [], images: [] })
      setSnack('Saved')
    } catch (e: any) { setSnack(e?.message || 'Failed') }
  }

  const editExercise = (e: Exercise) => {
    setForm({
      id: e.id,
      name: e.name,
      category: e.category || '',
      equipment: e.equipment || '',
      primaryMuscles: e.primaryMuscles || [],
      secondaryMuscles: e.secondaryMuscles || [],
      instructions: e.instructions || [],
      images: e.images || [],
    })
  }

  const removeExercise = async (id: string) => {
    try {
      if (!trainerId) return;
      await fetch(`/api/exercises/custom?trainer_id=${encodeURIComponent(trainerId)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setCustom(prev => prev.filter(e => e.id !== id))
    } catch {}
  }

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
        <div className={styles.pageContent}>
          <Stack spacing={2}>
            <Paper sx={{ position: 'sticky', top: 0, zIndex: 1, p: 1.25, border: '1px solid #2a2a2a', bgcolor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Typography variant="h5" fontWeight={800}>Exercises</Typography>
                <Box flex={1} />
                <TextField
                  inputRef={searchRef}
                  placeholder="Search exercises… (press /)"
                  size="small"
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1) }}
                  sx={{ minWidth: 280, flex: { md: '0 0 360px' } }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                    endAdornment: q ? <InputAdornment position="end"><IconButton size="small" onClick={() => { setQ(''); setQuery(''); }}><CloseRoundedIcon fontSize="small" /></IconButton></InputAdornment> : undefined,
                  }}
                />
              </Stack>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {['chest','back','legs','arms','shoulders','core','glutes','dumbbell','barbell','body only'].map((w) => (
                  <Chip key={w} size="small" label={w} onClick={() => { setQ(w); setQuery(w); setPage(1) }} sx={{ bgcolor: '#111', border: '1px solid #2a2a2a' }} />
                ))}
              </Box>
            </Paper>

            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ xs: 'stretch', lg: 'flex-start' }}>
              {/* Left: results */}
              <Box sx={{ flex: 1 }}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Library</Typography>
                    <Box flex={1} />
                    <ToggleButtonGroup exclusive value={tab} onChange={(_, v) => { if (v) { setTab(v); setPage(1) } }} size="small">
                      <ToggleButton value="all">All</ToggleButton>
                      <ToggleButton value="custom">Custom</ToggleButton>
                      <ToggleButton value="builtin">Builtin</ToggleButton>
                    </ToggleButtonGroup>
                    <TextField select label="Category" size="small" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }} sx={{ minWidth: 160 }}>
                      <MenuItem value="">All</MenuItem>
                      {allCategories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                    <TextField select label="Equipment" size="small" value={equipFilter} onChange={(e) => { setEquipFilter(e.target.value); setPage(1) }} sx={{ minWidth: 160 }}>
                      <MenuItem value="">All</MenuItem>
                      {allEquip.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1 }}>
                    {visible.map((e) => (
                      <Paper key={(e.id || e.name) + e.source} sx={{ p: 1.25, border: '1px solid', borderColor: e.source === 'custom' ? '#1AE080' : 'divider', bgcolor: 'background.paper' }}>
                        <Stack spacing={0.5}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Typography variant="body1" fontWeight={700}>{e.name}</Typography>
                            <Chip size="small" label={e.source === 'custom' ? 'Custom' : 'Builtin'} sx={{ bgcolor: e.source === 'custom' ? '#102a1e' : '#111', color: '#9ef6c5', border: e.source === 'custom' ? '1px solid #1AE080' : '1px solid #2a2a2a' }} />
                          </Stack>
                          <Typography variant="caption" sx={{ opacity: 0.8 }}>{[e.category, e.equipment].filter(Boolean).join(' • ')}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Muscles: {(e.primaryMuscles || []).join(', ')}</Typography>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="outlined" onClick={() => setOpenView(e)}>Details</Button>
                            {e.source === 'custom' && (
                              <>
                                <Button size="small" variant="outlined" onClick={() => editExercise(e)}>Edit</Button>
                                <IconButton size="small" color="error" onClick={() => removeExercise(e.id)}><DeleteOutlineIcon fontSize="inherit" /></IconButton>
                              </>
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                    {!visible.length && (
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {requireSearch ? 'Start typing or use filters to search the library.' : 'No results.'}
                      </Typography>
                    )}
                  </Box>
                  {visible.length < gated.length && !requireSearch && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
                      <Button onClick={() => setPage(p => p + 1)}>Load more ({gated.length - visible.length} more)</Button>
                    </Box>
                  )}
                </Paper>
              </Box>

              {/* Right: create/edit */}
              <Paper sx={{ p: 2, minWidth: 320, width: { lg: 420 } }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>{editingId ? 'Edit custom exercise' : 'Create custom exercise'}</Typography>
                  <TextField label="Name" size="small" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <TextField label="Category" size="small" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  <TextField label="Equipment" size="small" value={form.equipment || ''} onChange={(e) => setForm({ ...form, equipment: e.target.value })} />
                  <TextField label="Primary muscles (comma‑separated)" size="small" value={(form.primaryMuscles || []).join(', ')} onChange={(e) => setForm({ ...form, primaryMuscles: e.target.value.split(',').map(s => s.trim()) })} />
                  <TextField label="Secondary muscles (comma‑separated)" size="small" value={(form.secondaryMuscles || []).join(', ')} onChange={(e) => setForm({ ...form, secondaryMuscles: e.target.value.split(',').map(s => s.trim()) })} />
                  <TextField label="Instructions (one per line)" size="small" value={(form.instructions || []).join('\n')} onChange={(e) => setForm({ ...form, instructions: e.target.value.split('\n') })} multiline minRows={4} />
                  <TextField label="Image URLs (comma‑separated)" size="small" value={(form.images || []).join(', ')} onChange={(e) => setForm({ ...form, images: e.target.value.split(',').map(s => s.trim()) })} />
                  <Stack direction="row" spacing={1}>
                    <Button startIcon={<SaveIcon />} variant="contained" onClick={saveCustom}>Save</Button>
                    {editingId && <Button variant="outlined" onClick={() => setForm({ name: '', category: 'strength', equipment: '', primaryMuscles: [], secondaryMuscles: [], instructions: [], images: [] })}>Cancel</Button>}
                  </Stack>
                </Stack>
              </Paper>
            </Stack>
          </Stack>
        </div>
      </main>
      <footer className={styles.footer}></footer>
      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack(null)} message={snack ?? ''} />
      <Dialog open={!!openView} onClose={() => setOpenView(null)} fullWidth maxWidth="md">
        <DialogTitle>{openView?.name}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>{[openView?.category, openView?.equipment].filter(Boolean).join(' • ')}</Typography>
            {openView?.primaryMuscles?.length ? <Typography variant="body2">Primary: {openView.primaryMuscles.join(', ')}</Typography> : null}
            {openView?.secondaryMuscles?.length ? <Typography variant="body2">Secondary: {openView.secondaryMuscles.join(', ')}</Typography> : null}
            {openView?.instructions?.length ? (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Instructions</Typography>
                <ol style={{ paddingLeft: 18, margin: 0 }}>
                  {openView.instructions.map((s, i) => (<li key={i} style={{ marginBottom: 4 }}>{s}</li>))}
                </ol>
              </Box>
            ) : null}
            {openView?.images?.length ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {openView.images.map((u, i) => (<img key={i} src={u} alt="img" style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 6 }} />))}
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenView(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
