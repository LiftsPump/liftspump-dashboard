export function accentFor(id: string): string {
  switch (id) {
    case 'routines': return '#60a5fa';
    case 'videos': return '#f87171';
    case 'users': return '#1AE080';
    case 'payments': return '#a78bfa';
    case 'minime': return '#fb923c';
    default: return '#1AE080';
  }
}
