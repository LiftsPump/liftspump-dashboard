'use client';

import Link from 'next/link';
import Image from "next/image";
import Avatar from '@mui/material/Avatar';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import GroupIcon from '@mui/icons-material/Group';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MenuIcon from '@mui/icons-material/Menu';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItem from '@mui/material/ListItem';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import styles from "./Navigation.module.css";
import { usePathname } from 'next/navigation';
import { accentFor } from './navigation-utils';
import logo from "../data/LiftsPump.png";

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode; // MUI icon
  path: string;
}

const navigationItems: NavigationItem[] = [
  { id: 'routines', label: 'Routines', icon: <FitnessCenterIcon fontSize="small" />, path: '/routines' },
  { id: 'users', label: 'Users', icon: <GroupIcon fontSize="small" />, path: '/users' },
  { id: 'videos', label: 'Videos', icon: <VideoLibraryIcon fontSize="small" />, path: '/videos' },
  { id: 'exercises', label: 'Exercises', icon: <LibraryBooksIcon fontSize="small" />, path: '/exercises' },
  { id: 'payments', label: 'Payments', icon: <CreditCardIcon fontSize="small" />, path: '/payments' },
  { id: 'minime', label: 'MiniMe', icon: <SmartToyIcon fontSize="small" />, path: '/minime' },
];

export default function Navigation() {
  const pathname = usePathname();
  return (
    <List className={styles.listSelector} disablePadding>
      <ListItem disableGutters sx={{ px: 1, py: 1 }}>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => location.assign("/")} title="Home">
          <Image src={logo} alt="LiftsPump logo" className={styles.logoImage}/>
          <div className={styles.titleText}>LIFTSPUMP</div>
        </div>
      </ListItem>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 0.5 }} />
      {navigationItems.map((item) => (
        <ListItemButton 
          key={item.id}
          component={Link}
          href={item.path}
          prefetch
          className={styles.navButton}
          sx={{
            px: 1.25,
            py: 0.75,
            borderRadius: 2,
            mx: 0.75,
            my: 0.25,
            backgroundColor: pathname === item.path ? 'rgba(26,224,128,0.15)' : 'transparent',
            '&:hover': {
              backgroundColor: pathname === item.path
                ? 'rgba(26,224,128,0.22)'
                : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          <ListItemIcon
            sx={{
              margin: '6px',
              color: pathname === item.path ? 'rgb(26,224,128)' : '#9ca3af',
            }}
          >
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{
              sx: {
                color: pathname === item.path ? 'rgb(26,224,128)' : '#e5e7eb',
                fontWeight: 600,
              },
            }}
          />
        </ListItemButton>
      ))}    
    </List>
  );
}
