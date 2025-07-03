export type Book = {
  id: string;
  title: string;
  authors: string[]; // UI uses array, DB stores as comma-separated string
  year: number | null;
  publisher: string;
  binding: string;
  isbn: string;
  cover_image_url: string;
  sort_index: number;
  copies?: Copy[];
};

export type Copy = {
  id: string;
  book_id: string;
  condition: string;
  notes: string;
  acquired_date: string;
  sort_index: number;
  purchasePrice?: number;
  marketPrice?: number;
};
