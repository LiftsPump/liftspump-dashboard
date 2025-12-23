"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import { Box, List, ListItemButton, ListItemIcon, ListItemText, CircularProgress, Alert, Typography, Paper, TextField, InputAdornment, Avatar, Chip, Stack, Button, IconButton, Checkbox, Autocomplete } from "@mui/material";
// Global theme is provided in RootLayout
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
import RoutinesSidebar from "./components/RoutinesSidebar";
import RoutineDetail from "./components/RoutineDetail";
import useDocumentTitle from "../../hooks/useDocumentTitle";

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


export default function Routines() {
  useDocumentTitle("Routines | Liftspump");
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

  const saveRoutineNotes = async () => {
    if (!selected) return;
    setSaving(true);
    await supabase
      .from('routines')
      .update({ text: selected.text })
      .eq('id', selected.id);
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
    await supabase
      .from("sets")
      .update({ reps: sr.reps, weight: sr.weight, completed: sr.completed, pr: sr.pr })
      .eq("id", sr.id);
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

  

  const deleteRoutine = async () => {
    if (!selected) return;
    setSaving(true);
    const { data: exs } = await supabase
      .from('exercises')
      .select('id')
      .eq('routine_id', selected.id);
    const exIds = (exs ?? []).map((e: any) => e.id);
    if (exIds.length) {
      await supabase.from('sets').delete().in('exercise_id', exIds as any);
      await supabase.from('exercises').delete().in('id', exIds as any);
    }
    await supabase.from('routines').delete().eq('id', selected.id);
    setRoutines(prev => prev.filter(r => r.id !== selected.id));
    setSelectedId(null);
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
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <Navigation />
          <div className={styles.pageContent}>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                gap: { xs: 2, lg: 2.5 },
                width: "100%",
                maxWidth: 1200,
                margin: "0 auto",
                height: { xs: "auto", lg: "84vh" },
                overflow: { xs: "visible", lg: "hidden" },
              }}
            >
              <RoutinesSidebar
                query={query}
                onQueryChange={setQuery}
                filtered={filtered as any}
                selectedId={selectedId}
                onSelect={setSelectedId}
                addTrainerRoutine={addTrainerRoutine}
                loading={loading}
                error={error}
                saving={saving}
              />

              <Paper elevation={1} sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.paper", color: "text.primary" }}>
                <Box sx={{ flex: 1, overflowY: "auto", p: 2, position: "relative" }}>
                  {selected && (
                    <Box
                      sx={{
                        position: { xs: "static", lg: "absolute" },
                        right: { lg: "13%" },
                        mt: { xs: 0, lg: 1 },
                        mb: { xs: 1.5, lg: 0 },
                        display: "flex",
                        justifyContent: { xs: "flex-start", lg: "flex-end" },
                      }}
                    >
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={deleteRoutine} disabled={saving}>Delete routine</Button>
                    </Box>
                  )}
                  <RoutineDetail
                    selected={selected as any}
                    onUpdateRoutine={(patch: Partial<any>) => { if (selected) { setRoutines((prev) => prev.map(r => r.id === selected.id ? { ...r, ...patch } : r)); } }}
                    onSaveRoutine={async (patch: Partial<any>) => { if (!selected) return; setSaving(true); await supabase.from('routines').update(patch).eq('id', selected.id); setSaving(false); }}
                    exercises={exercises as any}
                    onChangeExercise={(id, patch) => {
                      // Update local state
                      setExercises((prev) => {
                        const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
                        // Persist change
                        const updated = next.find((p) => p.id === id);
                        if (updated) {
                          // cast is safe since our state holds `Exercise` objects
                          saveExercise(updated as Exercise);
                        }
                        return next;
                      });
                    }}
                    onAddExercise={addExercise}
                    onAddFromCatalog={addExerciseFromCatalog as any}
                    onSaveExercise={saveExercise as any}
                    onDeleteExercise={deleteExercise}
                    setsByExercise={setsByExercise as any}
                    onAddSet={addSet}
                    onChangeSet={(exerciseId, setId, patch) => {
                      setSetsByExercise((prev) => {
                        const nextList = (prev[exerciseId] ?? []).map((s) =>
                          s.id === setId ? { ...s, ...patch } : s
                        );
                        const updated = nextList.find((s) => s.id === setId);
                        if (updated) {
                          saveSet(updated as SetRow);
                        }
                        return { ...prev, [exerciseId]: nextList };
                      });
                    }}
                    onSaveSet={saveSet as any}
                    onDeleteSet={deleteSet}
                    catalogOptions={catalogOptions as any}
                    saving={saving}
                  />
                </Box>
              </Paper>
            </Box>
          </div>
        </main>
        <footer className={styles.footer}></footer>
      </div>
  );
}
