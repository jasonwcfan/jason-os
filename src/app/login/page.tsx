import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="font-mono text-lg font-semibold tracking-tight">
            jason<span className="text-accent">.os</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Personal operating system</p>
        </div>
        <LoginForm next={next ?? "/crm"} />
      </div>
    </div>
  );
}
