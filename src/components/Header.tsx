'use client';
import Image from "next/image";
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import logo from "../data/LiftsPump.png";
import styles from "./Header.module.css";

export default function Header() {
  const supabase = useSupabaseClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className={styles.header}>
      <Image src={logo} alt="LiftsPump logo" className={styles.logo}/>
      <div className={styles.titleText}>
        LIFTSPUMP
      </div>
      <div>
        <Avatar sx={{ bgcolor: 'white', color: '#1AE080' }} onClick={handleSignOut} className={styles.profileImage}>AA</Avatar>
      </div>
    </header>
  );
}
