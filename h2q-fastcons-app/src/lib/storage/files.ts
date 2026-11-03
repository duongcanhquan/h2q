import { createHash, createHmac } from "crypto";
import { createSupabaseServer } from "@/lib/supabase/server";

const FOLDERS = ["vat-lieu", "cong-nhan", "cong-trinh", "tien-do", "hoa-don", "tep", "hien-truong"] as const;
export type FileFolder = (typeof FOLDERS)[number];

export function fileFolder(value: string | null | undefined): FileFolder {
  return FOLDERS.includes(value as FileFolder) ? (value as FileFolder) : "tep";
}

function hmac(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex");
}

function encodeKey(key: string) {
  return key.split("/").map((part) => encodeURIComponent(part)).join("/");
}

async function putR2(key: string, bytes: Uint8Array, contentType: string) {
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const access = process.env.R2_ACCESS_KEY_ID?.trim();
  const secret = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (!account || !access || !secret || !bucket || !publicUrl) return null;

  const host = `${account}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payload = sha256(Buffer.from(bytes));
  const canonicalUri = `/${bucket}/${encodeKey(key)}`;
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payload}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonical = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payload}`;
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonical)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, dateStamp), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${canonicalUri}`, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "x-amz-content-sha256": payload,
      "x-amz-date": amzDate,
      authorization,
    },
    body: Buffer.from(bytes),
  });
  if (!response.ok) {
    throw new Error(`R2 từ chối tệp (${response.status}).`);
  }
  return { url: `${publicUrl}/${encodeKey(key)}`, key, store: "r2" as const };
}

async function slimImage(bytes: Uint8Array, contentType: string, fileName: string) {
  if (!contentType.startsWith("image/") || contentType === "image/gif" || contentType === "image/svg+xml") {
    return { bytes, contentType, fileName };
  }
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(Buffer.from(bytes), { failOn: "none" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
    if (out.length >= bytes.byteLength) return { bytes, contentType, fileName };
    return {
      bytes: new Uint8Array(out),
      contentType: "image/jpeg",
      fileName: fileName.replace(/\.[^.]+$/, "") + ".jpg",
    };
  } catch {
    return { bytes, contentType, fileName };
  }
}

export async function storeFile(folder: FileFolder, fileName: string, bytes: Uint8Array, contentType: string) {
  const slim = await slimImage(bytes, contentType || "application/octet-stream", fileName);
  const safe = slim.fileName.replace(/[^\w.\-]+/g, "_").slice(-80) || "tep";
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const owner = auth.user?.id || "shared";
  const key = `${owner}/${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safe}`;
  const remote = await putR2(key, slim.bytes, slim.contentType);
  if (remote) return remote;
  const uploaded = await supabase.storage.from("site-photos").upload(key, slim.bytes, {
    contentType: slim.contentType,
    upsert: false,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  const { data } = supabase.storage.from("site-photos").getPublicUrl(key);
  return { url: data.publicUrl, key, store: "supabase" as const };
}
