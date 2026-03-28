import { v2 as cloudinary, UploadApiOptions } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
});

export const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file): Promise<UploadApiOptions> => ({
    folder: "meeting_videos",
    resource_type: "video",
    format: "mp4", // force mp4 extension
    public_id: `${Date.now()}-${file.originalname}`,
  }),
});
