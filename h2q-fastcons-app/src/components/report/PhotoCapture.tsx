"use client";

import { Camera, ImagePlus, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { uploadSitePhoto } from "@/lib/frappe/client";
import { Spinner } from "@/components/ui/Spinner";
import { FrappeApiError } from "@/lib/frappe/errors";
import { Card, CardContent } from "@/components/ui/card";

export type PhotoItem = {
  id: string;
  fileName: string;
  previewUrl: string;
  remoteUrl?: string;
  uploading?: boolean;
  error?: string;
};

/**
 * Chụp / chọn ảnh → preview ngay → upload Frappe File API
 * (h2q_core R2 write_file) → lưu remoteUrl (R2) vào state.
 */
export function PhotoCapture({
  value,
  onChange,
}: {
  value: PhotoItem[];
  onChange: (next: PhotoItem[]) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [globalError, setGlobalError] = useState("");

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setGlobalError("");
    const files = Array.from(fileList);

    const starters: PhotoItem[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
    }));
    onChange([...value, ...starters]);

    const uploaded: PhotoItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const stub = starters[i]!;
      try {
        const res = await uploadSitePhoto(file);
        uploaded.push({
          ...stub,
          uploading: false,
          remoteUrl: res.file_url,
        });
      } catch (err) {
        const message =
          err instanceof FrappeApiError || err instanceof Error
            ? err.message
            : "Upload R2 thất bại";
        uploaded.push({ ...stub, uploading: false, error: message });
        setGlobalError(message);
      }
    }

    onChange([
      ...value.filter((p) => !starters.some((s) => s.id === p.id)),
      ...uploaded,
    ]);

    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  function remove(id: string) {
    const target = value.find((p) => p.id === id);
    if (target?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((p) => p.id !== id));
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <p className="text-sm font-medium text-slate-800">Chụp ảnh / Tải ảnh lên</p>
        <p className="text-xs text-slate-500">
          Ảnh được upload lên Cloudflare R2 ngay khi chọn. Preview hiển thị bên dưới.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-slate-900 px-2 text-sm font-semibold text-white active:scale-[0.98]"
          >
            <Camera className="size-6" />
            Chụp ảnh
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white px-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 active:scale-[0.98]"
          >
            <ImagePlus className="size-6" />
            Tải ảnh lên
          </button>
        </div>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,.pdf,.dwg,.dxf"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />

        {globalError ? <p className="text-sm text-red-600">{globalError}</p> : null}

        {value.length === 0 ? (
          <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
            <UploadCloud className="mb-2 size-8 opacity-60" />
            <p className="text-sm">Chưa có ảnh nghiệm thu</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {value.map((photo) => (
              <li
                key={photo.id}
                className="relative overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={photo.fileName}
                  className="aspect-square w-full object-cover"
                />
                {photo.uploading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-white">
                    <Spinner className="size-7 border-white" />
                    <span className="text-xs font-medium">Đang lên R2…</span>
                  </div>
                ) : null}
                {photo.remoteUrl ? (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">
                    <UploadCloud className="size-3" /> R2 OK
                  </span>
                ) : null}
                {photo.error ? (
                  <span className="absolute inset-x-0 bottom-0 bg-red-600/90 px-2 py-1 text-[10px] text-white">
                    {photo.error}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(photo.id)}
                  className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-full bg-black/65 text-white"
                  aria-label="Xóa ảnh"
                >
                  <Trash2 className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
