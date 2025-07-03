// src/lib/mappers.ts
import type { Book, Copy, DbBook, DbCopy } from "@/lib/types";

/**
 * Converts a database row (snake_case) for a Book into the application's Book type (camelCase).
 * Handles:
 * - `authors` string to string array conversion.
 * - `cover_image_url` to `coverUrl` mapping.
 * - `sort_index` to `sortIndex` mapping.
 * @param row The database row for a book.
 * @returns The Book object in camelCase.
 */
export function dbToBook(row: DbBook): Book {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors
      ? row.authors.split(",").map((s: string) => s.trim()).filter(Boolean) // Ensure no empty strings
      : [],
    year: row.year,
    publisher: row.publisher,
    binding: row.binding,
    isbn: row.isbn,
    coverUrl: row.cover_image_url, // Map snake_case to camelCase
    sortIndex: row.sort_index,     // Map snake_case to camelCase
    // copies are typically fetched separately or joined in the service layer, not directly in the book row
    copies: [], // Initialize as empty, will be populated by service if needed
  };
}

/**
 * Converts a database row (snake_case) for a Copy into the application's Copy type (camelCase).
 * Handles:
 * - `book_id` to `bookId` mapping.
 * - `acquired_date` string to Date object conversion.
 * - `sort_index` to `sortIndex` mapping.
 * - `purchase_price` to `purchasePrice` mapping.
 * - `market_price` to `marketPrice` mapping.
 * - `is_listed` to `isListed` mapping.
 * - `purchase_location` to `purchaseLocation` mapping.
 * @param row The database row for a copy.
 * @returns The Copy object in camelCase.
 */
export function dbToCopy(row: DbCopy): Copy {
  return {
    id: row.id,
    bookId: row.book_id,
    condition: row.condition,
    notes: row.notes,
    purchaseDate: row.acquired_date ? new Date(row.acquired_date) : null, // Convert string date to Date object
    purchaseLocation: row.purchase_location, // Map snake_case to camelCase
    sortIndex: row.sort_index,             // Map snake_case to camelCase
    purchasePrice: row.purchase_price,     // Map snake_case to camelCase
    marketPrice: row.market_price,         // Map snake_case to camelCase
    isListed: row.is_listed,               // Map snake_case to camelCase
  };
}

/**
 * Converts an application's Book object (camelCase) into a database row (snake_case) for insertion/update.
 * Handles:
 * - `authors` string array to comma-separated string conversion.
 * - `coverUrl` to `cover_image_url` mapping.
 * - `sortIndex` to `sort_index` mapping.
 * @param book The Book object in camelCase.
 * @returns The DbBook object in snake_case.
 */
export function bookToDb(book: Partial<Book>): Partial<DbBook> {
  const dbBook: Partial<DbBook> = {
    id: book.id,
    title: book.title,
    authors: Array.isArray(book.authors) ? book.authors.join(", ") : undefined, // Convert array to comma-separated string
    year: book.year,
    publisher: book.publisher,
    binding: book.binding,
    isbn: book.isbn,
    cover_image_url: book.coverUrl, // Map camelCase to snake_case
    sort_index: book.sortIndex,     // Map camelCase to snake_case
  };

  // Remove undefined properties to allow partial updates
  Object.keys(dbBook).forEach(key => dbBook[key as keyof Partial<DbBook>] === undefined && delete dbBook[key as keyof Partial<DbBook>]);

  return dbBook;
}

/**
 * Converts an application's Copy object (camelCase) into a database row (snake_case) for insertion/update.
 * Handles:
 * - `bookId` to `book_id` mapping.
 * - `purchaseDate` Date object to ISO string conversion.
 * - `sortIndex` to `sort_index` mapping.
 * - `purchasePrice` to `purchase_price` mapping.
 * - `marketPrice` to `market_price` mapping.
 * - `isListed` to `is_listed` mapping.
 * - `purchaseLocation` to `purchase_location` mapping.
 * @param copy The Copy object in camelCase.
 * @returns The DbCopy object in snake_case.
 */
export function copyToDb(copy: Partial<Copy>): Partial<DbCopy> {
  const dbCopy: Partial<DbCopy> = {
    id: copy.id,
    book_id: copy.bookId,
    condition: copy.condition,
    notes: copy.notes,
    acquired_date: copy.purchaseDate ? copy.purchaseDate.toISOString() : null, // Convert Date object to ISO string
    purchase_location: copy.purchaseLocation, // Map camelCase to snake_case
    sort_index: copy.sortIndex,             // Map camelCase to snake_case
    purchase_price: copy.purchasePrice,     // Map camelCase to snake_case
    market_price: copy.marketPrice,         // Map camelCase to snake_case
    is_listed: copy.isListed,               // Map camelCase to snake_case
  };

  // Remove undefined properties to allow partial updates
  Object.keys(dbCopy).forEach(key => dbCopy[key as keyof Partial<DbCopy>] === undefined && delete dbCopy[key as keyof Partial<DbCopy>]);

  return dbCopy;
}
