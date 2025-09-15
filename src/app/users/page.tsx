"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import {
  Box,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  Avatar,
  Chip,
  Stack,
  Button,
  IconButton,
  Autocomplete
} from "@mui/material";
// Global theme is provided in RootLayout
import Divider from "@mui/material/Divider";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import SearchIcon from "@mui/icons-material/Search";
import TodayIcon from "@mui/icons-material/Today";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import SaveIcon from "@mui/icons-material/Save";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";
import UsersSidebar from "./components/UsersSidebar";
import UserDetail from "./components/UserDetail";

// ---- Types ----

type Profile = {
  creator_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  username: string | null;
  type: number | null; // 0=member,1=trainer (per your schema)
  last_synced: string | null; // date
  height: number | null;
  weight: number | null;
  picture?: string | null; // if you add later
};

type Routine = {
  id: string;
  name: string | null;
  type: string | null; // "trainer" | "assigned" | "user" etc
  text: string | null;
  picture: string | null;
  days: number | null;
  weekly: number | null;
  date: string | null; // ISO
  duration: number | null;
  creator_id: string | null;
};

type TrainerRow = {
  creator_id: string; // AUTH user id (trainer's user id)
  trainer_id: string; // random/opaque public id for trainers
  subs: string[] | null; // array of profile UUIDs (profile.creator_id)
  routines: string[] | null; // optional: array of routine ids
};

// ---- Supabase ----
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

// ---- Theme ----

// ---- Helpers ----
function initialsFromProfile(p: Profile) {
  const f = (p.first_name ?? "").trim();
  const l = (p.last_name ?? "").trim();
  const i = (f ? f[0] : "") + (l ? l[0] : "");
  return (i || (p.username?.slice(0, 2) ?? "?")).toUpperCase();
}

function basicSummarize(routines: Routine[]): string {
  if (!routines.length) return "No workouts on record yet. Assign a plan to get them started.";
  const days = new Set(
    routines
      .filter(r => r.date)
      .map(r => new Date(r.date as string).toDateString())
  ).size;
  const byType = routines.reduce<Record<string, number>>((acc, r) => {
    const t = (r.type ?? "unknown").toLowerCase();
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const recent = routines[0]?.date ? new Date(routines[0].date as string) : null;
  const last = recent ? recent.toLocaleDateString() : "n/a";
  const typeBits = Object.entries(byType)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  return `Logged ${routines.length} routines across ${days} day(s). Last activity: ${last}. Mix: ${typeBits}.`;
}

function computeBMI(heightIn: number | null, weightLb: number | null): number | null {
  if (heightIn == null || weightLb == null) return null;
  if (heightIn <= 0) return null;
  const hMeters = heightIn * 0.0254; // inches -> meters
  const wKg = weightLb * 0.45359237; // pounds -> kg
  const bmi = wKg / (hMeters * hMeters);
  return Math.round(bmi * 10) / 10; // one decimal place
}

function bmiCategory(bmi: number | null): string | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

// Consistency: average sessions per week over the past N weeks (default 8), only counting routines where type is "date"
function avgSessionsPerWeek(routines: Routine[], weeks: number = 8): number {
  if (!routines.length || weeks <= 0) return 0;
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - weeks * 7);
  // Only consider explicitly logged-by-date sessions
  const recent = routines.filter(r =>
    r.date && ((r.type ?? '').toLowerCase() === 'date') && new Date(r.date) >= start
  );
  if (!recent.length) return 0;
  const byWeek = new Map<string, number>();
  for (const r of recent) {
    const d = new Date(r.date as string);
    const key = isoWeekKey(d);
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }
  const weeksConsidered = Math.max(1, Math.min(weeks, byWeek.size || weeks));
  const total = Array.from(byWeek.values()).reduce((a, b) => a + b, 0);
  return Math.round((total / weeksConsidered) * 10) / 10;
}

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function consistencyLabel(spw: number): string {
  if (spw >= 3) return "Excellent";
  if (spw >= 2) return "High";
  if (spw >= 1) return "Moderate";
  if (spw > 0) return "Low";
  return "Inactive";
}

// Strength proxy: average duration of last N sessions with a label
function avgDuration(routines: Routine[], n: number = 10): number {
  const durations = routines
    .filter(r => typeof r.duration === 'number' && r.duration != null)
    .slice(0, n)
    .map(r => r.duration as number);
  if (!durations.length) return 0;
  const m = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.round(m);
}

function strengthLabel(avgMins: number): string {
  if (avgMins >= 60) return "Advanced";
  if (avgMins >= 40) return "Intermediate";
  if (avgMins > 0) return "Beginner";
  return "No Data";
}

export default function Users() {
  const router = useRouter();

  // left panel
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // data
  const [subs, setSubs] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // right panel data
  const [userRoutines, setUserRoutines] = useState<Routine[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [trainerRoutines, setTrainerRoutines] = useState<Routine[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [routinePick, setRoutinePick] = useState<Routine | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);

  // Supabase Auth Helpers
  const session = useSession();
  const { isLoading: authLoading } = useSessionContext();

  // ---- boot ----
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (authLoading) return; // wait for session to resolve to avoid flicker
      setLoading(true);
      setError(null);

      const uid = session?.user?.id || null;
      if (!uid) {
        if (alive) setLoading(false);
        router.push("/login");
        return;
      }

      // Fetch trainer row to get subs
      const { data: trainerRows, error: trainerErr } = await supabase
        .from("trainer")
        .select("creator_id, trainer_id, subs, routines")
        .eq("creator_id", uid)
        .limit(1);

      if (trainerErr) {
        if (alive) {
          setError(trainerErr.message);
          setLoading(false);
        }
        return;
      }

      const subsList: string[] = Array.isArray(trainerRows?.[0]?.subs)
        ? (trainerRows?.[0]?.subs as string[])
        : [];
      if (alive) setSubs(subsList);
      const tId = (trainerRows?.[0]?.trainer_id as string) || null;
      if (alive) setTrainerId(tId);

      // Fetch profiles for subs
      let profs: Profile[] = [];
      if (subsList.length) {
        const { data: profData, error: profErr } = await supabase
          .from("profile")
          .select("creator_id, first_name, last_name, email, username, type, last_synced, height, weight")
          .in("creator_id", subsList);
        if (profErr) {
          if (alive) {
            setError(profErr.message);
            setLoading(false);
          }
          return;
        }
        profs = (profData ?? []) as Profile[];
      }
      if (alive) setProfiles(profs);

      // Fetch this trainer's available routines to assign
      const { data: myRoutines, error: rErr } = await supabase
        .from("routines")
        .select("id, name, type, text, picture, days, weekly, date, duration, creator_id")
        .eq("creator_id", uid)
        .eq("type", "trainer")
        .order("date", { ascending: false });
      if (alive && !rErr) setTrainerRoutines((myRoutines ?? []) as Routine[]);

      // Default selection
      if (alive && !selectedUser && profs.length) setSelectedUser(profs[0].creator_id);
      if (alive) setLoading(false);
    };
    run();
    return () => {
      alive = false;
    };
  }, [router, session, authLoading]);

  // ---- when a user is selected, fetch their routine history & summarize ----
  useEffect(() => {
    const load = async () => {
      if (!selectedUser) return;
      const { data, error } = await supabase
        .from("routines")
        .select("id, name, type, text, picture, days, weekly, date, duration, creator_id")
        .eq("creator_id", selectedUser)
        .order("date", { ascending: false })
        .limit(50);
      if (!error) {
        const items = (data ?? []) as Routine[];
        setUserRoutines(items);
        setSummary(basicSummarize(items));
      }
    };
    load();
  }, [selectedUser]);

  // ---- filtered list ----
  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      (p.first_name ?? "").toLowerCase().includes(q) ||
      (p.last_name ?? "").toLowerCase().includes(q) ||
      (p.username ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
  }, [profiles, query]);

  // ---- actions ----
  const inviteUser = async () => {
    if (!trainerId) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${base}/join?trainer_id=${encodeURIComponent(trainerId)}`;
    try {
      await navigator.clipboard?.writeText(inviteUrl);
    } catch {}
    // Open the public join page where the user can pick a tier, login, and subscribe
    window.open(inviteUrl, "_blank", "noopener,noreferrer");
  };
  const saveUserNotes = async (text: string) => {
    // optional: store a trainer note into profile.text if exists
    // placeholder for future edits
    return text;
  };

  const assignRoutineToUser = async () => {
    if (!routinePick || !selectedUser) return;
    setAssigning(true);
    try {
      // copy the trainer routine to the user's account as an "assigned" routine
      const src = routinePick;
      const payload = {
        name: src.name ? `Assigned: ${src.name}` : "Assigned Routine",
        type: "assigned",
        text: src.text,
        picture: src.picture,
        days: src.days,
        weekly: src.weekly,
        date: new Date().toISOString(),
        duration: src.duration,
        creator_id: selectedUser,
      } as Partial<Routine> & { creator_id: string };
      const { data: ins, error } = await supabase
        .from("routines")
        .insert(payload)
        .select("id, name, type, text, picture, days, weekly, date, duration, creator_id")
        .single();
      if (error) throw error;
      const newRoutine = ins as Routine;

      // Fetch source exercises for the picked trainer routine
      const { data: srcExercises, error: exErr } = await supabase
        .from("exercises")
        .select("id,name,text,eCode")
        .eq("routine_id", src.id)
        .order("name", { ascending: true });
      if (exErr) throw exErr;

      // For each exercise, insert a copy for the new routine and then copy its sets
      if (srcExercises && srcExercises.length) {
        for (const ex of srcExercises as any[]) {
          const { data: newEx, error: inExErr } = await supabase
            .from("exercises")
            .insert({
              name: ex.name,
              text: ex.text,
              eCode: ex.eCode ?? null,
              routine_id: newRoutine.id,
              creator_id: selectedUser,
            })
            .select("id")
            .single();
          if (inExErr) throw inExErr;

          // Load sets for source exercise
          const { data: srcSets, error: setErr } = await supabase
            .from("sets")
            .select("reps,weight,completed,pr")
            .eq("exercise_id", ex.id)
            .order("id", { ascending: true });
          if (setErr) throw setErr;

          if (srcSets && srcSets.length) {
            // Insert sets pointing to new exercise id
            const rows = (srcSets as any[]).map((s) => ({
              reps: s.reps ?? null,
              weight: s.weight ?? null,
              completed: s.completed ?? null,
              pr: s.pr ?? null,
              exercise_id: (newEx as any).id,
              creator_id: selectedUser,
            }));
            const { error: insSetErr } = await supabase
              .from("sets")
              .insert(rows);
            if (insSetErr) throw insSetErr;
          }
        }
      }

      // prepend into local history
      setUserRoutines((prev) => [newRoutine, ...prev]);
      setSummary(basicSummarize([newRoutine, ...userRoutines]));
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setAssigning(false);
    }
  };

  const selectedProfile = useMemo(() => profiles.find(p => p.creator_id === selectedUser) || null, [profiles, selectedUser]);
  const assignedRoutines = useMemo(
    () => userRoutines.filter(r => (r.type ?? "").toLowerCase() === "assigned"),
    [userRoutines]
  );

  return (
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
              <UsersSidebar
                query={query}
                onQueryChange={setQuery}
                loading={loading}
                authLoading={authLoading}
                error={error}
                filteredProfiles={filteredProfiles as any}
                selectedUser={selectedUser}
                onSelectUser={setSelectedUser}
                trainerId={trainerId}
                inviteUser={inviteUser}
              />

              <UserDetail
                selectedProfile={selectedProfile as any}
                summary={summary}
                trainerRoutines={trainerRoutines as any}
                onPickRoutine={(val) => setRoutinePick(val as any)}
                onAssignRoutine={assignRoutineToUser}
                assigning={assigning}
                assignedRoutines={assignedRoutines as any}
                userRoutines={userRoutines as any}
                onKick={async () => {
                  if (!trainerId || !selectedUser) return;
                  await fetch('/api/subscriptions/kick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trainer_id: trainerId, user_id: selectedUser, immediate: true }) });
                  setProfiles(prev => prev.filter(p => p.creator_id !== selectedUser));
                  setSelectedUser(null);
                }}
              />
            </Box>
          </div>
        </main>
        <footer className={styles.footer}></footer>
      </div>
  );
}
