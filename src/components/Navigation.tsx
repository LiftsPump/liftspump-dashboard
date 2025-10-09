'use client';

import Link from 'next/link';
import Avatar from '@mui/material/Avatar';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import GroupIcon from '@mui/icons-material/Group';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import EventIcon from '@mui/icons-material/Event';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import styles from "./Navigation.module.css";
import { accentFor } from './navigation-utils';

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
];

export default function Navigation() {
  return (
    <List className={styles.listSelector}>
      {navigationItems.map((item) => (
        <ListItemButton 
          key={item.id}
          component={Link} href={item.path} prefetch
          className={styles.navButton}
        >
          <ListItemIcon>
            <Avatar
              className={styles.navIcon}
              sx={{
                bgcolor: accentFor(item.id),
                color: '#0b0b0b',
                fontWeight: 800,
                boxShadow: '0 0 0 2px rgba(255,255,255,0.06) inset',
              }}
            >
              {item.icon}
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{ sx: { color: '#e5e7eb', fontWeight: 600 } }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
