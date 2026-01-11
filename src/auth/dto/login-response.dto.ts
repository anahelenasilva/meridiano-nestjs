export class LoginResponseDto {
  access_token: string;
  user: {
    id: string;
    email: string;
    username: string;
  };

  constructor(accessToken: string, user: { id: string; email: string; username: string }) {
    this.access_token = accessToken;
    this.user = user;
  }
}
