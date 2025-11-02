'use client';
import Image from "next/image";
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import LinkIcon from '@mui/icons-material/Link';
import Snackbar from '@mui/material/Snackbar';
import logo from "../data/LiftsPump.png";
import styles from "./Header.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from 'react';
import ProfileDialog from './ProfileDialog';
import SettingsDialog from './SettingsDialog';
import { Alert } from "@mui/material";

export default function Header() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const router = useRouter();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openProfile, setOpenProfile] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const uid = session?.user?.id || null;
      if (!uid) return;
      try {
        const { data } = await supabase
          .from('trainer')
          .select('trainer_id')
          .eq('creator_id', uid)
          .limit(1);
        if (!alive) return;
        setTrainerId((data?.[0]?.trainer_id as string) || null);
      } catch (err) {
        console.warn('Failed to load trainer profile', err);
      }
    };
    load();
    return () => { alive = false };
  }, [session?.user?.id, supabase]);

  const initials = useMemo(() => {
    const email = session?.user?.email || '';
    const base = email.split('@')[0] || 'AA';
    return base.slice(0,2).toUpperCase();
  }, [session?.user?.email]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const inviteUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return trainerId ? `${base}/join?trainer_id=${encodeURIComponent(trainerId)}` : '';
  }, [trainerId]);

  const handleCopyInvite = async () => {
    if (!inviteUrl) {
      setSnack('Create a trainer to share invites');
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setSnack('Invite link copied');
    } catch {
      setSnack('Unable to copy invite link');
    }
  };

  const handleAvatarClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  return (
    <header className={styles.header}>
      <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => router.push('/') } title="Home">
        <Image src={logo} alt="LiftsPump logo" className={styles.logo}/>
        <div className={styles.titleText}>LIFTSPUMP</div>
      </div>
      {inviteUrl && (
        <Button
          size="small"
          onClick={handleCopyInvite}
          startIcon={<LinkIcon />}
          sx={{ textTransform: 'none', color: '#e5e7eb', borderColor: '#2a2a2a', marginLeft: 'auto' }}
        >
          Copy invite
        </Button>
      )}
      {trainerId && (
        <Avatar
          src={photoUrl ?? undefined}
          sx={{ bgcolor: photoUrl ? 'transparent' : 'white', color: photoUrl ? 'inherit' : '#1AE080', fontSize: 16, lineHeight: '40px', marginLeft: '12px', cursor: 'pointer' }}
          onClick={handleAvatarClick}
          className={styles.profileImage}
          aria-label="Account menu"
        >
          {!photoUrl ? initials : undefined}
        </Avatar>
      )}
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { mt: 1.2, border: '1px solid #2a2a2a', bgcolor: '#111', color: '#e5e7eb' } }}
        keepMounted
      >
        <MenuItem onClick={() => { handleCloseMenu(); setOpenProfile(true); }}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { handleCloseMenu(); setOpenSettings(true); }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
      <Snackbar
        open={!!snack}
        autoHideDuration={2000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={() => setSnack(null)} severity={"success"} sx={{ width: '100%' }}>
          {snack}
        </Alert>
      </Snackbar>
      <ProfileDialog open={openProfile} onClose={() => setOpenProfile(false)} />
      <SettingsDialog open={openSettings} onClose={() => setOpenSettings(false)} onPhotoChanged={(url) => setPhotoUrl(url)} />
    </header>
  );
}
