"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import {
  Box,
} from "@mui/material";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
// Global theme is provided in RootLayout
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, useSessionContext } from "@supabase/auth-helpers-react";
import UsersSidebar from "./components/UsersSidebar";
import UserDetail from "./components/UserDetail";
import useDocumentTitle from "../../hooks/useDocumentTitle";

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

type Memory = {
  id: string;
  text: string | null;
  type: string | null;
  created_at: string | null;
  confidence: number | null;
};

type WeightEntry = {
  id: string;
  creator_id: string;
  created_at: string;
  weight_kg: number | null;
  source: string | null;
  bf_percent: number | null;
};

type RoutineExercise = {
  id: string;
  name: string | null;
  text: string | null;
  eCode: string | null;
  routine_id: string | null;
  creator_id: string | null;
};

type RoutineSet = {
  id: string;
  reps: number | null;
  weight: number | null;
  completed: boolean | null;
  pr: boolean | null;
  exercise_id: string | null;
  creator_id: string | null;
};

type RoutineDetailSnapshot = {
  routine: Routine | null;
  exercises: RoutineExercise[];
  sets: RoutineSet[];
};

// ---- Theme ----

// ---- Helpers ----
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

export default function Users() {
  useDocumentTitle("Users | Liftspump");
  const router = useRouter();

  // left panel
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lastSyncedFilter, setLastSyncedFilter] = useState("");
  const [assignmentDate, setAssignmentDate] = useState(() => {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch {
      return "";
    }
  });

  // data
  const [subs, setSubs] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // right panel data
  const [userRoutines, setUserRoutines] = useState<Routine[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [fallbackSummary, setFallbackSummary] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryWarning, setSummaryWarning] = useState<string | null>(null);
  const [trainerRoutines, setTrainerRoutines] = useState<Routine[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [routinePick, setRoutinePick] = useState<Routine | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [repeatChoice, setRepeatChoice] = useState<string>('none');
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [memoryVotingKey, setMemoryVotingKey] = useState<string | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [weightInsight, setWeightInsight] = useState<string | null>(null);
  const [weightInsightDate, setWeightInsightDate] = useState<string | null>(null);
  const [weightLoading, setWeightLoading] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [routineDetails, setRoutineDetails] = useState<Record<string, RoutineDetailSnapshot>>({});
  const [routineDetailLoading, setRoutineDetailLoading] = useState<Record<string, boolean>>({});
  const handleSnackClose = () => setSnack((prev) => ({ ...prev, open: false }));

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

      try {
        const response = await fetch("/api/users/dashboard", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load trainer data");
        }

        if (!alive) return;

        const subsList: string[] = Array.isArray(payload?.subs)
          ? (payload.subs as string[])
          : [];
        const profileRows: Profile[] = Array.isArray(payload?.profiles)
          ? (payload.profiles as Profile[])
          : [];
        const routineRows: Routine[] = Array.isArray(payload?.trainerRoutines)
          ? (payload.trainerRoutines as Routine[])
          : [];

        setSubs(subsList);
        setProfiles(profileRows);
        setTrainerId((payload?.trainerId as string) || null);
        setTrainerRoutines(routineRows);

        if (!selectedUser && profileRows.length) {
          setSelectedUser(profileRows[0].creator_id);
        }
      } catch (err: any) {
        if (alive) {
          setError(err?.message || "Failed to load trainer data");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [router, session, authLoading]);

  // ---- when a user is selected, fetch their routine history & summarize ----
  useEffect(() => {
    let alive = true;

    const fetchInsights = async (userId: string, defaultSummary: string) => {
      setSummaryLoading(true);
      setSummaryWarning(null);
      try {
        const response = await fetch(
          `/api/users/insights?user_id=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        const payload = await response.json().catch(() => ({}));
        if (!alive) return;
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to generate AI insights");
        }
        const summaryText =
          typeof payload?.summary === "string" ? payload.summary.trim() : "";
        if (summaryText) {
          setSummary(summaryText);
          if (payload?.warning && typeof payload.warning === "string") {
            setSummaryWarning(payload.warning);
          } else {
            setSummaryWarning(null);
          }
        } else {
          setSummary(defaultSummary);
          setSummaryWarning(
            payload?.warning && typeof payload.warning === "string"
              ? payload.warning
              : "Gemini returned no insight; showing baseline instead."
          );
        }
      } catch (err: any) {
        if (!alive) return;
        setSummary(defaultSummary);
        setSummaryWarning(err?.message || "AI insights unavailable.");
      } finally {
        if (!alive) return;
        setSummaryLoading(false);
      }
    };

    const load = async () => {
      if (!selectedUser) {
        setUserRoutines([]);
        setSummary("");
        setFallbackSummary("");
        setSummaryLoading(false);
        setSummaryWarning(null);
        setMemories([]);
        setMemoriesError(null);
        setWeightEntries([]);
        setWeightInsight(null);
        setWeightInsightDate(null);
        setWeightError(null);
        setRoutineDetails({});
        setRoutineDetailLoading({});
        return;
      }

      try {
        const response = await fetch(
          `/api/users/routines?user_id=${encodeURIComponent(selectedUser)}`,
          { cache: "no-store" }
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load routines");
        }

        if (!alive) return;
        const items = Array.isArray(payload?.routines)
          ? (payload.routines as Routine[])
          : [];
        setUserRoutines(items);
        const baseline = basicSummarize(items);
        setFallbackSummary(baseline);
        setSummary("");
        setSummaryWarning(null);
        fetchInsights(selectedUser, baseline);
      } catch (err: any) {
        if (alive) {
          const baseline = basicSummarize([]);
          setFallbackSummary(baseline);
          setSummary(baseline);
          setSummaryWarning(err?.message || "AI insights unavailable.");
          setSummaryLoading(false);
          setError(err?.message || "Failed to load routines");
        }
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [selectedUser]);

  useEffect(() => {
    let alive = true;
    const loadMemories = async () => {
      if (!selectedUser) {
        if (alive) {
          setMemories([]);
          setMemoriesError(null);
          setMemoriesLoading(false);
        }
        return;
      }
      setMemoriesLoading(true);
      setMemoriesError(null);
      try {
        const response = await fetch(
          `/api/users/memories?user_id=${encodeURIComponent(selectedUser)}`,
          { cache: "no-store" }
        );
        const payload = await response.json().catch(() => ({}));
        if (!alive) return;
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load memories");
        }
        const items = Array.isArray(payload?.memories)
          ? (payload.memories as Memory[])
          : [];
        setMemories(items);
      } catch (err: any) {
        if (alive) {
          setMemories([]);
          setMemoriesError(err?.message || "Failed to load memories");
        }
      } finally {
        if (alive) setMemoriesLoading(false);
      }
    };
    loadMemories();
    return () => {
      alive = false;
    };
  }, [selectedUser]);

  useEffect(() => {
    let alive = true;
    const loadWeight = async () => {
      if (!selectedUser) {
        if (alive) {
          setWeightEntries([]);
          setWeightInsight(null);
          setWeightInsightDate(null);
          setWeightError(null);
          setWeightLoading(false);
        }
        return;
      }
      setWeightLoading(true);
      setWeightError(null);
      try {
        const response = await fetch(
          `/api/users/weight?user_id=${encodeURIComponent(selectedUser)}`,
          { cache: "no-store" }
        );
        const payload = await response.json().catch(() => ({}));
        if (!alive) return;
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load weight data");
        }
        const entries = Array.isArray(payload?.entries)
          ? (payload.entries as WeightEntry[])
          : [];
        setWeightEntries(entries);
        setWeightInsight(
          typeof payload?.insight === "string" ? payload.insight : null
        );
        setWeightInsightDate(
          typeof payload?.generated_at === "string"
            ? payload.generated_at
            : null
        );
      } catch (err: any) {
        if (alive) {
          setWeightEntries([]);
          setWeightInsight(null);
          setWeightInsightDate(null);
          setWeightError(err?.message || "Failed to load weight data");
        }
      } finally {
        if (alive) setWeightLoading(false);
      }
    };
    loadWeight();
    return () => {
      alive = false;
    };
  }, [selectedUser]);

  // ---- filtered list ----
  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      const matchesQuery =
        !q ||
        (p.first_name ?? "").toLowerCase().includes(q) ||
        (p.last_name ?? "").toLowerCase().includes(q) ||
        (p.username ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q);
      if (!matchesQuery) return false;
      if (!lastSyncedFilter) return true;
      if (!p.last_synced) return false;
      try {
        const iso = new Date(p.last_synced).toISOString().slice(0, 10);
        return iso === lastSyncedFilter;
      } catch {
        return false;
      }
    });
  }, [profiles, query, lastSyncedFilter]);

  // ---- actions ----
  const inviteUser = async () => {
    if (!trainerId) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${base}/join?trainer_id=${encodeURIComponent(trainerId)}`;
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      setSnack({ open: true, message: 'Invite link copied', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: 'Failed to copy invite link', severity: 'error' });
    }
  };
  const saveUserNotes = async (text: string) => {
    // optional: store a trainer note into profile.text if exists
    // placeholder for future edits
    return text;
  };
  const voteOnMemory = async (memoryId: string, direction: "up" | "down") => {
    if (!session?.access_token) {
      setError("Not signed in");
      return;
    }
    setMemoryVotingKey(`${memoryId}:${direction}`);
    try {
      const response = await fetch("/api/users/memories", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ memory_id: memoryId, direction }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update memory");
      }
      const updated = payload?.memory as Memory | undefined;
      if (updated?.id) {
        setMemories((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
        );
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update memory");
    } finally {
      setMemoryVotingKey(null);
    }
  };
  const loadRoutineDetail = async (routineId: string) => {
    if (!routineId || !selectedUser) return;
    if (routineDetails[routineId]) return;
    setRoutineDetailLoading((prev) => ({ ...prev, [routineId]: true }));
    try {
      const response = await fetch(
        `/api/users/routines/${encodeURIComponent(
          routineId
        )}?user_id=${encodeURIComponent(selectedUser)}`,
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load routine details");
      }
      setRoutineDetails((prev) => ({
        ...prev,
        [routineId]: {
          routine: (payload?.routine as Routine) ?? null,
          exercises: Array.isArray(payload?.exercises)
            ? (payload.exercises as RoutineExercise[])
            : [],
          sets: Array.isArray(payload?.sets)
            ? (payload.sets as RoutineSet[])
            : [],
        },
      }));
    } catch (err: any) {
      setError(err?.message || "Failed to load routine details");
    } finally {
      setRoutineDetailLoading((prev) => {
        const next = { ...prev };
        delete next[routineId];
        return next;
      });
    }
  };

  const assignRoutineToUser = async () => {
    if (!routinePick || !selectedUser) return;
    setAssigning(true);
    try {
      let assignedDatePayload: string | undefined;
      if (assignmentDate) {
        try {
          assignedDatePayload = new Date(assignmentDate).toISOString();
        } catch {
          assignedDatePayload = undefined;
        }
      }
      const repeatPayload = (() => {
        switch (repeatChoice) {
          case 'daily':
            return { repeat_days: 1, repeat_weekly: null };
          case 'every-other':
            return { repeat_days: 2, repeat_weekly: null };
          case 'every-3':
            return { repeat_days: 3, repeat_weekly: null };
          case 'every-4':
            return { repeat_days: 4, repeat_weekly: null };
          case 'weekly':
            return { repeat_days: null, repeat_weekly: 1 };
          case 'biweekly':
            return { repeat_days: null, repeat_weekly: 2 };
          default:
            return { repeat_days: null, repeat_weekly: null };
        }
      })();
      const accessToken = session?.access_token ?? null;
      if (!accessToken) {
        throw new Error("Not signed in");
      }
      const response = await fetch("/api/users/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          target_user_id: selectedUser,
          trainer_routine_id: routinePick.id,
          assigned_date: assignedDatePayload,
          ...repeatPayload,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to assign routine");
      }

      const newRoutine = (payload?.routine as Routine) || null;
      if (!newRoutine) {
        throw new Error("Routine assignment returned no data");
      }

      setUserRoutines((prev) => {
        const next = [newRoutine, ...prev];
        setSummary(basicSummarize(next));
        return next;
      });
      try {
        setAssignmentDate(new Date().toISOString().slice(0, 10));
      } catch {
        setAssignmentDate("");
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setAssigning(false);
    }
  };
  const deleteAssignedRoutine = async (routineId: string) => {
    setDeletingId(routineId);
    try {
      if (!selectedUser) {
        throw new Error("No user selected");
      }

      const response = await fetch(
        `/api/users/routines/${encodeURIComponent(routineId)}?user_id=${encodeURIComponent(selectedUser)}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete routine");
      }

      setUserRoutines((prev) => {
        const next = prev.filter((r) => r.id !== routineId);
        setSummary(basicSummarize(next));
        return next;
      });
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!routinePick) {
      setRepeatChoice('none');
      return;
    }
    if (typeof routinePick.days === 'number' && routinePick.days > 0) {
      switch (routinePick.days) {
        case 1:
          setRepeatChoice('daily');
          return;
        case 2:
          setRepeatChoice('every-other');
          return;
        case 3:
          setRepeatChoice('every-3');
          return;
        case 4:
          setRepeatChoice('every-4');
          return;
        default:
          setRepeatChoice('none');
          return;
      }
    }
    if (typeof routinePick.weekly === 'number' && routinePick.weekly > 0) {
      switch (routinePick.weekly) {
        case 1:
          setRepeatChoice('weekly');
          return;
        case 2:
          setRepeatChoice('biweekly');
          return;
        default:
          setRepeatChoice('none');
          return;
      }
    }
    setRepeatChoice('none');
  }, [routinePick]);

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
                flexDirection: { xs: "column", lg: "row" },
                gap: { xs: 2, lg: 2.5 },
                width: "100%",
                maxWidth: 1200,
                margin: "0 auto",
                height: { xs: "auto", lg: "84vh" },
                overflow: { xs: "visible", lg: "hidden" },
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
                summaryLoading={summaryLoading}
                summaryWarning={summaryWarning}
                memories={memories as any}
                memoriesLoading={memoriesLoading}
                memoriesError={memoriesError}
                onVoteMemory={voteOnMemory}
                memoryVotingKey={memoryVotingKey}
                weightEntries={weightEntries as any}
                weightInsight={weightInsight}
                weightInsightDate={weightInsightDate}
                weightLoading={weightLoading}
                weightError={weightError}
                routineDetails={routineDetails as any}
                routineDetailLoading={routineDetailLoading}
                onLoadRoutineDetail={loadRoutineDetail}
                trainerRoutines={trainerRoutines as any}
                repeatChoice={repeatChoice}
                onChangeRepeatChoice={setRepeatChoice}
                onPickRoutine={(val) => setRoutinePick(val as any)}
                onAssignRoutine={assignRoutineToUser}
                assignmentDate={assignmentDate}
                onChangeAssignmentDate={setAssignmentDate}
                assigning={assigning}
                canAssign={Boolean(routinePick)}
                assignedRoutines={assignedRoutines as any}
                userRoutines={userRoutines as any}
                onDeleteAssignedRoutine={deleteAssignedRoutine}
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
        <Snackbar
          open={snack.open}
          autoHideDuration={2000}
          onClose={handleSnackClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert onClose={handleSnackClose} severity={snack.severity} sx={{ width: '100%' }}>
            {snack.message}
          </Alert>
        </Snackbar>
      </div>
  );
}
