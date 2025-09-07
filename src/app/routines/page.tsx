"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import { Box, List, ListItemButton, ListItemIcon, ListItemText, CircularProgress, Alert, Typography, Paper, TextField, InputAdornment, Avatar, Chip, Stack, Button, IconButton, Checkbox, CssBaseline, Autocomplete } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Divider from '@mui/material/Divider';
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";
import SearchIcon from "@mui/icons-material/Search";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TodayIcon from "@mui/icons-material/Today";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import exercisesCatalog from "../../data/exercises.json";

enum RoutineItem {
  Cardio = "Cardio",
  Strength = "Strength",
  Flexibility = "Flexibility"
}

type Routine = {
  id: string;
  name: string | null;
  type: keyof typeof RoutineItem | string | null; // expects one of: "Cardio" | "Strength" | "Flexibility"
  text: string | null;
  picture: string | null;
  days: number | null;
  weekly: number | null;
  date: string | null; // ISO string from timestamp
  duration: number | null; // minutes/hours depending on your schema
  creator_id: string | null;
};

type Exercise = {
  id: string;
  name: string | null;
  text: string | null;
  eCode: string | null;
  routine_id: string | null;
  creator_id: string | null;
};

type SetRow = {
  id: string;
  reps: number | null;
  weight: number | null;
  completed: boolean | null;
  pr: boolean | null;
  exercise_id: string | null;
  creator_id: string | null;
};

type CatalogExercise = {
  id: string;
  name: string;
  force: "static" | "pull" | "push" | null;
  level: "beginner" | "intermediate" | "expert";
  mechanic: "isolation" | "compound" | null;
  equipment: | null | "medicine ball" | "dumbbell" | "body only" | "bands" | "kettlebells" | "foam roll" | "cable" | "machine" | "barbell" | "exercise ball" | "e-z curl bar" | "other";
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: "powerlifting" | "strength" | "stretching" | "cardio" | "olympic weightlifting" | "strongman" | "plyometrics";
  images: string[];
};


const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#1AE080" },
    background: { default: "#121212", paper: "#181818" },
    text: { primary: "#EAEAEA", secondary: "#B0B0B0" },
    divider: "rgba(255,255,255,0.12)",
  },
});

export default function Routines() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [setsByExercise, setSetsByExercise] = useState<Record<string, SetRow[]>>({});
  const [saving, setSaving] = useState(false);

  const catalogOptions = useMemo(() => (exercisesCatalog as CatalogExercise[]), []);

  const supabase = useSupabaseClient();
  const session = useSession();
  const { isLoading: authLoading } = useSessionContext();

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (authLoading) return; // wait for auth context
      setLoading(true);
      setError(null);

      const uid = session?.user?.id || null;
      if (!uid) {
        if (alive) setLoading(false);
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("routines")
        .select("id, name, type, text, picture, days, weekly, date, duration, creator_id")
        .eq("creator_id", uid)
        .eq("type", "trainer")
        .order("date", { ascending: false });

      if (error) {
        if (alive) setError(error.message);
      } else if (alive) {
        const rows = (data ?? []) as Routine[];
        setRoutines(rows);
        if (!selectedId && rows.length > 0) setSelectedId(rows[0].id);
      }
      if (alive) setLoading(false);
    };
    run();
    return () => { alive = false; };
  }, [router, session, authLoading]);

  const selected = useMemo(() => routines.find(r => r.id === selectedId) || null, [routines, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const onlyTrainer = routines.filter(r => String(r.type || '').toLowerCase() === 'trainer');
    if (!q) return onlyTrainer;
    return onlyTrainer.filter(r =>
      (r.name ?? "").toLowerCase().includes(q) ||
      (r.type ?? "").toString().toLowerCase().includes(q) ||
      (r.text ?? "").toLowerCase().includes(q)
    );
  }, [routines, query]);

  const loadExercises = async (routineId: string) => {
    const { data, error } = await supabase
      .from("exercises")
      .select("id,name,text,eCode,routine_id,creator_id")
      .eq("routine_id", routineId)
      .order("name", { ascending: true });
    if (!error) setExercises((data ?? []) as Exercise[]);
  };

  const loadSetsFor = async (exerciseId: string) => {
    const { data, error } = await supabase
      .from("sets")
      .select("id,reps,weight,completed,pr,exercise_id,creator_id")
      .eq("exercise_id", exerciseId)
      .order("id", { ascending: true });
    if (!error) setSetsByExercise((prev) => ({ ...prev, [exerciseId]: (data ?? []) as SetRow[] }));
  };

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      await loadExercises(selectedId);
    })();
  }, [selectedId]);

  useEffect(() => {
    // whenever exercises change, (re)load sets for each
    exercises.forEach((ex) => {
      if (!setsByExercise[ex.id]) {
        loadSetsFor(ex.id);
      }
    });
  }, [exercises]);


  const addExercise = async () => {
    if (!selectedId) return;
    setSaving(true);
    const uid = session?.user?.id;
    const { data, error } = await supabase
      .from("exercises")
      .insert({ name: "New exercise", text: "", routine_id: selectedId, creator_id: uid })
      .select("id,name,text,eCode,routine_id,creator_id")
      .single();
    if (!error && data) {
      setExercises((prev) => [...prev, data as Exercise]);
    }
    setSaving(false);
  };

  const addExerciseFromCatalog = async (item: CatalogExercise) => {
    if (!selectedId || !item) return;
    setSaving(true);
    const uid = session?.user?.id;
    const { data, error } = await supabase
      .from("exercises")
      .insert({ name: item.name, text: "", eCode: item.id, routine_id: selectedId, creator_id: uid })
      .select("id,name,text,eCode,routine_id,creator_id")
      .single();
    if (!error && data) {
      setExercises((prev) => [...prev, data as Exercise]);
    }
    setSaving(false);
  };

  const saveExercise = async (ex: Exercise) => {
    setSaving(true);
    await supabase
      .from("exercises")
      .update({ name: ex.name, text: ex.text })
      .eq("id", ex.id);
    setSaving(false);
  };

  const deleteExercise = async (exerciseId: string) => {
    setSaving(true);
    await supabase
      .from("exercises")
      .delete()
      .eq("id", exerciseId);
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
    setSetsByExercise((prev) => {
      const copy = { ...prev };
      delete copy[exerciseId];
      return copy;
    });
    setSaving(false);
  };

  const addSet = async (exerciseId: string) => {
    setSaving(true);
    const uid = session?.user?.id;
    const { data, error } = await supabase
      .from("sets")
      .insert({ reps: 0, weight: 0, completed: false, pr: false, exercise_id: exerciseId, creator_id: uid })
      .select("id,reps,weight,completed,pr,exercise_id,creator_id")
      .single();
    if (!error && data) {
      setSetsByExercise((prev) => ({ ...prev, [exerciseId]: [ ...(prev[exerciseId] ?? []), data as SetRow ] }));
    }
    setSaving(false);
  };

  const saveSet = async (sr: SetRow) => {
    setSaving(true);
    await supabase
      .from("sets")
      .update({ reps: sr.reps, weight: sr.weight, completed: sr.completed, pr: sr.pr })
      .eq("id", sr.id);
    setSaving(false);
  };

  const deleteSet = async (exerciseId: string, setId: string) => {
    setSaving(true);
    await supabase
      .from("sets")
      .delete()
      .eq("id", setId);
    setSetsByExercise((prev) => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] ?? []).filter((s) => s.id !== setId),
    }));
    setSaving(false);
  };

  const saveRoutineName = async () => {
    if (!selected) return;
    setSaving(true);
    await supabase
      .from("routines")
      .update({ name: selected.name })
      .eq("id", selected.id);
    setSaving(false);
  };

  const addTrainerRoutine = async () => {
    setSaving(true);
    const uid = session?.user?.id;
    if (!uid) { setSaving(false); router.push("/login"); return; }
    const { data, error } = await supabase
      .from("routines")
      .insert({
        name: "New Trainer Routine",
        type: "trainer",
        text: "",
        picture: null,
        days: null,
        weekly: null,
        date: new Date().toISOString(),
        duration: null,
        creator_id: uid,
      })
      .select("id, name, type, text, picture, days, weekly, date, duration, creator_id")
      .single();
    if (!error && data) {
      setRoutines((prev) => [data as Routine, ...prev]);
      setSelectedId((data as Routine).id);
    }
    setSaving(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <Navigation />
          <div className={styles.pageContent}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                gap: 2,
                width: "100%",
                maxWidth: 1200,
                margin: "0 auto",
                height: "72vh",
                overflow: "hidden",
              }}
            >
              <Paper elevation={1} sx={{ minWidth: 320, width: 360, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper", color: "text.primary" }}>
                <Box sx={{ p: 1.5, borderBottom: "2px solid", borderColor: "primary.main", position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search routines…"
                      size="small"
                      fullWidth
                      sx={{
                        flex: 1,
                        "& .MuiInputBase-input": { color: "text.primary" },
                        "& .MuiInputBase-input::placeholder": { color: "text.secondary", opacity: 0.7 }
                      }}
                      InputLabelProps={{ style: { color: "text.primary" } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={addTrainerRoutine}
                      disabled={saving}
                      color="primary"
                      variant="contained"
                    >
                      New Trainer
                    </Button>
                  </Stack>
                </Box>
                <Box sx={{ overflowY: "auto", maxHeight: "80vh" }}>
                  {loading && !authLoading && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
                      <CircularProgress size={20} />
                      <span>Loading routines…</span>
                    </Box>
                  )}
                  {error && (
                    <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
                  )}
                  {!loading && !error && filtered.map((item) => {
                    const initials = (item.name ?? "?").split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();
                    return (
                      <ListItemButton key={item.id} selected={selectedId === item.id} onClick={() => setSelectedId(item.id)} sx={{ alignItems: "flex-start", py: 1.25 }}>
                        <ListItemIcon sx={{ minWidth: 44 }}>
                          <Avatar src={item.picture ?? undefined} sx={{ width: 28, height: 28 }}>
                            {(!item.picture ? initials : null)}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={<Typography variant="subtitle1" noWrap>{item.name ?? "Untitled Routine"}</Typography>}
                          secondary={
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                              {item.type ? <Chip size="small" icon={<FitnessCenterIcon />} label={String(item.type).charAt(0).toUpperCase() + String(item.type).slice(1)} variant="outlined" color="primary" sx={{ borderColor: "divider" }} /> : null}
                              {item.duration != null ? <Chip size="small" icon={<AccessTimeIcon />} label={`${item.duration}`} variant="outlined" color="primary" sx={{ borderColor: "divider" }} /> : null}
                              {item.date ? <Chip size="small" icon={<TodayIcon />} label={new Date(item.date).toLocaleDateString()} variant="outlined" color="primary" sx={{ borderColor: "divider" }} /> : null}
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    );
                  })}
                  {!loading && !error && filtered.length === 0 && (
                    <Box sx={{ p: 3, textAlign: "center", opacity: 0.7 }}>
                      <Typography variant="body2">No routines match your search.</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>

              <Paper elevation={1} sx={{ flex: 1, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper", color: "text.primary" }}>
                <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
                  {selected ? (
                    <>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <TextField
                          value={selected.name ?? ""}
                          onChange={(e) => setRoutines((prev) => prev.map(r => r.id === selected.id ? { ...r, name: e.target.value } : r))}
                          placeholder="Routine name"
                          size="small"
                          sx={{
                            minWidth: 280,
                            "& .MuiInputBase-input": { color: "text.primary" }
                          }}
                        />
                        <IconButton onClick={saveRoutineName} disabled={saving} aria-label="Save routine name">
                          <SaveIcon />
                        </IconButton>
                      </Stack>

                      {selected.text ? (
                        <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", mb: 2 }}>{selected.text}</Typography>
                      ) : (
                        <Typography variant="body1" sx={{ opacity: 0.7, mb: 2 }}>No notes for this routine.</Typography>
                      )}

                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="h6">Exercises</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Autocomplete
                            size="small"
                            sx={{ minWidth: 260 }}
                            options={catalogOptions}
                            getOptionLabel={(o) => o.name}
                            onChange={(e, val) => { if (val) addExerciseFromCatalog(val as CatalogExercise); }}
                            renderInput={(params) => (
                              <TextField {...params} placeholder="Add from catalog…" />
                            )}
                            disabled={saving || !selectedId}
                          />
                          <Button size="small" startIcon={<AddIcon />} onClick={addExercise} disabled={saving} color="primary" variant="outlined" sx={{ borderColor: "divider" }}>Add custom</Button>
                        </Stack>
                      </Stack>

                      <Stack spacing={2}>
                        {exercises.map((ex, idx) => (
                          <Paper key={ex.id} sx={{ p: 1.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1}>
                                <TextField
                                  value={ex.name ?? ""}
                                  onChange={(e) => setExercises((prev) => prev.map(p => p.id === ex.id ? { ...p, name: e.target.value } : p))}
                                  placeholder="Exercise name"
                                  size="small"
                                  sx={{
                                    "& .MuiInputBase-input": { color: "text.primary" }
                                  }}
                                />
                                <IconButton onClick={() => saveExercise(ex)} disabled={saving} aria-label="Save exercise">
                                  <SaveIcon />
                                </IconButton>
                                <IconButton onClick={() => deleteExercise(ex.id)} disabled={saving} aria-label="Delete exercise">
                                  <DeleteIcon />
                                </IconButton>
                              </Stack>
                              <TextField
                                value={ex.text ?? ""}
                                onChange={(e) => setExercises((prev) => prev.map(p => p.id === ex.id ? { ...p, text: e.target.value } : p))}
                                placeholder="Notes"
                                size="small"
                                multiline
                                minRows={2}
                                sx={{
                                  "& .MuiInputBase-input": { color: "text.primary" }
                                }}
                              />

                              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
                                <Typography variant="subtitle2">Sets</Typography>
                                <Button size="small" startIcon={<AddIcon />} onClick={() => addSet(ex.id)} disabled={saving} color="primary" variant="outlined" sx={{ borderColor: "divider" }}>Add set</Button>
                              </Stack>

                              <Stack spacing={1}>
                                {(setsByExercise[ex.id] ?? []).map((sr) => (
                                  <Stack key={sr.id} direction="row" spacing={1} alignItems="center">
                                    <TextField
                                      type="number"
                                      size="small"
                                      label="Reps"
                                      value={sr.reps ?? 0}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setSetsByExercise((prev) => ({ ...prev, [ex.id]: (prev[ex.id] ?? []).map(s => s.id === sr.id ? { ...s, reps: val } : s) }));
                                      }}
                                      sx={{
                                        "& .MuiInputBase-input": { color: "text.primary" }
                                      }}
                                    />
                                    <TextField
                                      type="number"
                                      size="small"
                                      label="Weight"
                                      value={sr.weight ?? 0}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setSetsByExercise((prev) => ({ ...prev, [ex.id]: (prev[ex.id] ?? []).map(s => s.id === sr.id ? { ...s, weight: val } : s) }));
                                      }}
                                      sx={{
                                        "& .MuiInputBase-input": { color: "text.primary" }
                                      }}
                                    />
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                      <Checkbox checked={!!sr.completed} onChange={(e) => setSetsByExercise((prev) => ({ ...prev, [ex.id]: (prev[ex.id] ?? []).map(s => s.id === sr.id ? { ...s, completed: e.target.checked } : s) }))} />
                                      <Typography variant="caption">Done</Typography>
                                    </Stack>
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                      <Checkbox checked={!!sr.pr} onChange={(e) => setSetsByExercise((prev) => ({ ...prev, [ex.id]: (prev[ex.id] ?? []).map(s => s.id === sr.id ? { ...s, pr: e.target.checked } : s) }))} />
                                      <Typography variant="caption">PR</Typography>
                                    </Stack>
                                    <IconButton onClick={() => saveSet(sr)} disabled={saving}>
                                      <SaveIcon />
                                    </IconButton>
                                    <IconButton onClick={() => deleteSet(ex.id, sr.id)} disabled={saving} aria-label="Delete set">
                                      <DeleteIcon />
                                    </IconButton>
                                  </Stack>
                                ))}
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </>
                  ) : null}
                </Box>
              </Paper>
            </Box>
          </div>
        </main>
        <footer className={styles.footer}></footer>
      </div>
    </ThemeProvider>
  );
}
