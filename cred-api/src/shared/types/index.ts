export interface User {
  id: string;
  email: string;
  name: string;
  picture_url: string;
  google_access_token: string;
  created_at: Date;
}

export interface UserResponse extends Omit<User, 'google_access_token'> {
  google_access_token_valid: boolean;
}
