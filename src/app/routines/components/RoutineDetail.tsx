"use client";
import { Box, Stack, Typography, Paper, TextField, InputAdornment, Button, IconButton, Autocomplete, Checkbox, Chip } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

type Routine = any;
type Exercise = any;
type SetRow = any;
type CatalogExercise = any;

export default function RoutineDetail({
  selected,
  onRename,
  exercises,
  onChangeExercise,
  onAddExercise,
  onAddFromCatalog,
  onSaveExercise,
  onDeleteExercise,
  setsByExercise,
  onAddSet,
  onChangeSet,
  onSaveSet,
  onDeleteSet,
  catalogOptions,
  saving,
}: {
  selected: Routine | null;
  onRename: (name: string) => void;
  exercises: Exercise[];
  onChangeExercise: (id: string, patch: Partial<Exercise>) => void;
  onAddExercise: () => void;
  onAddFromCatalog: (item: CatalogExercise) => void;
  onSaveExercise: (ex: Exercise) => void;
  onDeleteExercise: (id: string) => void;
  setsByExercise: Record<string, SetRow[]>;
  onAddSet: (exerciseId: string) => void;
  onChangeSet: (exerciseId: string, setId: string, patch: Partial<SetRow>) => void;
  onSaveSet: (sr: SetRow) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
  catalogOptions: CatalogExercise[];
  saving: boolean;
}) {
  if (!selected) return null;
  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          value={selected.name ?? ""}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Routine name"
          size="small"
          sx={{ minWidth: 280 }}
        />
        <IconButton onClick={() => onSaveExercise({ id: "__name__" }) as any} disabled={saving} aria-label="Save routine name">
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
            getOptionLabel={(o: any) => o.name}
            onChange={(e, val) => { if (val) onAddFromCatalog(val as any); }}
            renderInput={(params) => (
              <TextField {...params} placeholder="Add from catalog…" />
            )}
            disabled={saving || !selected.id}
          />
          <Button size="small" startIcon={<AddIcon />} onClick={onAddExercise} disabled={saving} color="primary" variant="outlined" sx={{ borderColor: "divider" }}>Add custom</Button>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        {exercises.map((ex) => (
          <Paper key={ex.id} sx={{ p: 1.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1}>
                <TextField
                  value={ex.name ?? ""}
                  onChange={(e) => onChangeExercise(ex.id, { name: e.target.value })}
                  placeholder="Exercise name"
                  size="small"
                />
                <IconButton onClick={() => onSaveExercise(ex)} disabled={saving} aria-label="Save exercise">
                  <SaveIcon />
                </IconButton>
                <IconButton onClick={() => onDeleteExercise(ex.id)} disabled={saving} aria-label="Delete exercise">
                  <DeleteIcon />
                </IconButton>
              </Stack>
              <TextField
                value={ex.text ?? ""}
                onChange={(e) => onChangeExercise(ex.id, { text: e.target.value })}
                placeholder="Notes"
                size="small"
                multiline
                minRows={2}
              />

              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography variant="subtitle2">Sets</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => onAddSet(ex.id)} disabled={saving} color="primary" variant="outlined" sx={{ borderColor: "divider" }}>Add set</Button>
              </Stack>

              <Stack spacing={1}>
                {(setsByExercise[ex.id] ?? []).map((sr) => (
                  <Stack key={sr.id} direction="row" spacing={1} alignItems="center">
                    <TextField
                      type="number"
                      size="small"
                      label="Reps"
                      value={sr.reps ?? 0}
                      onChange={(e) => onChangeSet(ex.id, sr.id, { reps: Number(e.target.value) })}
                    />
                    <TextField
                      type="number"
                      size="small"
                      label="Weight"
                      value={sr.weight ?? 0}
                      onChange={(e) => onChangeSet(ex.id, sr.id, { weight: Number(e.target.value) })}
                    />
                    {/* Removed PR and Done local-only flags for cleaner UX */}
                    <IconButton onClick={() => onSaveSet(sr)} disabled={saving}>
                      <SaveIcon />
                    </IconButton>
                    <IconButton onClick={() => onDeleteSet(ex.id, sr.id)} disabled={saving} aria-label="Delete set">
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
  );
}
