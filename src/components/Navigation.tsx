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
            <Avatar sx={{ bgcolor: 'white', color: '#1AE080' }} className={styles.navIcon}>
              {item.icon}
            </Avatar>
          </ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );
}
