"use client";
import { Paper, Box, Stack, Typography, Chip, Divider, TextField, Autocomplete, Button } from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

export default function UserDetail({
  selectedProfile,
  summary,
  trainerRoutines,
  onPickRoutine,
  onAssignRoutine,
  assigning,
  assignedRoutines,
  userRoutines,
  onKick,
}: {
  selectedProfile: any;
  summary: string;
  trainerRoutines: any[];
  onPickRoutine: (r: any | null) => void;
  onAssignRoutine: () => void;
  assigning: boolean;
  assignedRoutines: any[];
  userRoutines: any[];
  onKick?: () => void;
}) {
  if (!selectedProfile) return null;
  // ---- quick metrics for chips ----
  const computeBMI = (heightIn: number | null, weightLb: number | null): number | null => {
    if (heightIn == null || weightLb == null) return null;
    if (heightIn <= 0) return null;
    const hMeters = heightIn * 0.0254;
    const wKg = weightLb * 0.45359237;
    const bmi = wKg / (hMeters * hMeters);
    return Math.round(bmi * 10) / 10;
  };
  const bmiCategory = (bmi: number | null): string | null => {
    if (bmi == null) return null;
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Normal";
    if (bmi < 30) return "Overweight";
    return "Obese";
  };
  const avgSessionsPerWeek = (routines: any[], weeks: number = 8): number => {
    if (!routines?.length || weeks <= 0) return 0;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - weeks * 7);
    const recent = routines.filter((r) => r?.date && (String(r.type ?? '').toLowerCase() === 'date') && new Date(r.date) >= start);
    if (!recent.length) return 0;
    const byWeek = new Map<string, number>();
    for (const r of recent) {
      const d = new Date(r.date as string);
      const key = (() => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
        return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
      })();
      byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
    }
    const weeksConsidered = Math.max(1, Math.min(weeks, byWeek.size || weeks));
    const total = Array.from(byWeek.values()).reduce((a, b) => a + b, 0);
    return Math.round((total / weeksConsidered) * 10) / 10;
  };
  const consistencyLabel = (spw: number): string => {
    if (spw >= 3) return 'Excellent';
    if (spw >= 2) return 'High';
    if (spw >= 1) return 'Moderate';
    if (spw > 0) return 'Low';
    return 'Inactive';
  };
  const avgDuration = (routines: any[], n: number = 10): number => {
    const durations = (routines ?? [])
      .filter((r) => typeof r?.duration === 'number' && r?.duration != null)
      .slice(0, n)
      .map((r) => r.duration as number);
    if (!durations.length) return 0;
    const m = durations.reduce((a, b) => a + b, 0) / durations.length;
    return Math.round(m);
  };
  const strengthLabel = (avgMins: number): string => {
    if (avgMins >= 60) return 'Advanced';
    if (avgMins >= 40) return 'Intermediate';
    if (avgMins > 0) return 'Beginner';
    return 'No Data';
  };

  const bmi = computeBMI(selectedProfile.height ?? null, selectedProfile.weight ?? null);
  const bmiCat = bmiCategory(bmi);
  const spw = avgSessionsPerWeek(userRoutines, 8);
  const consLbl = consistencyLabel(spw);
  const avgMins = avgDuration(userRoutines, 10);
  const strengthLbl = strengthLabel(avgMins);
  return (
    <Paper elevation={1} sx={{ flex: 1, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper", color: "text.primary" }}>
      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>
            {selectedProfile.first_name || selectedProfile.last_name ? `${selectedProfile.first_name ?? ''} ${selectedProfile.last_name ?? ''}` : (selectedProfile.username || selectedProfile.email || 'User')}
          </Typography>
          <Box flex={1} />
          {onKick && (
            <Button size="small" color="error" variant="outlined" onClick={onKick}>Kick</Button>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          {bmi != null && (
            <Chip size="small" label={`BMI ${bmi}${bmiCat ? ` · ${bmiCat}` : ''}`} variant="outlined" />
          )}
          <Chip size="small" label={`Consistency ${spw}/wk · ${consLbl}`} variant="outlined" />
          <Chip size="small" icon={<AccessTimeIcon />} label={`Endurance ${avgMins}m · ${strengthLbl}`} variant="outlined" />
        </Stack>

        <Paper sx={{ p: 2, mb: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Typography variant="h6" color="text.primary" sx={{ mb: 0.5, fontWeight: 700 }}>AI summary</Typography>
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{summary || "No data yet."}</Typography>
        </Paper>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <FitnessCenterIcon fontSize="small" />
          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>Assign a trainer routine</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Autocomplete
            size="small"
            sx={{ minWidth: 320 }}
            options={trainerRoutines}
            getOptionLabel={(o) => o.name ?? "Untitled"}
            onChange={(e, val) => onPickRoutine(val)}
            renderInput={(params) => (
              <TextField {...params} placeholder="Pick one of your trainer routines…" />
            )}
            disabled={assigning || !trainerRoutines.length}
          />
          <Button onClick={onAssignRoutine} disabled={assigning} variant="contained">Assign</Button>
        </Stack>

        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>Assigned routines</Typography>
          <Chip size="small" label={`${assignedRoutines.length}`} />
        </Stack>
        <Stack spacing={1} sx={{ mb: 2 }}>
          {assignedRoutines.length ? assignedRoutines.slice(0, 10).map((r) => (
            <Paper key={r.id} sx={{ p: 1.25, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body1">{r.name || "Untitled"}</Typography>
                  <Typography variant="body1">Assigned · {r.date ? new Date(r.date).toLocaleString() : "n/a"}{r.weekly ? ` · ${r.weekly}/wk` : ""}{r.days ? ` · ${r.days} day plan` : ""}</Typography>
                </Box>
                {r.duration != null ? (
                  <Chip size="small" label={`${r.duration}m`} />
                ) : null}
              </Stack>
            </Paper>
          )) : (
            <Typography variant="body2">No assigned routines yet.</Typography>
          )}
        </Stack>

        <Divider sx={{ my: 1.5 }} />
        <Typography variant="h6" color="text.primary" sx={{ mb: 1, fontWeight: 700 }}>Recent routines</Typography>
        <Stack spacing={1}>
          {userRoutines.slice(0, 10).map((r) => (
            <Paper key={r.id} sx={{ p: 1.25, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body1">{r.name || "Untitled"}</Typography>
                  <Typography variant="body1">{r.type} · {r.date ? new Date(r.date).toLocaleString() : "n/a"}</Typography>
                </Box>
                {r.duration != null ? (
                  <Chip size="small" label={`${r.duration}`} />
                ) : null}
              </Stack>
            </Paper>
          ))}
          {!userRoutines.length && (
            <Typography variant="body2">No routines yet.</Typography>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}
