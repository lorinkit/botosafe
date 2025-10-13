import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { Files, File } from "formidable";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

// Disable Next.js body parser — formidable handles it
export const config = {
  api: {
    bodyParser: false,
  },
};

// 🔹 Configure Cloudinary (use env vars)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

interface UploadResponse {
  url?: string;
  error?: string;
}

function getUploadedFile(files: Files): File | undefined {
  const fileField = files.file;
  if (!fileField) return undefined;

  if (Array.isArray(fileField)) {
    return fileField[0];
  }

  return fileField;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, _fields, files) => {
    if (err) {
      console.error("❌ Form parse error:", err);
      res.status(500).json({ error: "Failed to parse upload" });
      return;
    }

    const uploadedFile = getUploadedFile(files);

    if (!uploadedFile) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      const filePath = uploadedFile.filepath;
      const result = await cloudinary.uploader.upload(filePath, {
        folder: "botosafe/candidates",
        resource_type: "auto",
      });

      // Delete temporary file
      fs.unlinkSync(filePath);

      res.status(200).json({ url: result.secure_url });
    } catch (uploadErr) {
      console.error("❌ Cloudinary upload error:", uploadErr);
      res.status(500).json({ error: "Upload to Cloudinary failed" });
    }
  });
}
