#!/usr/bin/env python3
"""Embed signed C2PA Content Credentials in generated media.

Requires a C2PA-compatible certificate chain and matching private key.
This script never invents a signature: it refuses to run without credentials.
"""
import argparse
import json
import os
import sys
from pathlib import Path

MIME_BY_EXT = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".mp4": "video/mp4", ".mov": "video/quicktime",
}

AI_SOURCE = "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"

def main():
    parser = argparse.ArgumentParser(description="Add signed C2PA Content Credentials to AI-generated media.")
    parser.add_argument("input", help="Generated image/video file")
    parser.add_argument("output", help="Output path; keep a different name from input")
    parser.add_argument("--prompt", default="", help="Optional prompt to record in the manifest")
    parser.add_argument("--model", default="Zumrad AI Own Generator", help="Generator name")
    parser.add_argument("--version", default="0.9.0", help="Generator version")
    parser.add_argument("--cert", default=os.getenv("C2PA_SIGN_CERT"), help="PEM certificate chain (or C2PA_SIGN_CERT)")
    parser.add_argument("--key", default=os.getenv("C2PA_SIGN_KEY"), help="PEM private key (or C2PA_SIGN_KEY)")
    parser.add_argument("--tsa", default=os.getenv("C2PA_TSA_URL", "http://timestamp.digicert.com"), help="RFC 3161 timestamp URL")
    parser.add_argument("--alg", default="ES256", choices=["ES256", "ES384", "ES512", "PS256", "PS384", "PS512", "ED25519"])
    args = parser.parse_args()

    src, dst = Path(args.input), Path(args.output)
    if not src.is_file():
        parser.error(f"Input file not found: {src}")
    if src.resolve() == dst.resolve():
        parser.error("Output must be a different file so the original is preserved.")
    if not args.cert or not args.key:
        parser.error("Signing certificate and private key are required. Set C2PA_SIGN_CERT and C2PA_SIGN_KEY.")
    mime = MIME_BY_EXT.get(src.suffix.lower())
    if not mime:
        parser.error("Unsupported extension. Supported: JPG, PNG, WEBP, MP4, MOV. GIF is not supported for embedded C2PA here.")

    try:
        from c2pa import Builder, Context, Signer, C2paSignerInfo, C2paSigningAlg
    except ImportError:
        print("Missing dependency. Install with: pip install -r requirements-c2pa.txt", file=sys.stderr)
        return 2

    cert_data = Path(args.cert).read_bytes()
    key_data = Path(args.key).read_bytes()
    alg = getattr(C2paSigningAlg, args.alg)
    signer_info = C2paSignerInfo(
        alg=alg,
        sign_cert=cert_data,
        private_key=key_data,
        ta_url=args.tsa.encode("utf-8") if args.tsa else b"",
    )
    signer = Signer.from_info(signer_info)
    assertions = [{
        "label": "c2pa.actions",
        "data": {"actions": [{
            "action": "c2pa.created",
            "digitalSourceType": AI_SOURCE,
            "parameters": {"com.zumrad.ai.prompt": args.prompt} if args.prompt else {}
        }]}
    }]
    manifest = {
        "claim_generator_info": [{"name": args.model, "version": args.version}],
        "title": f"AI-generated media by {args.model}",
        "format": mime,
        "assertions": assertions,
    }
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Context() as context:
        with Builder(manifest, context) as builder:
            builder.sign_file(str(src), str(dst), signer)
        # Re-open the result to confirm a manifest is present.
        from c2pa import Reader
        with open(dst, "rb") as signed_file:
            with Reader(mime, signed_file, context=context) as reader:
                details = json.loads(reader.json())
    print(json.dumps({
        "status": "signed",
        "input": str(src),
        "output": str(dst),
        "mime": mime,
        "manifest_present": bool(details),
        "note": "The signature's trust status depends on certificate trust and timestamp validation."
    }, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
