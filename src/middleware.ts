import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/constants";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !process.env.SESSION_SECRET) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
