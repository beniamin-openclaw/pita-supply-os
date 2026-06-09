// WZ photo upload control (GR-01). Mobile-first: opens the rear camera on
// phones (capture="environment"), compresses each picked image client-side
// (phone JPEGs are 2–4 MB) before handing File objects up to the parent, and
// shows removable thumbnail previews. The parent owns the File[] state and
// uploads them; this control only collects + compresses.

import { useEffect, useMemo, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { useT } from "../../../i18n";

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
        if (!file.type.startsWith("image/")) continue;
        try {
          const out = await imageCompression(file, {
            maxSizeMB: 1.2,
            maxWidthOrHeight: 2000,
            useWebWorker: true,
          });
          added.push(out);
        } catch {
          added.push(file); // compression failed → upload the original
        }
      }
      if (added.length > 0) onChange([...photos, ...added]);
    } finally {
      setCompressing(false);
    }
  };

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

      <label
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 ${
          disabled || compressing ? "opacity-60" : "cursor-pointer active:bg-slate-50"
        }`}
      >
        {compressing ? (
          <Loader2 size={18} aria-hidden="true" className="animate-spin" />
        ) : (
          <Camera size={18} aria-hidden="true" />
        )}
        <span>{compressing ? t("delivery.compressing") : t("delivery.addPhoto")}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          disabled={disabled || compressing}
          onChange={onSelect}
        />
      </label>
    </div>
  );
}
