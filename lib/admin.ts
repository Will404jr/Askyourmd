export interface User {
  id: string;
  username: string;
  email: string;
  personnelType: "Md" | "Staff";
}

export const users: User[] = [
  {
    id: "U001",
    username: "Admin",
    email: "admin@nssfug.org",
    personnelType: "Md",
  },
];
