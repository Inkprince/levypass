// Scripts run outside Next.js, so load .env.local the way `next dev` would. Existing variables win.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the process environment.
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. Copy .env.example to .env.local or export it.`);
    process.exit(1);
  }
  return value;
}
