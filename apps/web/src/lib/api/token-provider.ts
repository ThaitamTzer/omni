export interface TokenProvider {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  clearAuth(): void;
}
