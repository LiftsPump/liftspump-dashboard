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
  CssBaseline,
  Autocomplete
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Divider from "@mui/material/Divider";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import SearchIcon from "@mui/icons-material/Search";
import TodayIcon from "@mui/icons-material/Today";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import SaveIcon from "@mui/icons-material/Save";
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";

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
  text?: string | null; // freeform trainer notes/tags
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
  cost: number | null;
};

// ---- Supabase ----
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

// ---- Theme ----
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#1AE080" },
    background: { default: "#121212", paper: "#181818" },
    text: { primary: "#EAEAEA", secondary: "#B0B0B0" },
    divider: "rgba(255,255,255,0.12)",
  },
});

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

// Consistency: average sessions per week over the past N weeks (default 8)
function avgSessionsPerWeek(routines: Routine[], weeks: number = 8): number {
  if (!routines.length || weeks <= 0) return 0;
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - weeks * 7);
  const recent = routines.filter(r => r.date && new Date(r.date) >= start);
  if (!recent.length) return 0;
  // group by ISO week number
  const byWeek = new Map<string, number>();
  for (const r of recent) {
    if (!r.date) continue;
    const d = new Date(r.date);
    const key = isoWeekKey(d); // e.g., 2025-W36
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }
  const weeksConsidered = Math.max(1, Math.min(weeks, byWeek.size || weeks));
  const total = Array.from(byWeek.values()).reduce((a, b) => a + b, 0);
  return Math.round((total / weeksConsidered) * 10) / 10; // 1 decimal
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
        .select("creator_id, trainer_id, subs, routines, cost")
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

      // Fetch profiles for subs
      let profs: Profile[] = [];
      if (subsList.length) {
        const { data: profData, error: profErr } = await supabase
          .from("profile")
          .select("creator_id, first_name, last_name, email, username, type, last_synced, height, weight, text")
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
      // prepend into local history
      setUserRoutines((prev) => [ins as Routine, ...prev]);
      setSummary(basicSummarize([ins as Routine, ...userRoutines]));
      // --- Append .Assigned tag to profile.text ---
      try {
        // fetch current text
        const { data: curTextRow } = await supabase
          .from("profile")
          .select("text")
          .eq("creator_id", selectedUser)
          .single();
        const alreadyTagged = (curTextRow?.text ?? "").includes(".Assigned");
        const newText = alreadyTagged ? (curTextRow?.text ?? "") : `${(curTextRow?.text ?? "").trim()}${(curTextRow?.text ?? "").trim() ? " " : ""}.Assigned`;
        if (!alreadyTagged) {
          await supabase
            .from("profile")
            .update({ text: newText })
            .eq("creator_id", selectedUser);
          // reflect in local state
          setProfiles(prev => prev.map(p => p.creator_id === selectedUser ? { ...p, text: newText } : p));
        }
      } catch (e) {
        // non-fatal: ignore profile tag write errors
        console.warn("Profile tag update failed", e);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setAssigning(false);
    }
  };

  const selectedProfile = useMemo(() => profiles.find(p => p.creator_id === selectedUser) || null, [profiles, selectedUser]);

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
              {/* LEFT: Users list */}
              <Paper elevation={1} sx={{ minWidth: 320, width: 360, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper", color: "text.primary" }}>
                <Box sx={{ p: 1.5, borderBottom: "2px solid", borderColor: "primary.main", position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search users…"
                      size="small"
                      fullWidth
                      sx={{
                        flex: 1,
                        "& .MuiInputBase-input": { color: "text.primary" },
                        "& .MuiInputBase-input::placeholder": { color: "text.secondary", opacity: 0.7 }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Stack>
                </Box>
                <Box sx={{ overflowY: "auto", maxHeight: "80vh" }}>
                  {loading && !authLoading && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
                      <CircularProgress size={20} />
                      <span>Loading users…</span>
                    </Box>
                  )}
                  {error && (
                    <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
                  )}
                  {!loading && !error && filteredProfiles.map((p) => {
                    const initials = initialsFromProfile(p);
                    const subtitle = [p.username, p.email].filter(Boolean).join(" · ");
                    return (
                      <ListItemButton key={p.creator_id} selected={selectedUser === p.creator_id} onClick={() => setSelectedUser(p.creator_id)} sx={{ alignItems: "flex-start", py: 1.25 }}>
                        <ListItemIcon sx={{ minWidth: 44 }}>
                          <Avatar sx={{ width: 28, height: 28 }}>{initials}</Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={<Typography variant="subtitle1" noWrap>{[p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || "Member"}</Typography>}
                          secondary={
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                              {subtitle ? <Typography variant="caption" sx={{ opacity: 0.7 }} noWrap>{subtitle}</Typography> : null}
                              {p.last_synced ? <Chip size="small" icon={<TodayIcon />} label={`Synced ${new Date(p.last_synced).toLocaleDateString()}`} variant="outlined" color="primary" sx={{ borderColor: "divider" }} /> : null}
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    );
                  })}
                  {!loading && !error && filteredProfiles.length === 0 && (
                    <Box sx={{ p: 3, textAlign: "center", opacity: 0.7 }}>
                      <Typography variant="body2">No users match your search.</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>

              {/* RIGHT: Details */}
              <Paper elevation={1} sx={{ flex: 1, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper", color: "text.primary" }}>
                <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
                  {selectedProfile ? (
                    <>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                        <Avatar sx={{ width: 40, height: 40 }}>{initialsFromProfile(selectedProfile)}</Avatar>
                        <Box>
                          <Typography variant="h6">{[selectedProfile.first_name, selectedProfile.last_name].filter(Boolean).join(" ") || selectedProfile.username || "Member"}</Typography>
                          <Typography variant="body2" sx={{ opacity: 0.75 }}>{[selectedProfile.username, selectedProfile.email].filter(Boolean).join(" · ")}</Typography>
                        </Box>
                        {(() => {
                          const bmi = computeBMI(selectedProfile.height ?? null, selectedProfile.weight ?? null);
                          const cat = bmiCategory(bmi);
                          return bmi != null ? (
                            <Chip size="small" label={`BMI ${bmi}${cat ? ` · ${cat}` : ""}`} variant="outlined" />
                          ) : null;
                        })()}
                        {(() => {
                          const spw = avgSessionsPerWeek(userRoutines, 8);
                          const lbl = consistencyLabel(spw);
                          return (
                            <Chip size="small" label={`Consistency ${spw}/wk · ${lbl}`} variant="outlined" />
                          );
                        })()}
                        {(() => {
                          const avgMins = avgDuration(userRoutines, 10);
                          const lbl = strengthLabel(avgMins);
                          return (
                            <Chip size="small" label={`Endurance ${avgMins}m · ${lbl}`} variant="outlined" />
                          );
                        })()}
                        {selectedProfile?.text?.includes('.Assigned') ? (
                          <Chip size="small" label=".Assigned" variant="outlined" />
                        ) : null}
                      </Stack>

                      <Paper sx={{ p: 2, mb: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>AI summary</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{summary || "No data yet."}</Typography>
                      </Paper>

                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <FitnessCenterIcon fontSize="small" />
                        <Typography variant="subtitle1">Assign a trainer routine</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <Autocomplete
                          size="small"
                          sx={{ minWidth: 320 }}
                          options={trainerRoutines}
                          getOptionLabel={(o) => o.name ?? "Untitled"}
                          onChange={(e, val) => setRoutinePick(val as Routine)}
                          renderInput={(params) => (
                            <TextField {...params} placeholder="Pick one of your trainer routines…" />
                          )}
                          disabled={assigning || !trainerRoutines.length}
                        />
                        <Button onClick={assignRoutineToUser} disabled={!routinePick || assigning} variant="contained">Assign</Button>
                      </Stack>

                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>Recent routines</Typography>
                      <Stack spacing={1}>
                        {userRoutines.slice(0, 10).map((r) => (
                          <Paper key={r.id} sx={{ p: 1.25, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                              <Box>
                                <Typography variant="body1">{r.name || "Untitled"}</Typography>
                                <Typography variant="caption" sx={{ opacity: 0.75 }}>{r.type} · {r.date ? new Date(r.date).toLocaleString() : "n/a"}</Typography>
                              </Box>
                              {r.duration != null ? (
                                <Chip size="small" label={`${r.duration}`} />
                              ) : null}
                            </Stack>
                          </Paper>
                        ))}
                        {!userRoutines.length && (
                          <Typography variant="body2" sx={{ opacity: 0.7 }}>No routines yet.</Typography>
                        )}
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
