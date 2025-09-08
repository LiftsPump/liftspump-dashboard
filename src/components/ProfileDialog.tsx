"use client";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';

type Props = { open: boolean; onClose: () => void };
export default function ProfileDialog({ open, onClose }: Props) {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [height, setHeight] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const uid = session?.user?.id || null;
      if (!uid || !open) return;
      const { data } = await supabase
        .from('profile')
        .select('first_name,last_name,username,email,height,weight')
        .eq('creator_id', uid)
        .limit(1);
      const p = data?.[0] as any;
      if (alive && p) {
        setFirstName(p.first_name ?? '');
        setLastName(p.last_name ?? '');
        setUsername(p.username ?? '');
        setEmail(p.email ?? '');
        setHeight(typeof p.height === 'number' ? p.height : '');
        setWeight(typeof p.weight === 'number' ? p.weight : '');
      }
    };
    load();
    return () => { alive = false };
  }, [open, session?.user?.id, supabase]);

  const save = async () => {
    const uid = session?.user?.id || null;
    if (!uid) return;
    setLoading(true);
    await supabase
      .from('profile')
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        username: username || null,
        email: email || null,
        height: height === '' ? null : Number(height),
        weight: weight === '' ? null : Number(weight),
      })
      .eq('creator_id', uid);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Profile</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField label="First name" value={firstName} onChange={e=>setFirstName(e.target.value)} size="small" />
          <TextField label="Last name" value={lastName} onChange={e=>setLastName(e.target.value)} size="small" />
          <TextField label="Username" value={username} onChange={e=>setUsername(e.target.value)} size="small" />
          <TextField label="Email" value={email} onChange={e=>setEmail(e.target.value)} size="small" />
          <Stack direction="row" spacing={1}>
            <TextField label="Height (in)" type="number" value={height} onChange={e=>setHeight(e.target.value === '' ? '' : Number(e.target.value))} size="small" />
            <TextField label="Weight (lb)" type="number" value={weight} onChange={e=>setWeight(e.target.value === '' ? '' : Number(e.target.value))} size="small" />
          </Stack>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>These values power BMI and other metrics shown in the app.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" disabled={loading} onClick={save}>{loading ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

