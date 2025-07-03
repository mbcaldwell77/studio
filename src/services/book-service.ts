// src/services/book-service.ts
"use server";

import { dbToBook, bookToDb, dbToCopy, copyToDb } from "@/lib/mappers";
import { supabase } from "@/lib/supabase-client";
import type { Book, Copy, DbBook, DbCopy } from "@/lib/types";

// Removed redundant toCamelCase, toSnakeCase, toDbBook, fromDbBook as mappers handle this.

/**
 * Fetches all books from the database, including their associated copies.
 * Converts database snake_case format to application camelCase format using mappers.
 * @returns A promise that resolves to an array of Book objects.
 * @throws Error if fetching books or copies fails.
 */
export async function getBooks(): Promise<Book[]> {
  // Fetch books and their related inventory items (copies)
  // The `inventory(*)` syntax tells Supabase to fetch all columns from the related 'inventory' table
  // where the foreign key relationship is defined.
  const { data: booksData, error: booksError } = await supabase
    .from("books")
    .select("*, inventory(*)") // Select all columns from books and all related inventory items
    .order("sort_index", { ascending: true }); // Order books by their sort_index

  if (booksError) {
    console.error("Error fetching books:", booksError);
    throw new Error(booksError.message);
  }

  // Map the fetched data from DbBook/DbCopy to Book/Copy application types
  const books: Book[] = (booksData || []).map((dbBookRow: DbBook & { inventory: DbCopy[] }) => {
    const book = dbToBook(dbBookRow); // Convert the main book data
    // Convert and attach associated copies
    book.copies = (dbBookRow.inventory || []).map(dbToCopy)
      .sort((a, b) => a.sortIndex - b.sortIndex); // Ensure copies are also sorted by their sortIndex
    return book;
  });

  return books;
}

/**
 * Adds a new book to the database.
 * Converts the application's Book type (camelCase) to database snake_case format using mappers.
 * @param book The book object to add (excluding id and copies, which are generated/managed by DB).
 * @returns A promise that resolves to the newly added Book object.
 * @throws Error if adding the book fails.
 */
export async function addBook(
  book: Omit<Book, "id" | "copies" | "sortIndex"> // sortIndex will be set by DB or during order update
): Promise<Book> {
  // Convert the camelCase book object to snake_case for the database
  const dbBookPayload = bookToDb(book);

  // Set initial sort_index for new books. This can be adjusted by a reordering function later.
  // For simplicity, let's assume a default or handle it in the order update.
  // If not provided, Supabase might use a default or null. Let's explicitly set it to 0 for new books.
  dbBookPayload.sort_index = dbBookPayload.sort_index ?? 0;

  const { data, error } = await supabase
    .from("books")
    .insert(dbBookPayload as DbBook) // Cast to DbBook for type safety with insert
    .select()
    .single();

  if (error) {
    console.error("Error adding book:", error);
    throw new Error(error.message);
  }

  // Convert the returned database object back to the application's Book type
  return dbToBook(data as DbBook);
}

/**
 * Updates details for an existing book in the database.
 * Converts the application's Book type (camelCase) to database snake_case format using mappers.
 * @param bookId The ID of the book to update.
 * @param details Partial book object containing fields to update.
 * @returns A promise that resolves when the update is complete.
 * @throws Error if updating the book fails.
 */
export async function updateBookDetails(
  bookId: string,
  details: Partial<Omit<Book, "id" | "copies">>
): Promise<void> {
  // Convert the camelCase details object to snake_case for the database
  const dbDetailsPayload = bookToDb(details);

  const { error } = await supabase
    .from("books")
    .update(dbDetailsPayload)
    .eq("id", bookId);

  if (error) {
    console.error("Error updating book:", error);
    throw new Error(error.message);
  }
}

/**
 * Saves (inserts or updates) a copy in the database.
 * Converts the application's Copy type (camelCase) to database snake_case format using mappers.
 * @param bookId The ID of the book this copy belongs to.
 * @param copy The copy object to save.
 * @returns A promise that resolves when the save is complete.
 * @throws Error if saving the copy fails.
 */
export async function saveCopy(bookId: string, copy: Copy): Promise<void> {
  // Convert the camelCase copy object to snake_case for the database
  const dbCopyPayload = copyToDb(copy);

  // Ensure book_id is correctly set in the payload, overriding if necessary
  dbCopyPayload.book_id = bookId;

  // Set initial sort_index for new copies if not already set.
  dbCopyPayload.sort_index = dbCopyPayload.sort_index ?? 0;

  const { error } = await supabase.from("inventory").upsert(dbCopyPayload as DbCopy);

  if (error) {
    console.error("Error saving copy:", error);
    throw new Error(error.message);
  }
}

/**
 * Deletes a copy from the database.
 * @param copyId The ID of the copy to delete.
 * @returns A promise that resolves when the deletion is complete.
 * @throws Error if deleting the copy fails.
 */
export async function deleteCopy(copyId: string): Promise<void> {
  const { error } = await supabase.from("inventory").delete().eq("id", copyId);

  if (error) {
    console.error("Error deleting copy:", error);
    throw new Error(error.message);
  }
}

/**
 * Deletes a book and all its associated copies from the database.
 * Assumes RLS and ON DELETE CASCADE are configured in Supabase for the foreign key.
 * @param bookId The ID of the book to delete.
 * @returns A promise that resolves when the deletion is complete.
 * @throws Error if deleting the book fails.
 */
export async function deleteBook(bookId: string): Promise<void> {
  // RLS and ON DELETE CASCADE on the foreign key will handle deleting associated inventory.
  const { error } = await supabase.from("books").delete().eq("id", bookId);

  if (error) {
    console.error("Error deleting book:", error);
    throw new Error(error.message);
  }
}

/**
 * Updates the display order (sortIndex) of books in the database.
 * Converts the application's Book type (camelCase) to database snake_case format for sortIndex.
 * @param books An array of Book objects with updated sortIndex values.
 * @returns A promise that resolves when the order update is complete.
 * @throws Error if updating the book order fails.
 */
export async function updateBookOrder(
  books: Pick<Book, "id" | "sortIndex">[]
): Promise<void> {
  // Map the camelCase sortIndex to snake_case sort_index for the database
  const updates = books.map((book) => ({
    id: book.id,
    sort_index: bookToDb(book).sort_index, // Use bookToDb for consistent mapping
  }));

  const { error } = await supabase.from("books").upsert(updates as DbBook[]); // Cast for upsert

  if (error) {
    console.error("Error updating book order:", error);
    throw new Error(error.message);
  }
}

/**
 * Updates the display order (sortIndex) of copies within a specific book in the database.
 * Converts the application's Copy type (camelCase) to database snake_case format for sortIndex.
 * @param bookId The ID of the parent book.
 * @param copies An array of Copy objects with updated sortIndex values.
 * @returns A promise that resolves when the order update is complete.
 * @throws Error if updating the copy order fails.
 */
export async function updateCopiesOrder(
  bookId: string, // bookId is needed for filtering if not part of copy object directly in DB
  copies: Copy[]
): Promise<void> {
  // Assign new sort_index to each copy based on its position in the array
  const updates = copies.map((copy, idx) => ({
    id: copy.id,
    sort_index: copyToDb({ ...copy, sortIndex: idx }).sort_index, // Use copyToDb for consistent mapping
  }));

  const { error } = await supabase.from("inventory").upsert(updates as DbCopy[]); // Cast for upsert

  if (error) {
    console.error("Error updating copy order:", error);
    throw new Error(error.message);
  }
}
