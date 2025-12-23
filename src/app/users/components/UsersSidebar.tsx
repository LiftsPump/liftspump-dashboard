"use client";
import { Paper, Box, Stack, TextField, InputAdornment, Button, CircularProgress, Alert, ListItemButton, ListItemIcon, Avatar, ListItemText, Typography, Chip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import TodayIcon from "@mui/icons-material/Today";

export default function UsersSidebar({
  query,
  onQueryChange,
  loading,
  authLoading,
  error,
  filteredProfiles,
  selectedUser,
  onSelectUser,
  trainerId,
  inviteUser,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  loading: boolean;
  authLoading: boolean;
  error: string | null;
  filteredProfiles: any[];
  selectedUser: string | null;
  onSelectUser: (id: string) => void;
  trainerId: string | null;
  inviteUser: () => void;
}) {
  return (
    <Paper
      elevation={1}
      sx={{
        width: { xs: "100%", lg: 360 },
        minWidth: { xs: "auto", lg: 320 },
        display: "flex",
        flexDirection: "column",
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
            placeholder="Search users…"
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
          <Button onClick={inviteUser} size="small" startIcon={<PersonAddAlt1Icon />} disabled={!trainerId}>
            Invite
          </Button>
        </Stack>
      </Box>
      <Box sx={{ overflowY: "auto", maxHeight: { xs: "none", lg: "80vh" } }}>
        {loading && !authLoading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
            <CircularProgress size={20} />
            <span>Loading users…</span>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        {!loading && !error && filteredProfiles.map((p) => {
          const initials = (p.username?.slice(0, 2) || p.email?.slice(0, 2) || "?").toUpperCase();
          const subtitle = [p.username, p.email].filter(Boolean).join(" · ");
          return (
            <ListItemButton key={p.creator_id} selected={selectedUser === p.creator_id} onClick={() => onSelectUser(p.creator_id)} sx={{ alignItems: "flex-start", py: 1.25 }}>
              <ListItemIcon sx={{ minWidth: 44 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>{initials}</Avatar>
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="subtitle1" noWrap>{[p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || p.email || "User"}</Typography>}
                secondary={
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                    {subtitle ? <Typography variant="body2" color="text.secondary" noWrap>{subtitle}</Typography> : null}
                    {p.last_synced ? (
                      <Chip size="small" icon={<TodayIcon />} label={`Last logged in: ${new Date(p.last_synced).toLocaleDateString()}`} variant="outlined" color="primary" sx={{ borderColor: 'divider' }} />
                    ) : null}
                  </Stack>
                }
              />
            </ListItemButton>
          );
        })}
      </Box>
    </Paper>
  );
}
