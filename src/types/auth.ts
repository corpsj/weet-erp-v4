export type AppRole = "admin" | "user";

export type AppUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: AppRole;
};

export type SessionPayload = {
  user: AppUser;
};
