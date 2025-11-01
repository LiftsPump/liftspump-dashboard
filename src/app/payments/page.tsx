'use client';
import { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import useDocumentTitle from "../../hooks/useDocumentTitle";

// MUI
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Avatar,
  Divider,
  Chip,
  Switch,
  FormControlLabel,
  InputAdornment,
  IconButton,
  Snackbar,
} from "@mui/material";
// Use global MUI theme from RootLayout
// Use browser crypto to generate an id if we need to create a trainer row
import { useSupabaseClient, useSession, useSessionContext } from "@supabase/auth-helpers-react";
import SettingsIcon from "@mui/icons-material/Settings";
import PaymentsIcon from "@mui/icons-material/Payments";
import SaveIcon from "@mui/icons-material/Save";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

// NOTE: Wire these to your real data layer
// If you already use Supabase & have a trainer row, you can
// replace these fetches with real calls.

type Tier = {
  key: string;
  name: string;
  price: number; // monthly
  active: boolean;
  stripePriceId?: string;
};

export default function PaymentsSettings() {
  useDocumentTitle("Payments | Liftspump");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [trainerPhoto, setTrainerPhoto] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [connectAccountId, setConnectAccountId] = useState<string>("");
  const [seeding, setSeeding] = useState(false);

  const supabase = useSupabaseClient();
  const session = useSession();
  const { isLoading: authLoading } = useSessionContext();

  const totalActive = useMemo(() => tiers.filter(t => t.active).length, [tiers]);

  const updateTier = (key: string, patch: Partial<Tier>) => {
    setTiers(prev => prev.map(t => (t.key === key ? { ...t, ...patch } : t)));
  };

  const removeTier = async (idx: number, key: string) => {
    // Update UI immediately
    setTiers(prev => prev.filter((_, i) => i !== idx))
    try {
      if (!trainerId) return;
      await fetch('/api/settings/tiers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainer_id: trainerId, key }),
      })
    } catch {}
  }

  // Load tiers from Supabase for this trainer
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (authLoading) return;
      const uid = session?.user?.id || null;
      if (!uid) return;
      const { data: tRow, error } = await supabase
        .from('trainer')
        .select('trainer_id, connect_account_id')
        .eq('creator_id', uid)
        .limit(1);
      const tId = (tRow?.[0]?.trainer_id as string) || null;
      if (alive) setTrainerId(tId);
      const acc = (tRow?.[0]?.connect_account_id as string) || "";
      if (alive) setConnectAccountId(acc);
      // Try to load optional display fields; ignore if columns not present
      try {
        const { data: extra, error: extraErr } = await supabase
          .from('trainer')
          .select('display_name,bio')
          .eq('creator_id', uid)
          .limit(1);
        if (!extraErr && extra && extra[0]) {
          setDisplayName((extra[0].display_name as string) || "");
          setBio((extra[0].bio as string) || "");
        }
      } catch {}
      if (!tId) return;
      const { data: tierRows } = await supabase
        .from('tiers')
        .select('key,name,price,active,stripe_price_id')
        .eq('trainer', tId)
        .order('price', { ascending: true });
      if (alive && Array.isArray(tierRows) && tierRows.length) {
        const mapped = tierRows.map((r: any) => ({
          key: r.key ?? 'tier',
          name: r.name ?? 'Tier',
          price: typeof r.price === 'number' ? (r.price > 999 ? Math.round(r.price) / 100 : r.price) : 0,
          active: r.active ?? true,
          stripePriceId: r.stripe_price_id ?? undefined,
        })) as Tier[];
        setTiers(mapped);
      }
    };
    load();
    return () => { alive = false };
  }, [session, authLoading, supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Ensure trainer row exists and persist connect account id
      const uid = session?.user?.id || null;
      if (!uid) throw new Error('Not signed in');
      if (!trainerId) {
        const genId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? (crypto as any).randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
        await supabase.from('trainer').insert({ creator_id: uid, trainer_id: genId });
        setTrainerId(genId);
      }
      if (trainerId) {
        // Persist connect account id and optional display fields (ignore errors if columns absent)
        try { await supabase.from('trainer').update({ connect_account_id: connectAccountId || null }).eq('trainer_id', trainerId); } catch {}
        try { await supabase.from('trainer').update({ display_name: displayName || null, bio: bio || null }).eq('trainer_id', trainerId); } catch {}
      }
      if (trainerId) {
        // Try Supabase first
        // Delete tiers removed locally
        try {
          const { data: existing } = await supabase
            .from('tiers')
            .select('key')
            .eq('trainer', trainerId)
          const existingKeys = new Set((existing ?? []).map((r: any) => String(r.key)))
          const newKeys = new Set(tiers.map(t => t.key))
          for (const key of existingKeys) {
            if (!newKeys.has(key)) {
              await supabase.from('tiers').delete().eq('trainer', trainerId).eq('key', key)
            }
          }
        } catch {}

        for (const t of tiers) {
          const cents = Math.round(Number(t.price) * 100);
          // Prefer upsert with composite conflict if available
          const { error } = await supabase
            .from('tiers')
            .upsert({ trainer: trainerId, key: t.key, name: t.name, price: cents, active: t.active }, { onConflict: 'trainer,key' });
          if (error) {
            // Fallback: select then update/insert
            const { data: exists } = await supabase
              .from('tiers')
              .select('id')
              .eq('trainer', trainerId)
              .eq('key', t.key)
              .limit(1);
            if (exists && exists[0]) {
              await supabase.from('tiers').update({ name: t.name, price: cents, active: t.active }).eq('id', exists[0].id);
            } else {
              await supabase.from('tiers').insert({ trainer: trainerId, key: t.key, name: t.name, price: cents, active: t.active });
            }
          }
        }
      } else {
        // Fallback to local API/json storage
        const res = await fetch("/api/settings/tiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tiers }),
        });
        if (!res.ok) throw new Error("Failed to save tiers");
      }
      setSnack("Settings saved");
    } catch (e) {
      setSnack("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const createTrainerIfMissing = async () => {
    const uid = session?.user?.id || null;
    if (!uid) { setSnack('Sign in first'); return; }
    if (trainerId) { setSnack('Trainer already exists'); return; }
    const genId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const { error } = await supabase.from('trainer').insert({ creator_id: uid, trainer_id: genId });
    if (!error) { setTrainerId(genId); setSnack('Trainer created'); }
  };

  const seedDefaultTiers = async () => {
    setSeeding(true);
    try {
      // Ensure trainer exists
      let tId = trainerId;
      const uid = session?.user?.id || null;
      if (!tId) {
        if (!uid) { setSnack('Sign in first'); return; }
        const newId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? (crypto as any).randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
        const { error: tErr } = await supabase.from('trainer').insert({ creator_id: uid, trainer_id: newId });
        if (tErr) { setSnack(`Error creating trainer: ${tErr.message}`); return; }
        tId = newId; setTrainerId(newId);
      }

      // Seed default tiers in cents
      const rows = [
        { trainer: tId, key: 'basic', name: 'Basic', price: 999, active: true },
        { trainer: tId, key: 'plus',  name: 'Plus',  price: 1999, active: true },
        { trainer: tId, key: 'pro',   name: 'Pro',   price: 3999, active: false },
      ];
      const { error: upErr } = await supabase.from('tiers').upsert(rows, { onConflict: 'trainer,key' });
      if (upErr) { setSnack(`Error seeding: ${upErr.message}`); return; }

      // Reload from DB to confirm
      const { data: tierRows, error: selErr } = await supabase
        .from('tiers')
        .select('key,name,price,active')
        .eq('trainer', tId)
        .order('price', { ascending: true });
      if (selErr) { setSnack(`Seeded, but reload failed: ${selErr.message}`); return; }
      const mapped = (tierRows ?? []).map((r: any) => ({
        key: r.key,
        name: r.name,
        price: typeof r.price === 'number' ? (r.price >= 100 ? r.price / 100 : r.price) : 0,
        active: !!r.active,
      })) as Tier[];
      setTiers(mapped);
      setSnack('Default tiers seeded');
    } finally {
      setSeeding(false);
    }
  };

  const handleStripePortal = async () => {
    // Open the trainer's Stripe Express dashboard or onboarding flow
    window.open("/api/stripe/portal?mode=express", "_blank", "noopener,noreferrer");
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      // Simple local preview; replace with real upload (e.g., Supabase Storage)
      const url = URL.createObjectURL(f);
      setTrainerPhoto(url);
      setSnack("Photo loaded (remember to wire real upload)");
      // Example real upload:
      // const { data, error } = await supabase.storage.from('avatars').upload(`trainer/${userId}.jpg`, f, { upsert: true });
      // const publicUrl = supabase.storage.from('avatars').getPublicUrl(data.path).data.publicUrl;
      // setTrainerPhoto(publicUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <Navigation/>
          <div className={styles.pageContent}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ flexWrap: "wrap", gap: { xs: 1, sm: 1.25 }, mb: 2 }}
          >
            <SettingsIcon />
            <Typography variant="h5" fontWeight={700}>Settings</Typography>
            <Chip label={`${totalActive} active tier${totalActive === 1 ? "" : "s"}`} size="small" />
            <Box sx={{ flex: { xs: "unset", sm: 1 } }} />
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
              <Button onClick={handleSave} startIcon={<SaveIcon />} disabled={saving} variant="outlined" size="small">
                {saving ? "Saving…" : "Save"}
              </Button>
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            {/* Left: Trainer Profile */}
            <Paper sx={{ p: 2, minWidth: 320, width: { md: 360 }, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Trainer profile</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} sx={{ mb: 2 }}>
                <Avatar src={trainerPhoto ?? undefined} sx={{ width: 72, height: 72 }} />
              </Stack>
              <Stack spacing={1} sx={{ mb: 2 }}>
                <TextField
                  label="Display name"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  size="small"
                />
                <TextField
                  label="Bio"
                  placeholder="A short description shown to users"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  size="small"
                  multiline
                  minRows={2}
                />
                <TextField
                  label="Trainer ID"
                  value={trainerId ?? ''}
                  size="small"
                  disabled
                />
                {!trainerId && (
                  <Button onClick={createTrainerIfMissing} variant="outlined" size="small">Create trainer</Button>
                )}
              </Stack>
            </Paper>

            {/* Right: Tiers & Pricing */}
            <Box flex={1}>
              <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", mb: 2 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1, gap: { xs: 1, sm: 0 } }}
                >
                  <Typography variant="h6" fontWeight={700}>Subscription tiers</Typography>
                </Stack>
                <Stack spacing={1.5}>
                  {tiers.map((t, idx) => (
                    <Paper key={t.key} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
                        <TextField
                          label="Tier name"
                          value={t.name}
                          onChange={(e) => updateTier(t.key, { name: e.target.value })}
                          size="small"
                          sx={{ maxWidth: 220 }}
                        />
                        <TextField
                          type="number"
                          label="Monthly price"
                          value={t.price}
                          onChange={(e) => updateTier(t.key, { price: Number(e.target.value) })}
                          size="small"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <AttachMoneyIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                          sx={{ maxWidth: 200 }}
                        />
                        {/* Stripe Price ID auto-generated server-side; no manual input needed */}
                        <FormControlLabel
                          control={<Switch checked={t.active} onChange={(e) => updateTier(t.key, { active: e.target.checked })} />}
                          label={t.active ? "Active" : "Inactive"}
                          sx={{ ml: { xs: 0, sm: 2 } }}
                        />
                        <Box sx={{ flex: { xs: "unset", sm: 1 } }} />
                        <Button color="error" variant="outlined" size="small" onClick={() => removeTier(idx, t.key)}>Remove</Button>
                      </Stack>
                    </Paper>
                  ))}
                  <Button variant="outlined" size="small" onClick={() => setTiers(prev => ([...prev, { key: `tier_${Date.now()}`, name: 'New Tier', price: 10, active: true }]))}>+ Add tier</Button>
                </Stack>
              </Paper>

              <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Balance & issues</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  To view your payments dashboard please click on Stripe Express.  On this page you can see your balance and withdraw money.  If you have any issues please email <a href="mailto:ahmed@liftspump.com">ahmed@liftspump.com</a>.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="outlined" onClick={handleStripePortal} startIcon={<PaymentsIcon />}>Open Stripe Express</Button>
                </Stack>
              </Paper>
            </Box>
          </Stack>
          </div>
        </main>
        <footer className={styles.footer}></footer>
        <Snackbar
          open={!!snack}
          autoHideDuration={3000}
          onClose={() => setSnack(null)}
          message={snack ?? ""}
        />
      </div>
  );
}
