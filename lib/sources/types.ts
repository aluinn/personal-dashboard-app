export type ImportRow = {
  firm: string;
  role: string;
  type?: string;
  programme?: string;
  deadline?: string | null; // YYYY-MM-DD
  opensOn?: string | null;
  link?: string;
  notes?: string;
  description?: string;
  location?: string;
  status?: string;
};
