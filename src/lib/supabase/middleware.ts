import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Email auth has been removed from the entry flow, so middleware no longer
  // blocks access or refreshes auth cookies on navigation.
  return NextResponse.next({ request });
}
