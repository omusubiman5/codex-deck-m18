import sharp from "sharp";

const DATA_URL = /^data:([^,]+),(.*)$/s;

export async function rasterizeM18Image(image: string): Promise<string> {
  const match = DATA_URL.exec(image);
  if (!match) throw new Error("M18 image is not a supported data URL.");
  const [, header = "", payload = ""] = match;
  const mimeType = header.split(";", 1)[0] ?? "";
  const input = header.endsWith(";base64")
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  const dark = mimeType === "image/svg+xml" && input.includes(Buffer.from('data-theme="dark"'));
  const png = await sharp(input)
    .resize(64, 64, { fit: "fill" })
    .flatten({ background: dark ? "#000000" : "#ffffff" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
