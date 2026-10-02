// WZ photo upload control (GR-01). Mobile-first: two pickers — "Zrób zdjęcie"
// opens the rear camera (capture="environment"), "Z galerii" opens the photo
// library / files (no capture attribute). The gallery path exists because the
// in-browser camera shows a black screen on some phones and in-app browsers
// (feedback 2026-10-02); a photo taken with the phone's own camera app and
// picked from the gallery always works. Each picked image is compressed client-side
// (phone JPEGs are 2–4 MB) before handing File objects up to the parent, and
// shows removable thumbnail previews. The parent owns the File[] state and
// uploads them; this control only collects + compresses.

import { useEffect, useMemo, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { useT } from "../../../i18n";
import { imageMimeType, isImageFile } from "../lib/imageFile";

// A compression that never settles (seen in some in-app webviews) must not
// leave the picker spinning forever — fall back to the original file.
const COMPRESS_TIMEOUT_MS = 20000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("compression timeout")), ms);
    p.then(
      (v: T) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function isHeic(file: File): boolean {
  return file.type === "image/heic" || file.type === "image/heif";
}

/** The compressed blob as a File whose name matches its (possibly new) type,
 *  e.g. IMG_0001.HEIC re-encoded to JPEG becomes IMG_0001.jpg. */
function asNamedFile(out: Blob, original: File): File {
  let name = original.name;
  if (out.type === "image/jpeg" && !/\.jpe?g$/i.test(name)) {
    name = name.replace(/\.[^.]*$/, "") + ".jpg";
  }
  return new File([out], name, { type: out.type });
}

interface PhotoUploadControlProps {
  photos: File[];
  onChange: (photos: File[]) => void;
  disabled?: boolean;
}

export function PhotoUploadControl({ photos, onChange, disabled }: PhotoUploadControlProps) {
  const { t } = useT();
  const [compressing, setCompressing] = useState(false);

  // Object-URL previews derived from the photo set (no setState-in-effect); the
  // effect only revokes the prior URLs on change/unmount to avoid leaks.
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ""; // let the user re-pick the same file
    if (selected.length === 0) return;
    setCompressing(true);
    try {
      const added: File[] = [];
      for (const file of selected) {
        if (!isImageFile(file)) continue;
        const typed =
          file.type === imageMimeType(file)
            ? file
            : new File([file], file.name, { type: imageMimeType(file) });
        try {
          const out = await withTimeout(
            imageCompression(typed, {
              maxSizeMB: 1.2,
              maxWidthOrHeight: 2000,
              useWebWorker: true,
              // HEIC can't be re-encoded by canvas; ask for JPEG (Safari decodes
              // HEIC, other browsers throw and we keep the original below).
              fileType: isHeic(typed) ? "image/jpeg" : undefined,
            }),
            COMPRESS_TIMEOUT_MS,
          );
          added.push(out.type.startsWith("image/") ? asNamedFile(out, typed) : typed);
        } catch {
          // Compression failed or hung (HEIC outside Safari, an in-app webview
          // that blocks the worker) → upload the original, correctly typed.
          added.push(typed);
        }
      }
      if (added.length > 0) onChange([...photos, ...added]);
    } finally {
      setCompressing(false);
    }
  };

  const pickerClass = `flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-700 ${
    disabled || compressing ? "opacity-60" : "cursor-pointer active:bg-slate-50"
  }`;

  const removeAt = (idx: number) => onChange(photos.filter((_, i) => i !== idx));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{t("delivery.photosLabel")}</div>
      <p className="mt-1 text-xs text-slate-600">{t("delivery.photoHint")}</p>

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((url, idx) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                disabled={disabled}
                aria-label={t("delivery.removePhoto")}
                className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white active:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className={pickerClass}>
          {compressing ? (
            <Loader2 size={18} aria-hidden="true" className="animate-spin" />
          ) : (
            <Camera size={18} aria-hidden="true" />
          )}
          <span>{compressing ? t("delivery.compressing") : t("delivery.takePhoto")}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={disabled || compressing}
            onChange={onSelect}
            data-testid="wz-camera-input"
          />
        </label>
        <label className={pickerClass}>
          <ImageIcon size={18} aria-hidden="true" />
          <span>{t("delivery.pickFromGallery")}</span>
          <input
            type="file"
            // Plain image/* on purpose: listing .heic/.heif makes iOS hand over the
            // raw HEIC instead of transcoding it to JPEG, and Chrome on the
            // Manager's side cannot show HEIC.
            accept="image/*"
            multiple
            className="sr-only"
            disabled={disabled || compressing}
            onChange={onSelect}
            data-testid="wz-gallery-input"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t("delivery.cameraTip")}</p>
    </div>
  );
}
