export function getEnv(name, fallback = '') {
  const v = process.env[name];
  return (v === undefined || v === '') ? fallback : v;
}
export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}. PowerShell: $env:${name}="YOUR_KEY"`);
  return v;
}
