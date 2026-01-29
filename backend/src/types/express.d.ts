// =============================================================================
// Express Type Augmentation
// =============================================================================

import { UserRole } from './index';

// Extended user type that includes both naming conventions
interface ExtendedUser {
  user_id: string;
  id: string;  // Alias for user_id
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: ExtendedUser;
      files?: Multer.File[];
    }

    // Extend Multer namespace for file uploads
    namespace Multer {
      interface File {
        location?: string; // S3 URL when using multer-s3
        key?: string; // S3 key when using multer-s3
        bucket?: string; // S3 bucket name
      }
    }
  }
}

export {};
