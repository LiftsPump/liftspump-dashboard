'use client';
import Image from "next/image";
import Avatar from '@mui/material/Avatar';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import logo from "../data/LiftsPump.png";
import styles from "./Header.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from 'react';
import ProfileDialog from './ProfileDialog';
import SettingsDialog from './SettingsDialog';

export default function Header() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const router = useRouter();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openProfile, setOpenProfile] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const uid = session?.user?.id || null;
      if (!uid) return;
      /*const { data } = await supabase
        .from('trainer')
        .select('photo_url')
        .eq('creator_id', uid)
        .limit(1);
      if (alive) setPhotoUrl((data?.[0]?.photo_url as string) || null);*/
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

  const handleAvatarClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  return (
    <header className={styles.header}>
      <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => router.push('/') } title="Home">
        <Image src={logo} alt="LiftsPump logo" className={styles.logo}/>
        <div className={styles.titleText}>LIFTSPUMP</div>
      </div>
      <div>
        <Avatar
          src={photoUrl ?? undefined}
          sx={{ bgcolor: photoUrl ? 'transparent' : 'white', color: photoUrl ? 'inherit' : '#1AE080', fontSize: 16, lineHeight: '40px' }}
          onClick={handleAvatarClick}
          className={styles.profileImage}
        >
          {!photoUrl ? initials : undefined}
        </Avatar>
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
        <ProfileDialog open={openProfile} onClose={() => setOpenProfile(false)} />
        <SettingsDialog open={openSettings} onClose={() => setOpenSettings(false)} onPhotoChanged={(url) => setPhotoUrl(url)} />
      </div>
    </header>
  );
}
