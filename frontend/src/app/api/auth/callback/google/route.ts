import { NextRequest, NextResponse } from "next/server";

/// Google OAuth dönüş noktası
///
/// Uygulama zkLogin için implicit flow kullanır (`response_type=id_token`): Google
/// kimlik jetonunu doğrudan döndürür, bu yüzden bir client secret ile jeton takası
/// yapılmaz. Kimlik jetonu URL fragment'ında geldiğinden sunucuya hiç ulaşmaz;
/// bu uç nokta yalnızca hata durumunu ve sorgu dizesinde gelen jetonu karşılar.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const idToken = searchParams.get("id_token");
  const error = searchParams.get("error");

  if (error) {
    // Hata durumunda ana sayfaya yönlendir
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (idToken) {
    // Jeton istemci tarafında işlenir
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("id_token", idToken);
    return NextResponse.redirect(redirectUrl);
  }

  // Jeton fragment'ta gelmiş olabilir; ana sayfadaki zkLogin sağlayıcısı onu okur
  return NextResponse.redirect(new URL("/", request.url));
}
