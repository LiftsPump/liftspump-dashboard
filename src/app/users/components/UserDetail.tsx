"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Box,
  Stack,
  Typography,
  Chip,
  Divider,
  TextField,
  Autocomplete,
  Button,
  MenuItem,
  LinearProgress,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
} from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import TimelineIcon from "@mui/icons-material/Timeline";
import ReactECharts from "echarts-for-react";

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

type WeightSeriesPoint = {
  id: string;
  date: Date;
  label: string;
  weightKg: number | null;
  weightLb: number | null;
  bfPercent: number | null;
  source: string | null;
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
  routine: any;
  exercises: RoutineExercise[];
  sets: RoutineSet[];
};

export default function UserDetail({
  selectedProfile,
  summary,
  summaryLoading,
  summaryWarning,
  memories,
  memoriesLoading,
  memoriesError,
  onVoteMemory,
  memoryVotingKey,
  weightEntries,
  weightInsight,
  weightInsightDate,
  weightLoading,
  weightError,
  routineDetails,
  routineDetailLoading,
  onLoadRoutineDetail,
  trainerRoutines,
  repeatChoice,
  onChangeRepeatChoice,
  onPickRoutine,
  onAssignRoutine,
  assignmentDate,
  onChangeAssignmentDate,
  assigning,
  canAssign,
  assignedRoutines,
  userRoutines,
  onKick,
  onDeleteAssignedRoutine,
}: {
  selectedProfile: any;
  summary: string;
  summaryLoading: boolean;
  summaryWarning: string | null;
  memories: Memory[];
  memoriesLoading: boolean;
  memoriesError: string | null;
  onVoteMemory: (id: string, direction: "up" | "down") => void;
  memoryVotingKey: string | null;
  weightEntries: WeightEntry[];
  weightInsight: string | null;
  weightInsightDate: string | null;
  weightLoading: boolean;
  weightError: string | null;
  routineDetails: Record<string, RoutineDetailSnapshot>;
  routineDetailLoading: Record<string, boolean>;
  onLoadRoutineDetail?: (routineId: string) => void;
  trainerRoutines: any[];
  repeatChoice: string;
  onChangeRepeatChoice: (value: string) => void;
  onPickRoutine: (r: any | null) => void;
  onAssignRoutine: () => void;
  assignmentDate: string;
  onChangeAssignmentDate: (value: string) => void;
  assigning: boolean;
  canAssign: boolean;
  assignedRoutines: any[];
  userRoutines: any[];
  onKick?: () => void;
  onDeleteAssignedRoutine: (id: string) => void;
}) {
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"insights" | "training" | "history">("insights");
  useEffect(() => {
    setExpandedRoutineId(null);
    setActiveTab("insights");
  }, [selectedProfile?.creator_id]);
  const weightSeries = useMemo<WeightSeriesPoint[]>(() => {
    return (weightEntries ?? [])
      .map((entry) => {
        const date = new Date(entry.created_at);
        if (Number.isNaN(date.valueOf())) return null;
        const weightKg =
          typeof entry.weight_kg === "number" ? entry.weight_kg : null;
        const weightLb =
          weightKg != null ? Math.round(weightKg * 2.20462 * 10) / 10 : null;
        return {
          id: entry.id,
          date,
          label: date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          weightKg,
          weightLb,
          bfPercent:
            typeof entry.bf_percent === "number" ? entry.bf_percent : null,
          source: entry.source ?? null,
        } as WeightSeriesPoint;
      })
      .filter((point): point is WeightSeriesPoint => Boolean(point))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [weightEntries]);
  const latestWeight = weightSeries.length
    ? weightSeries[weightSeries.length - 1].weightLb
    : null;
  const latestWeightDate = weightSeries.length
    ? weightSeries[weightSeries.length - 1].date
    : null;
  const earliestWeight = weightSeries.length ? weightSeries[0].weightLb : null;
  const weightDelta =
    latestWeight != null && earliestWeight != null
      ? latestWeight - earliestWeight
      : null;
  const latestBf = (() => {
    for (let i = weightSeries.length - 1; i >= 0; i -= 1) {
      if (typeof weightSeries[i].bfPercent === "number") {
        return weightSeries[i].bfPercent;
      }
    }
    return null;
  })();
  const weightChartOption = useMemo(() => {
    const pts = weightSeries
      .filter((p) => typeof p.weightLb === "number")
      .map((p) => ({ label: p.label, value: p.weightLb as number }));
    return {
      backgroundColor: "transparent",
      grid: { left: 44, right: 12, top: 10, bottom: 24 },
      xAxis: {
        type: "category",
        data: pts.map((p) => p.label),
        axisLine: { lineStyle: { color: "#666" } },
        axisLabel: { color: "#8a8f98" },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisLabel: { color: "#8a8f98" },
        splitLine: { lineStyle: { color: "rgba(138,143,152,0.2)" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#111416",
        borderColor: "#1f2428",
        textStyle: { color: "#fff" },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const label = Array.isArray(params) ? p.axisValueLabel : p?.name;
          const raw = Array.isArray(params) ? p.data : (p?.data ?? p?.value);
          const num = typeof raw === 'number' ? raw : Number(raw);
          const valueText = Number.isFinite(num) ? `${num.toFixed(1)} lb` : '--';
          return `${label}<br/>${valueText}`;
        },
      },
      series: [
        {
          type: "line",
          smooth: true,
          showSymbol: false,
          data: pts.map((p) => p.value),
          lineStyle: { width: 3, color: "#1AE07F" },
          areaStyle: {
            opacity: 0.5,
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(26,224,127,0.35)" },
                { offset: 1, color: "rgba(26,224,127,0.00)" },
              ],
            },
          },
        },
      ],
    };
  }, [weightSeries]);

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
    const m = durations.reduce((a, b) => a + b, 0) / 60 / durations.length;
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
  const repeatOptions = [
    { value: 'none', label: 'No repeat' },
    { value: 'daily', label: 'Every day' },
    { value: 'every-other', label: 'Every other day' },
    { value: 'every-3', label: 'Every 3 days' },
    { value: 'every-4', label: 'Every 4 days' },
    { value: 'weekly', label: 'Once a week' },
    { value: 'biweekly', label: 'Every 2 weeks' },
  ];
  const tabOptions = [
    { value: "insights", label: "Insights" },
    { value: "training", label: "Training" },
    { value: "history", label: "History" },
  ] as const;
  const repeatSummary = (routine: any): string | null => {
    if (routine?.days && routine.days > 0) {
      switch (routine.days) {
        case 1:
          return 'Repeats daily';
        case 2:
          return 'Repeats every other day';
        case 3:
          return 'Repeats every 3 days';
        case 4:
          return 'Repeats every 4 days';
        default:
          return `Repeats every ${routine.days} days`;
      }
    }
    if (routine?.weekly && routine.weekly > 0) {
      if (routine.weekly === 1) return 'Repeats weekly';
      if (routine.weekly === 2) return 'Repeats every 2 weeks';
      return `Repeats every ${routine.weekly} weeks`;
    }
    return null;
  };
  return (
    <Paper
      elevation={1}
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper",
        color: "text.primary",
        width: "100%",
      }}
    >
      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ mb: 0.5, gap: { xs: 0.5, sm: 1 } }}
        >
          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>
            {selectedProfile.first_name || selectedProfile.last_name ? `${selectedProfile.first_name ?? ''} ${selectedProfile.last_name ?? ''}` : (selectedProfile.username || selectedProfile.email || 'User')}
          </Typography>
          <Box sx={{ flex: { xs: "unset", sm: 1 } }} />
          {onKick && (
            <Button size="small" color="error" variant="outlined" onClick={onKick}>Kick</Button>
          )}
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ mb: 1, flexWrap: "wrap" }}
        >
          {bmi != null && (
            <Chip size="small" label={`BMI ${bmi}${bmiCat ? ` · ${bmiCat}` : ''}`} variant="outlined" />
          )}
          <Chip size="small" label={`Consistency ${spw}/wk · ${consLbl}`} variant="outlined" />
          <Chip size="small" icon={<AccessTimeIcon />} label={`Endurance ${avgMins}m · ${strengthLbl}`} variant="outlined" />
        </Stack>

        <Tabs
          value={activeTab}
          onChange={(_, value) =>
            setActiveTab(value as "insights" | "training" | "history")
          }
          textColor="primary"
          indicatorColor="primary"
          variant="fullWidth"
          sx={{ mt: 1 }}
        >
          {tabOptions.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {activeTab === "insights" && (
            <Stack spacing={2}>
              <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Typography variant="h6" color="text.primary" sx={{ mb: 0.5, fontWeight: 700 }}>AI summary</Typography>
                <Typography
                  variant="body1"
                  sx={{ whiteSpace: "pre-wrap", opacity: summaryLoading ? 0.7 : 1 }}
                >
                  {summaryLoading ? "Loading AI insight…" : (summary || "No data yet.")}
                </Typography>
                {summaryWarning ? (
                  <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
                    {summaryWarning}
                  </Typography>
                ) : null}
              </Paper>

              <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Memories to review</Typography>
                  <Chip label={`${memories.length}`} size="small" />
                </Stack>
                {memoriesError ? (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    {memoriesError}
                  </Typography>
                ) : null}
                {memoriesLoading && (
                  <LinearProgress sx={{ mt: 1 }} />
                )}
                <Stack spacing={1.25} sx={{ mt: 1 }}>
                  {memories.length === 0 && !memoriesLoading ? (
                    <Typography variant="body2" color="text.secondary">
                      No AI memories yet for this member.
                    </Typography>
                  ) : null}
                  {memories.map((memory) => {
                    const confidence = Math.round(Math.max(0, Math.min(1, Number(memory.confidence ?? 0))) * 100);
                    const created = memory.created_at
                      ? new Date(memory.created_at).toLocaleString()
                      : "unknown";
                    const upKey = `${memory.id}:up`;
                    const downKey = `${memory.id}:down`;
                    const voting = memoryVotingKey === upKey || memoryVotingKey === downKey;
                    return (
                      <Paper key={memory.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">
                          <Stack spacing={0.25}>
                            <Typography variant="subtitle2" sx={{ textTransform: "capitalize" }}>
                              {memory.type || "Memory"}
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                              {memory.text || "No description provided."}
                            </Typography>
                          </Stack>
                          <Chip size="small" label={`Confidence ${confidence}%`} />
                        </Stack>
                        <LinearProgress value={confidence} variant="determinate" sx={{ mt: 1, borderRadius: 999 }} />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {created}
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Approve memory">
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => onVoteMemory(memory.id, "up")}
                                  disabled={voting}
                                >
                                  <ThumbUpAltOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Dismiss memory">
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => onVoteMemory(memory.id, "down")}
                                  disabled={voting}
                                >
                                  <ThumbDownAltOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Paper>

              <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TimelineIcon fontSize="small" />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Weight tracking</Typography>
                  </Stack>
                  <Chip size="small" label="Last 30 days" />
                </Stack>
                {weightError ? (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    {weightError}
                  </Typography>
                ) : null}
                {weightLoading && <LinearProgress sx={{ mt: 1 }} />}
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  <Stack direction={{ xs: "column", sm: "row" }}  spacing={1.5} alignItems={{ xs: "flex-start", sm: "flex-start" }} justifyContent="space-between">
                    <Box>
                      <Typography variant="h4">
                        {latestWeight != null ? `${latestWeight.toFixed(1)} lb` : "--"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {weightDelta != null
                          ? `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} lb over 30 days`
                          : "Need more check-ins to see trend"}
                      </Typography>
                      {latestBf != null && (
                        <Typography variant="body2" color="text.secondary">
                          Body fat {latestBf.toFixed(1)}%
                        </Typography>
                      )}
                      {latestWeightDate && (
                        <Typography variant="caption" color="text.secondary">
                          Updated {latestWeightDate.toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 200, width: "100%" }}>
                      {weightSeries.filter(p => typeof p.weightLb === "number").length >= 2 ? (
                        <ReactECharts option={weightChartOption} style={{ height: 200, width: "100%" }} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Log at least two weights to see a chart.
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  {weightInsight ? (
                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "background.default" }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>AI weight insight</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {weightInsight}
                      </Typography>
                      {weightInsightDate ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          Updated {new Date(weightInsightDate).toLocaleString()}
                        </Typography>
                      ) : null}
                    </Paper>
                  ) : null}
                  <Stack spacing={0.5}>
                    {weightSeries.slice(-4).reverse().map((entry) => (
                      <Stack
                        key={entry.id}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 0.75 }}
                      >
                        <Typography variant="body2">{entry.label}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" label={entry.weightLb != null ? `${entry.weightLb.toFixed(1)} lb` : "--"} />
                          {entry.bfPercent != null && (
                            <Chip size="small" label={`${entry.bfPercent.toFixed(1)}% bf`} variant="outlined" />
                          )}
                        </Stack>
                      </Stack>
                    ))}
                    {!weightSeries.length && !weightLoading && (
                      <Typography variant="body2" color="text.secondary">
                        No weight entries in the past month.
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            </Stack>
          )}

          {activeTab === "training" && (
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
                sx={{ gap: { xs: 0.75, sm: 1 } }}
              >
                <FitnessCenterIcon fontSize="small" />
                <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>
                  Assign a trainer routine
                </Typography>
              </Stack>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                alignItems={{ xs: "stretch", md: "center" }}
                justifyContent="space-around"
                sx={{ gap: { xs: 1, md: 1 } }}
              >
                <Autocomplete
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 200 } }}
                  options={trainerRoutines}
                  getOptionLabel={(o) => o.name ?? "Untitled"}
                  onChange={(e, val) => onPickRoutine(val)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Pick one of your trainer routines…" />
                  )}
                  disabled={assigning || !trainerRoutines.length}
                />
                <TextField
                  label="Start date"
                  type="date"
                  size="small"
                  value={assignmentDate}
                  onChange={(event) => onChangeAssignmentDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: { xs: "100%", md: 50 } }}
                  disabled={assigning}
                />
                <TextField
                  select
                  size="small"
                  label="Repeat"
                  value={repeatChoice}
                  onChange={(event) => onChangeRepeatChoice(event.target.value)}
                  sx={{ minWidth: { xs: "100%", md: 50 } }}
                  disabled={assigning}
                >
                  {repeatOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Button onClick={onAssignRoutine} disabled={assigning || !canAssign}>Assign</Button>
              </Stack>

              <Divider />

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>Assigned routines</Typography>
                <Chip size="small" label={`${assignedRoutines.length}`} />
              </Stack>
              <Stack spacing={1}>
                {assignedRoutines.length ? assignedRoutines.slice(0, 10).map((r) => (
                  <Paper key={r.id} sx={{ p: 1.25, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="body1">{r.name || "Untitled"}</Typography>
                        <Typography variant="body1">
                          Assigned · {r.date ? new Date(r.date).toLocaleString() : "n/a"}
                          {repeatSummary(r) ? ` · ${repeatSummary(r)}` : ''}
                        </Typography>
                      </Box>
                      {onDeleteAssignedRoutine && (
                        <Button onClick={() => onDeleteAssignedRoutine(r.id)}>
                          <DeleteIcon color="error"/>
                        </Button>
                      )}
                      {r.duration != null ? (
                        <Chip size="small" label={`${r.duration}m`} />
                      ) : null}
                    </Stack>
                  </Paper>
                )) : (
                  <Typography variant="body2">No assigned routines yet.</Typography>
                )}
              </Stack>
            </Stack>
          )}

          {activeTab === "history" && (
            <Stack spacing={2}>
              <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700 }}>
                Routine history
              </Typography>
              <Stack spacing={1}>
                {userRoutines.length ? (
                  userRoutines.slice(0, 10).map((r) => {
            const expanded = expandedRoutineId === r.id;
            const detail = routineDetails?.[r.id];
            const detailLoading = Boolean(routineDetailLoading?.[r.id]);
            return (
              <Accordion
                key={r.id}
                expanded={expanded}
                onChange={(_, isExpanded) => {
                  setExpandedRoutineId(isExpanded ? r.id : null);
                  if (isExpanded) {
                    onLoadRoutineDetail?.(r.id);
                  }
                }}
                disableGutters
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  "&::before": { display: "none" },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack sx={{ width: "100%" }} spacing={0.25}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              justifyContent="space-between"
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {r.name || "Untitled"}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        {r.duration != null ? (
                          <Chip size="small" label={`${Math.round(r.duration / 60)} min`} />
                        ) : null}
                        {repeatSummary(r) ? (
                          <Chip size="small" variant="outlined" label={repeatSummary(r)} />
                        ) : null}
                      </Stack>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {(r.type || "session")} · {r.date ? new Date(r.date).toLocaleString() : "n/a"}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ bgcolor: "background.default" }}>
                          {detailLoading && !detail ? <LinearProgress /> : null}
                  {detail ? (
                    detail.exercises.length ? (
                      (() => {
                                const setsByExercise = (detail.sets ?? []).reduce<
                                  Record<string, RoutineSet[]>
                                >((acc, set) => {
                          if (!set.exercise_id) return acc;
                          if (!acc[set.exercise_id]) acc[set.exercise_id] = [];
                          acc[set.exercise_id].push(set);
                          return acc;
                        }, {});
                        return detail.exercises.map((exercise) => {
                          const setsForExercise = setsByExercise[exercise.id] ?? [];
                        return (
                          <Paper
                            key={exercise.id}
                            variant="outlined"
                            sx={{ p: 1.25, mb: 1, borderColor: "divider" }}
                          >
                            <Stack spacing={0.5}>
                                        <Stack
                                          direction="row"
                                          spacing={1}
                                          alignItems="center"
                                          justifyContent="space-between"
                                        >
                                <Typography variant="subtitle2">
                                  {exercise.name || "Exercise"}
                                </Typography>
                                {exercise.eCode ? (
                                  <Chip size="small" variant="outlined" label={exercise.eCode} />
                                ) : null}
                              </Stack>
                              {exercise.text ? (
                                <Typography variant="body2" color="text.secondary">
                                  {exercise.text}
                                </Typography>
                              ) : null}
                              {setsForExercise.length ? (
                                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                  {setsForExercise.map((set, idx) => (
                                    <Chip
                                      key={`${set.id}-${idx}`}
                                      size="small"
                                      color={set.pr ? "success" : set.completed ? "primary" : "default"}
                                      variant={set.pr ? "filled" : "outlined"}
                                                label={`Set ${idx + 1}: ${set.reps ?? "?"} reps${
                                                  set.weight != null ? ` @ ${set.weight}` : ""
                                                }`}
                                    />
                                  ))}
                                </Stack>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No sets logged for this exercise.
                                </Typography>
                              )}
                            </Stack>
                          </Paper>
                        );
                        });
                      })()
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No exercises captured for this routine.
                      </Typography>
                    )
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Expand to load exercises and sets for this session.
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            );
                  })
                ) : (
            <Typography variant="body2">No routines yet.</Typography>
          )}
        </Stack>
      </Stack>
          )}
        </Box>
    </Box>
  </Paper>
  );
}
