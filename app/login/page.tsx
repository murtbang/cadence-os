export const dynamic = 'force-dynamic';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const failed = searchParams?.error;
  const throttled = searchParams?.error === 'throttled';

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#181b22',
        color: '#e7e9ee',
        fontFamily: 'var(--font-geist), system-ui, sans-serif',
        padding: '24px',
      }}
    >
      <form
        action="/api/auth"
        method="POST"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          maxWidth: '280px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '0.04em', margin: 0 }}>
          Cadence
        </h1>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="Enter PIN"
          aria-label="PIN"
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            border: `1px solid ${failed ? '#e5484d' : '#2a2f3a'}`,
            background: '#11141a',
            color: '#e7e9ee',
            fontSize: '18px',
            textAlign: 'center',
            letterSpacing: '0.3em',
            outline: 'none',
          }}
        />
        {failed ? (
          <p style={{ color: '#e5484d', fontSize: '13px', margin: 0 }}>
            {throttled ? 'Too many attempts — wait a few minutes.' : 'Incorrect PIN'}
          </p>
        ) : null}
        <button
          type="submit"
          style={{
            padding: '13px 16px',
            borderRadius: '12px',
            border: 'none',
            background: '#5b6cff',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Unlock
        </button>
      </form>
    </main>
  );
}
