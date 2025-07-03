

export function dbToBook(row: any): Book {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors
      ? row.authors.split(",").map((s: string) => s.trim())
      : [],
    year: row.year,
    publisher: row.publisher,
    binding: row.binding,
    isbn: row.isbn,
    coverUrl: row.cover_image_url,
    sortIndex: row.sort_index,
    copies: row.copies || [],
  };
}

export function dbToCopy(row: any): Copy {
  return {
    id: row.id,
    bookId: row.book_id,
    condition: row.condition,
    notes: row.notes,
    acquiredDate: row.acquired_date,
    sortIndex: row.sort_index,
    purchasePrice: row.purchasePrice,
    marketPrice: row.marketPrice,
    isListed: row.is_listed,
  };
}

export function bookToDb(book: Book): any {
  return {
    id: book.id,
    title: book.title,
    authors: book.authors.join(", "),
    year: book.year,
    publisher: book.publisher,
    binding: book.binding,
    isbn: book.isbn,
    cover_image_url: book.coverUrl,
    sort_index: book.sortIndex,
  };
}

export function copyToDb(copy: Copy): any {
  return {
    id: copy.id,
    book_id: copy.bookId,
    condition: copy.condition,
    notes: copy.notes,
    acquired_date: copy.acquiredDate,
    sort_index: copy.sortIndex,
    purchasePrice: copy.purchasePrice,
    marketPrice: copy.marketPrice,
    is_listed: copy.isListed,
  };
}