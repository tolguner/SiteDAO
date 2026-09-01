import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Dosya bulunamadı" },
        { status: 400 }
      );
    }

    // Pinata API credentials
    const apiKey = process.env.PINATA_API_KEY;
    const secretKey = process.env.PINATA_SECRET_KEY;

    if (!apiKey || !secretKey) {
      // Demo mod: Fake hash döndür
      console.warn("Pinata credentials not found, returning demo hash");
      return NextResponse.json({
        ipfsHash: `QmDemo${Date.now()}`,
        isDemoMode: true,
      });
    }

    // Pinata'ya yükle
    const pinataFormData = new FormData();
    pinataFormData.append("file", file);

    const pinataMetadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        source: "SiteDAO",
      },
    });
    pinataFormData.append("pinataMetadata", pinataMetadata);

    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          pinata_api_key: apiKey,
          pinata_secret_api_key: secretKey,
        },
        body: pinataFormData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Pinata upload error:", error);
      return NextResponse.json(
        { error: "IPFS yükleme hatası" },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      ipfsHash: data.IpfsHash,
      pinSize: data.PinSize,
      timestamp: data.Timestamp,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
