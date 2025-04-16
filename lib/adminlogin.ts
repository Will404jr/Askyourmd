export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
}

export const users: User[] = [
  {
    id: "admin",
    username: "Admin",
    email: "admin@nssfug.org",
    password: "P@55w0rd@123",
  },
];
