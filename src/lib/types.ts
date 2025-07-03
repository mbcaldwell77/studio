export type Book = {
  id: string;
  title: string;
  authors: string[]; // UI uses array, DB stores as comma-separated string
  year: number | null;
  publisher: string;
  binding: string;
  isbn: string;
  coverUrl: string;
  sortIndex: number;
  copies?: Copy[];
};

export type Copy = {
  id: string;
  bookId: string;
  condition: string;
  notes: string;
  acquiredDate: string;
  sortIndex: number;
  purchasePrice?: number;
  marketPrice?: number;
  isListed?: boolean;
};
