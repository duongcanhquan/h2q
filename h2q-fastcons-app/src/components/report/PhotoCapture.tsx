"use client";

import { Camera, ImagePlus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { uploadSitePhoto } from "@/lib/frappe/client";
import { Spinner } from "@/components/ui/Spinner";
import { FrappeApiError } from "@/lib/frappe/errors";

export type PhotoItem = {
  id: string;
  previewUrl: string;
  remoteUrl?: string;
  uploading?: boolean;
  error?: string;
};

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
        uploaded.push({ ...stub, uploading: false, remoteUrl: res.file_url });
      } catch (err) {
        const message =
          err instanceof FrappeApiError || err instanceof Error
            ? err.message
            : "Upload thất bại";
        uploaded.push({ ...stub, uploading: false, error: message });
        setGlobalError(message);
      }
    }

    onChange([
      ...value.filter((p) => !starters.some((s) => s.id === p.id)),
      ...uploaded,
    ]);
  }

  function remove(id: string) {
    const target = value.find((p) => p.id === id);
    if (target?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-semibold text-white"
        >
          <Camera className="size-5" />
          Chụp ảnh
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-slate-800 ring-1 ring-slate-300"
        >
          <ImagePlus className="size-5" />
          Thư viện
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

      {value.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3">
          {value.map((photo) => (
            <li key={photo.id} className="relative overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.previewUrl} alt="" className="aspect-square w-full object-cover" />
              {photo.uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                  <Spinner className="size-6 border-white" />
                </div>
              ) : null}
              {photo.remoteUrl ? (
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <Upload className="size-3" /> R2
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
                className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Xóa ảnh"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
