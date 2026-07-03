import WeatherPill from './WeatherPill';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning 👋';
  if (h < 17) return 'Good afternoon 👋';
  return 'Good evening 👋';
}

export default function Topbar() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      height: '36px',
      minHeight: '36px',
    }}>
      <div style={{
        fontSize: '15px',
        fontWeight: 600,
        letterSpacing: '-0.3px',
        color: 'var(--black)',
        whiteSpace: 'nowrap',
      }}>
        {getGreeting()}
      </div>
      <WeatherPill />
    </div>
  );
}
