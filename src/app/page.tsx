import Image from "next/image";
import styles from "./page.module.css";
import logo from "../data/LiftsPump.png"
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Image src={logo} alt="LiftsPump logo" className={styles.logo}/>
        <div className={styles.titleText} >
          LIFTSPUMP
        </div>
        <Avatar sx={{ bgcolor: 'white', color: '#1AE080' }} className={styles.profileImage}>AA</Avatar>
      </header>
      <main className={styles.main}>
        <List className={styles.listSelector}>
          <ListItemButton>
            <ListItemIcon>
               <Avatar sx={{ bgcolor: 'white', color: '#1AE080' }} className={styles.profileImage}>R</Avatar>
            </ListItemIcon>
            <ListItemText primary="Routines"/>
          </ListItemButton>
          <ListItemButton>
            <ListItemIcon>
               <Avatar sx={{ bgcolor: 'white', color: '#1AE080' }} className={styles.profileImage}>U</Avatar>
            </ListItemIcon>
            <ListItemText primary="Users"/>
          </ListItemButton>
          <ListItemButton>
            <ListItemIcon>
               <Avatar sx={{ bgcolor: 'white', color: '#1AE080' }} className={styles.profileImage}>P</Avatar>
            </ListItemIcon>
            <ListItemText primary="Payments"/>
          </ListItemButton>
        </List>
      </main>
      <footer className={styles.footer}>
        
      </footer>
    </div>
  );
}
