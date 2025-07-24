import Image from "next/image";
import Avatar from '@mui/material/Avatar';
import logo from "../data/LiftsPump.png";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <Image src={logo} alt="LiftsPump logo" className={styles.logo}/>
      <div className={styles.titleText}>
        LIFTSPUMP
      </div>
      <Avatar sx={{ bgcolor: 'white', color: '#1AE080' }} className={styles.profileImage}>AA</Avatar>
    </header>
  );
}
