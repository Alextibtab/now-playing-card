const API_KEY = Deno.env.get("API_KEY");

export function validateAuth(req: Request): boolean {
  if (!API_KEY) return false;

  const auth = req.headers.get("Authorization");
  if (!auth) return false;

  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;

  return parts[1] === API_KEY;
}

export function getApiKey(): string | undefined {
  return API_KEY;
}
