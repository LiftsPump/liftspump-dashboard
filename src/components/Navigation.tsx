'use client';

import { useRouter } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import styles from "./Navigation.module.css";

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const navigationItems: NavigationItem[] = [
  { id: 'routines', label: 'Routines', icon: 'R', path: '/routines' },
  { id: 'users', label: 'Users', icon: 'U', path: '/users' },
  { id: 'payments', label: 'Payments', icon: 'P', path: '/payments' },
];

const accentFor = (id: string) => {
  switch (id) {
    case 'routines': return '#60a5fa';
    case 'users': return '#1AE080';
    case 'payments': return '#a78bfa';
    default: return '#1AE080';
  }
}

export default function Navigation() {
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <List className={styles.listSelector}>
      {navigationItems.map((item) => (
        <ListItemButton 
          key={item.id}
          onClick={() => handleNavigation(item.path)}
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
