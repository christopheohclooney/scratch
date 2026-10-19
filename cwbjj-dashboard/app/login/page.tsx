export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="login__card">
        <span className="eyebrow">Canary Wharf BJJ</span>
        <h1 className="heading">
          <span>Website dashboard</span>
          <span>Sign in to continue.</span>
        </h1>
        <form method="post" action="/api/login">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          {error ? <p className="login__error" role="alert">That password didn't work. Try again.</p> : null}
          <button className="pill" type="submit">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
