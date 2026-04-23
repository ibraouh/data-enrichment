const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function fetchHello(): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/hello`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
