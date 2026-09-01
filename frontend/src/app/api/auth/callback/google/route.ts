import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Google'dan gelen authorization code veya id_token
  const code = searchParams.get("code");
  const idToken = searchParams.get("id_token");
  const error = searchParams.get("error");
  
  if (error) {
    // Hata durumunda ana sayfaya yönlendir
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error)}`, request.url)
    );
  }
  
  if (idToken) {
    // Implicit flow - id_token doğrudan geldi
    // Client-side'da işlenecek
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("id_token", idToken);
    return NextResponse.redirect(redirectUrl);
  }
  
  if (code) {
    // Authorization code flow - token'ı al
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: `${request.nextUrl.origin}/api/auth/callback/google`,
          grant_type: "authorization_code",
        }),
      });
      
      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }
      
      const tokens = await tokenResponse.json();
      const idToken = tokens.id_token;
      
      if (!idToken) {
        throw new Error("No id_token in response");
      }
      
      // Client-side'da işlenecek şekilde yönlendir
      const redirectUrl = new URL("/", request.url);
      redirectUrl.hash = `id_token=${idToken}`;
      return NextResponse.redirect(redirectUrl);
      
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(error.message)}`, request.url)
      );
    }
  }
  
  // Geçersiz istek
  return NextResponse.redirect(new URL("/?auth_error=invalid_request", request.url));
}
