const API_KEY = Deno.env.get("API_KEY");
if (!API_KEY) {
  console.error("API_KEY environment variable is required");
  Deno.exit(1);
}

export function validateAuth(req: Request): boolean {
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;
  return parts[1] === API_KEY;
}

export function getApiKey(): string {
  return API_KEY!;
}
