"use client";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Avatar, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';

type Props = { open: boolean; onClose: () => void; onPhotoChanged?: (url: string) => void };
export default function SettingsDialog({ open, onClose, onPhotoChanged }: Props) {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const uid = session?.user?.id || null;
      if (!uid || !open) return;
      const { data } = await supabase
        .from('trainer')
        .select('trainer_id, photo_url')
        .eq('creator_id', uid)
        .limit(1);
      const tId = (data?.[0]?.trainer_id as string) || null;
      if (alive) setTrainerId(tId);
      if (alive) setPhotoUrl((data?.[0]?.photo_url as string) || null);
    };
    load();
    return () => { alive = false };
  }, [open, session?.user?.id, supabase]);

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !trainerId) return;
    setUploading(true);
    try {
      const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `trainer/${trainerId}/avatar_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('trainer-photos').upload(path, f, { upsert: true, cacheControl: '3600' });
      if (upErr) return;
      const { data: pub } = supabase.storage.from('trainer-photos').getPublicUrl(path);
      const url = pub?.publicUrl || null;
      if (url) {
        await supabase.from('trainer').update({ photo_url: url }).eq('trainer_id', trainerId);
        setPhotoUrl(url);
        onPhotoChanged?.(url);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Settings</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={photoUrl ?? undefined} sx={{ width: 64, height: 64 }} />
            <label>
              <input type="file" accept="image/*" hidden onChange={pickPhoto} />
              <Button component="span" variant="outlined" size="small" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload photo'}</Button>
            </label>
          </Stack>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>This photo appears in the header and customer flows.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

