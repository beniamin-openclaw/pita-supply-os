import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { imageMimeType, isImageFile } from "../lib/imageFile";
import { PhotoUploadControl } from "./PhotoUploadControl";

describe("PhotoUploadControl", () => {
  it("offers a camera picker and a gallery picker without capture", () => {
    render(
      <LangProvider>
        <PhotoUploadControl photos={[]} onChange={vi.fn()} />
      </LangProvider>,
    );
    expect(screen.getByText("Zrób zdjęcie")).toBeInTheDocument();
    expect(screen.getByText("Z galerii")).toBeInTheDocument();
    expect(screen.getByTestId("wz-camera-input")).toHaveAttribute("capture", "environment");
    const gallery = screen.getByTestId("wz-gallery-input");
    expect(gallery).not.toHaveAttribute("capture");
    expect(gallery).toHaveAttribute("multiple");
    // image/* only — listing .heic makes iOS skip the HEIC→JPEG transcode.
    expect(gallery).toHaveAttribute("accept", "image/*");
  });
});

describe("isImageFile / imageMimeType", () => {
  it("accepts a typed image", () => {
    const f = new File(["x"], "wz.jpg", { type: "image/jpeg" });
    expect(isImageFile(f)).toBe(true);
    expect(imageMimeType(f)).toBe("image/jpeg");
  });

  it("accepts an untyped HEIC or JPG by extension and guesses the type", () => {
    const heic = new File(["x"], "IMG_0001.HEIC", { type: "" });
    expect(isImageFile(heic)).toBe(true);
    expect(imageMimeType(heic)).toBe("image/heic");
    const jpg = new File(["x"], "photo.jpeg", { type: "" });
    expect(imageMimeType(jpg)).toBe("image/jpeg");
  });

  it("rejects a non-image", () => {
    expect(isImageFile(new File(["x"], "doc.pdf", { type: "application/pdf" }))).toBe(false);
  });
});
