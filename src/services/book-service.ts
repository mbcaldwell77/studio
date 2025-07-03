// src/services/book-service.ts
'use server';

import { supabase } from '@/lib/supabase-client';
import type { Book, Copy } from '@/lib/types';

// Helper to convert snake_case from DB to camelCase for the app
const toCamelCase = (obj: any) => {
  if (!obj) return null;
  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    const newKey = key.replace(/(_\w)/g, (k) => k[1].toUpperCase());
    newObj[newKey] = obj[key];
  }
  return newObj;
};

// Helper to convert camelCase from app to snake_case for the DB
const toSnakeCase = (obj: any) => {
    if (!obj) return null;
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        const newKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        newObj[newKey] = obj[key];
    }
    return newObj;
}

export async function getBooks(): Promise<Book[]> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    console.error('Not authenticated', sessionError);
    return [];
  }
  const userId = sessionData.session.user.id;

  const { data: booksData, error: booksError } = await supabase
    .from('books')
    .select(`
      *,
      inventory (
        *
      )
    `)
    .eq('user_id', userId)
    .order('sort_index', { ascending: true });

  if (booksError) {
    console.error('Error fetching books:', booksError);
    throw new Error(booksError.message);
  }

  return booksData.map((book: any) => {
    const { inventory, ...bookDetails } = book;
    const camelCasedBook = toCamelCase(bookDetails) as Omit<Book, 'copies'>;
    const camelCasedCopies = inventory.map((copy: any) => toCamelCase(copy)) as Copy[];
    
    return {
      ...camelCasedBook,
      copies: camelCasedCopies || [],
    };
  });
}

export async function addBook(book: Omit<Book, 'id' | 'copies'>): Promise<Book> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error('Not authenticated');
    const userId = sessionData.session.user.id;

    // Get the highest sort_index for the current user
    const { data: maxSortIndexData, error: maxSortIndexError } = await supabase
        .from('books')
        .select('sort_index')
        .eq('user_id', userId)
        .order('sort_index', { ascending: false })
        .limit(1)
        .single();
    
    if (maxSortIndexError && maxSortIndexError.code !== 'PGRST116') { // Ignore 'exact one row' error if no books exist
        throw new Error(maxSortIndexError.message);
    }

    const newSortIndex = (maxSortIndexData?.sort_index ?? -1) + 1;

    const bookToInsert = {
        ...toSnakeCase(book),
        user_id: userId,
        sort_index: newSortIndex,
    };
    
    const { data, error } = await supabase
        .from('books')
        .insert(bookToInsert)
        .select()
        .single();

    if (error) {
        console.error('Error adding book:', error);
        throw new Error(error.message);
    }

    return { ...(toCamelCase(data) as Omit<Book, 'copies'>), copies: [] };
}

export async function updateBookDetails(bookId: string, details: Partial<Omit<Book, 'id' | 'copies'>>): Promise<void> {
    const { error } = await supabase
        .from('books')
        .update(toSnakeCase(details))
        .eq('id', bookId);

    if (error) {
        console.error('Error updating book:', error);
        throw new Error(error.message);
    }
}


export async function saveCopy(bookId: string, copy: Copy): Promise<void> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error('Not authenticated');
    const userId = sessionData.session.user.id;

    const copyToSave = {
        ...toSnakeCase(copy),
        book_id: bookId,
        user_id: userId
    };

    const { error } = await supabase.from('inventory').upsert(copyToSave);
    
    if (error) {
        console.error('Error saving copy:', error);
        throw new Error(error.message);
    }
}

export async function deleteCopy(copyId: string): Promise<void> {
    const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', copyId);

    if (error) {
        console.error('Error deleting copy:', error);
        throw new Error(error.message);
    }
}

export async function deleteBook(bookId: string): Promise<void> {
    // RLS and ON DELETE CASCADE on the foreign key will handle deleting associated inventory.
    const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId);

    if (error) {
        console.error('Error deleting book:', error);
        throw new Error(error.message);
    }
}

export async function updateBookOrder(books: Pick<Book, 'id' | 'sortIndex'>[]): Promise<void> {
    const updates = books.map(book => ({
        id: book.id,
        sort_index: book.sortIndex
    }));

    const { error } = await supabase.from('books').upsert(updates);

    if (error) {
        console.error('Error updating book order:', error);
        throw new Error(error.message);
    }
}

export async function updateCopiesOrder(bookId: string, copies: Copy[]): Promise<void> {
    // Assign new sort_index to each copy based on its position in the array
    const updates = copies.map((copy, idx) => ({
        id: copy.id,
        sort_index: idx
    }));
    const { error } = await supabase.from('inventory').upsert(updates);
    if (error) {
        console.error('Error updating copy order:', error);
        throw new Error(error.message);
    }
}

// Note: With the new relational structure, copies are ordered by purchase date or another field in the DB.
// A separate manual sort for copies within a book is not implemented in this version,
// but could be added with a `sort_index` on the 'inventory' table.
