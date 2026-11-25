import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const r = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`, { redirect: "follow" });
  const ct = r.headers.get("content-type") || "application/octet-stream";
  if (!r.ok || ct.includes("text/html")) return NextResponse.json({ error: "Auth" }, { status: 403 });
  return new NextResponse(await r.arrayBuffer(), { headers: { "Content-Type": ct } });
}
