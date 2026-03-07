const API_KEY = Deno.env.get("API_KEY");

export function validate_auth(req: Request): boolean {
  if (!API_KEY) return false;

  const auth = req.headers.get("Authorization");
  if (!auth) return false;

  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;

  return parts[1] === API_KEY;
}
