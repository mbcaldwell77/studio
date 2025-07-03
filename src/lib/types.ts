// src/lib/types.ts

// Represents the Book entity in the application layer (camelCase)
export type Book = {
  id: string;
  title: string;
  authors: string[]; // UI uses array, DB stores as comma-separated string
  year: number | null;
  publisher: string;
  binding: string;
  isbn: string;
  coverUrl: string; // Maps to cover_image_url in DB
  sortIndex: number; // Maps to sort_index in DB
  copies?: Copy[];
};

// Represents the Copy entity in the application layer (camelCase)
export type Copy = {
  id: string;
  bookId: string; // Maps to book_id in DB
  condition: string;
  notes: string;
  purchaseDate: Date | null; // Maps to acquired_date in DB
  purchaseLocation?: string; // Maps to purchase_location in DB
  sortIndex: number; // Maps to sort_index in DB
  purchasePrice?: number | null; // Maps to purchase_price in DB
  marketPrice?: number | null; // Maps to market_price in DB
  isListed?: boolean; // Maps to is_listed in DB
};

// Represents the Book entity as stored in the Supabase database (snake_case)
export type DbBook = {
  id: string;
  title: string;
  authors: string; // Stored as comma-separated string in DB
  year: number | null;
  publisher: string;
  binding: string;
  isbn: string;
  cover_image_url: string; // snake_case for DB
  sort_index: number; // snake_case for DB
};

// Represents the Copy entity as stored in the Supabase database (snake_case)
export type DbCopy = {
  id: string;
  book_id: string; // snake_case for DB
  condition: string;
  notes: string;
  acquired_date: string | null; // Stored as ISO string in DB
  sort_index: number; // snake_case for DB
  purchase_price?: number | null; // snake_case for DB
  market_price?: number | null; // snake_case for DB
  is_listed?: boolean; // snake_case for DB
};
