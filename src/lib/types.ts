export type Book = {
  id: string;
  title: string;
  authors: string[];
  publishedYear: number | null;
  isbn: string;
  publisher: string;
  binding: 'Hardcover' | 'Paperback' | 'Trade PB/Uk-B' | 'Mass Market/UK-A' | 'UK-C' | 'Oversize/Softcover' | 'specialty binding' | 'other';
  coverUrl: string;
  copies: Copy[];
  sortIndex: number;
};

export type Copy = {
  id: string;
  condition: 'Brand New' | 'Like New' | 'Very Good' | 'Good' | 'Acceptable';
  purchasePrice: number | null;
  marketPrice: number | null;
  purchaseDate: Date | null;
  purchaseLocation: string;
  notes: string;
  isListed: boolean;
};
