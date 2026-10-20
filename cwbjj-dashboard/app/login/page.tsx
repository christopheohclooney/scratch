import { PasswordField } from "@/components/PasswordField";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="login__card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/cwbjj-logo.svg" alt="Canary Wharf BJJ" width={157} height={28} />
        <h1 className="heading">
          <span>Sign in to continue.</span>
        </h1>
        <form method="post" action="/api/login">
          <label htmlFor="password">Password</label>
          <PasswordField />
          {error ? <p className="login__error" role="alert">That password didn't work. Try again.</p> : null}
          <button className="pill" type="submit">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
