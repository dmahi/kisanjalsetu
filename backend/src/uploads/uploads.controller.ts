import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'];

function getUploadDir(): string {
  const dir = join(process.cwd(), 'uploads');
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Serverless: fall back to /tmp
    return join('/tmp', 'uploads');
  }
  return dir;
}

const storage = diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
  },
});

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('api/uploads')
export class UploadsController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Only PNG, JPG, WEBP or HEIC images are allowed'),
            false,
          );
        }
      },
    }),
  )
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file received');
    return { path: `/uploads/${file.filename}` };
  }
}