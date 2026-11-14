export interface User {
  id: string;
  email: string;
  username: string;
  password?: string; // Optional: should not be returned in responses
  isEmailVerified: boolean; // Email verification status
  emailVerificationToken?: string; // Token for verifying email
  emailVerificationExpires?: Date; // Expiration time for verification token
  created_at: Date;
}
