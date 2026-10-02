// Image-file helpers for the WZ photo picker (PhotoUploadControl).

/** True for an image the phone handed us. Some Android pickers and iOS HEIC
 *  files arrive with an empty `type`, so the file extension is checked too. */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name);
}

/** The MIME type to upload under: the file's own, else one guessed from the
 *  extension — the backend rejects anything not starting with "image/". */
export function imageMimeType(file: File): string {
  if (file.type.startsWith("image/")) return file.type;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "heic" || ext === "heif") return `image/${ext}`;
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}
