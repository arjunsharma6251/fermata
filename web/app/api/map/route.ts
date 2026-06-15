import { NextRequest, NextResponse } from "next/server";
import { storeMap } from "@/lib/kv";

// POST { data: <encoded map> } -> { id } ; the client then shares /u/<id>
export async function POST(req: NextRequest) {
  let data: unknown;
  try {
    ({ data } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (typeof data !== "string" || data.length === 0 || data.length > 30000) {
    return NextResponse.json({ error: "invalid map" }, { status: 400 });
  }
  const id = await storeMap(data);
  if (!id) {
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }
  return NextResponse.json({ id });
}
