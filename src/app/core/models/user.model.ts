export interface User {
  id: string;
  name: string;
  email: string;
  role: 'leader' | 'admin';
  avatar?: string;
}
