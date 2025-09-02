import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";

export default function Users() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation/>
        <div className={styles.pageContent}>
          <h1>Users</h1>
          <p>Manage user accounts and profiles here.</p>
          {/* Add your users content here */}
        </div>
      </main>
      <footer className={styles.footer}>
        
      </footer>
    </div>
  );
}
