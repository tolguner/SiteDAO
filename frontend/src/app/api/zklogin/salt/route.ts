import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

/// zkLogin salt servisi
///
/// Salt, kullanıcının OAuth kimliği ile Sui adresi arasındaki bağı gizler: aynı JWT
/// için hep aynı adres türetilmeli, ama salt'ı bilmeyen biri e-postadan adrese
/// gidememelidir. Bu yüzden salt istemcide hesaplanamaz; sunucudaki bir sır ile
/// türetilir ve sır asla istemciye gönderilmez.
///
/// Burada salt = HMAC-SHA256(secret, iss|aud|sub) değerinin ilk 128 biti.
/// Deterministiktir (kullanıcı hep aynı adresi alır), sunucu sırrı olmadan
/// hesaplanamaz ve zkLogin'in beklediği 2^128 sınırının altındadır.

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export async function POST(request: NextRequest) {
  const secret = process.env.ZKLOGIN_SALT_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "ZKLOGIN_SALT_SECRET tanımlı değil. Salt servisi bu sır olmadan çalışamaz.",
      },
      { status: 500 }
    );
  }

  let jwt: string | undefined;
  try {
    ({ jwt } = await request.json());
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  if (!jwt) {
    return NextResponse.json({ error: "jwt alanı zorunlu" }, { status: 400 });
  }

  const audience = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!audience) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_GOOGLE_CLIENT_ID tanımlı değil" },
      { status: 500 }
    );
  }

  try {
    // JWT'yi Google'ın imzasına karşı doğrula; aksi halde herkes istediği
    // sub değeri için salt isteyip başkasının adresini türetebilirdi.
    const { payload } = await jwtVerify(jwt, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
    });

    const { iss, aud, sub } = payload;
    if (!iss || !aud || !sub) {
      return NextResponse.json(
        { error: "JWT içinde iss, aud veya sub eksik" },
        { status: 400 }
      );
    }

    const material = `${iss}|${Array.isArray(aud) ? aud[0] : aud}|${sub}`;
    const digest = createHmac("sha256", secret).update(material).digest();

    // zkLogin salt'ı 2^128'den küçük olmalı
    const salt = BigInt("0x" + digest.subarray(0, 16).toString("hex")).toString();

    return NextResponse.json({ salt });
  } catch (error) {
    console.error("Salt üretilemedi:", error);
    return NextResponse.json(
      { error: "JWT doğrulanamadı" },
      { status: 401 }
    );
  }
}
