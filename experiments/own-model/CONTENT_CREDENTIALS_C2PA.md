# Zumrad AI — Content Credentials (C2PA)

Zumrad AI can attach a **signed C2PA manifest** to generated media. This records that the asset was created by a generative AI workflow. It is provenance metadata, not the image/video generation model itself, and it does not guarantee the media is true or that every platform will preserve the manifest.

Official standard: https://spec.c2pa.org/specifications/

## Supported by this helper

- Images: JPEG, PNG, WebP
- Video: MP4, MOV (actual codec/container support depends on the installed C2PA SDK)
- GIF is not supported by this helper for embedded credentials. The current experimental video generator emits GIF, so convert/export it to a supported video container before signing.

## Install

Use Python in the server/cloud environment, not the 3 GB RAM phone:
```bash
python -m pip install -r requirements-c2pa.txt
```

## Signing credentials

C2PA requires a certificate chain and the matching private key. Do not put the private key in the web client, GitHub, or a public ZIP deployed to users. Store it as a secret on the server. A self-signed development certificate may produce a signed manifest but will generally not be trusted by verifiers; production trust requires an appropriate certificate and correct chain.

Set environment variables:
```bash
export C2PA_SIGN_CERT=/secure/path/cert-chain.pem
export C2PA_SIGN_KEY=/secure/path/private-key.pem
export C2PA_TSA_URL=http://timestamp.digicert.com
```

Then sign a generated asset:
```bash
python add_content_credentials.py generated.png generated.with-credentials.png \
  --prompt "A turquoise mountain village at sunrise" \
  --model "Zumrad AI Own Generator" \
  --version "0.9.0"
```

For video:
```bash
python add_content_credentials.py generated.mp4 generated.with-credentials.mp4 \
  --prompt "A small boat moving across a lake"
```

The helper uses the C2PA `c2pa.created` action and the IPTC `trainedAlgorithmicMedia` digital source type. It preserves the original file and writes a separate output. If signing fails, no successful credential should be claimed.

## Important

- C2PA is a cryptographically signed provenance standard, not just a visible “AI-generated” label.
- A valid signature does not by itself establish that the signer is trustworthy; trust depends on certificate validation and related checks.
- Never claim “verified” just because a manifest exists. Inspect validation results and the certificate trust status.
- The helper is a separate export step; it is not yet wired into the experimental `/api/image` or `/api/video` response path. Integrating signing into the production export pipeline requires server-side signing credentials and supported media formats.
