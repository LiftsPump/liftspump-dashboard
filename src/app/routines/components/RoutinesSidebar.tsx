"use client";
import { Box, Paper, Stack, TextField, InputAdornment, List, ListItemButton, ListItemIcon, ListItemText, Avatar, Button, CircularProgress, Alert } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { Typography } from "@mui/material";

type Routine = any;

export default function RoutinesSidebar({
  query,
  onQueryChange,
  filtered,
  selectedId,
  onSelect,
  addTrainerRoutine,
  loading,
  error,
  saving,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  filtered: Routine[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  addTrainerRoutine: () => void;
  loading: boolean;
  error: string | null;
  saving: boolean;
}) {
  return (
    <Paper
      elevation={1}
      sx={{
        width: { xs: "100%", lg: 360 },
        minWidth: { xs: "auto", lg: 320 },
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      <Box
        sx={{
          p: 1.5,
          borderBottom: "2px solid",
          borderColor: "primary.main",
          position: "sticky",
          top: 0,
          bgcolor: "background.paper",
          zIndex: 1,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <TextField
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search routines…"
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Button size="small" startIcon={<AddIcon />} onClick={addTrainerRoutine} disabled={saving} variant="outlined">New</Button>
        </Stack>
      </Box>
      <Box sx={{ overflowY: "auto", maxHeight: { xs: "none", lg: "80vh" } }}>
        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
            <CircularProgress size={20} />
            <span>Loading…</span>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        {!loading && !error && (
          <List>
            {filtered.map((r) => (
              <ListItemButton key={r.id} selected={selectedId === r.id} onClick={() => onSelect(r.id)} sx={{ alignItems: "flex-start", py: 1.25 }}>
                <ListItemIcon sx={{ minWidth: 44 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>{(r.name ?? "?").slice(0, 2).toUpperCase()}</Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="subtitle1" noWrap>{r.name || "Untitled"}</Typography>}
                  secondary={<Typography variant="body2" color="text.secondary">{r.type} · {r.date ? new Date(r.date).toLocaleDateString() : "n/a"}</Typography>}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );
}
