"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Book, Copy } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "@/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AddCopyModal } from "@/components/modals/add-copy-modal";
import { ManualAddModal } from "@/components/modals/manual-add-modal";
import { ScannerModal } from "@/components/modals/scanner-modal";
import { Logo } from "@/components/icons";
import {
  ScanLine,
  PlusCircle,
  Trash2,
  Pencil,
  GripVertical,
  BookUp,
  Loader2,
  ChevronDown,
  Info,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { lookupBook, type BookLookupOutput } from "@/ai/flows/lookup-book-flow";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getBooks,
  addBook,
  deleteBook,
  saveCopy,
  deleteCopy,
  updateBookOrder,
  updateCopiesOrder,
  updateBookDetails,
} from "@/services/book-service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Helper to get cover image with OpenLibrary fallback
// Uses book.coverUrl (camelCase) now
function getBookCoverUrl(book: Book) {
  if (book.coverUrl) return book.coverUrl; // Use camelCase property
  if (book.isbn)
    return `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`;
  return "https://placehold.co/64x96.png";
}

export default function CollectionPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isManualAddOpen, setManualAddOpen] = useState(false);
  const [isScannerOpen, setScannerOpen] = useState(false);
  const [isAddCopyOpen, setAddCopyOpen] = useState(false);

  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editingCopy, setEditingCopy] = useState<{
    book: Book;
    copy: Copy;
  } | null>(null);
  const [addingCopyToBook, setAddingCopyToBook] = useState<Book | null>(null);
  const [isDuplicateAdd, setIsDuplicateAdd] = useState(false);

  const [lookupIsbn, setLookupIsbn] = useState("");
  const [lookupCountry, setLookupCountry] = useState("US");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [initialBookData, setInitialBookData] =
    useState<BookLookupOutput | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("manual");
  const [showListedOnly, setShowListedOnly] = useState(false);
  const [openAccordionId, setOpenAccordionId] = useState<string>();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchBooks = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedBooks = await getBooks();
      // Books are already sorted by sortIndex from the service layer
      setBooks(fetchedBooks);
    } catch (error) {
      console.error("Failed to fetch books:", error);
      toast({
        title: "Error Fetching Collection",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const displayedBooks = useMemo(() => {
    let items = [...books];

    if (showListedOnly) {
      items = items
        .map((book) => {
          const listedCopies = Array.isArray(book.copies)
            ? book.copies.filter((c) => c.isListed)
            : [];
          return { ...book, copies: listedCopies };
        })
        .filter((book) => book.copies.length > 0);
    }
    if (searchTerm) {
      items = items.filter((book) =>
        book.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortOption !== "manual") {
      items.sort((a, b) => {
        switch (sortOption) {
          case "title-asc":
            return a.title.localeCompare(b.title);
          case "title-desc":
            return b.title.localeCompare(a.title);
          case "year-newest":
            return (b.year ?? 0) - (a.year ?? 0);
          case "year-oldest":
            return (a.year ?? 0) - (b.year ?? 0);
          default:
            return 0; // Should not happen with defined sort options
        }
      });
    } else {
      // When sorting manually, use the original client-sorted books array (by sortIndex)
      // but still apply search and filter. The initial fetch already sorts by sortIndex.
      items = [...books]; // Start with the already sorted (by sortIndex) full list
      if (showListedOnly) {
        items = items
          .map((book) => {
            const listedCopies = (book.copies || []).filter((c) => c.isListed);
            return { ...book, copies: listedCopies };
          })
          .filter((book) => (book.copies || []).length > 0);
      }
      if (searchTerm) {
        items = items.filter((book) =>
          book.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    }

    return items;
  }, [books, searchTerm, sortOption, showListedOnly]);

  const handleLookup = async (isbnOverride?: string) => {
    const isbnToUse = isbnOverride || lookupIsbn;
    if (!isbnToUse) {
      toast({
        title: "ISBN required",
        description: "Please enter an ISBN to look up.",
        variant: "destructive",
      });
      return;
    }
    const sanitizedIsbn = isbnToUse.replace(/-/g, "");

    const existingBook = books.find((book) => book.isbn === sanitizedIsbn);
    if (existingBook) {
      setIsDuplicateAdd(true);
      setOpenAccordionId(existingBook.id);
      openAddCopy(existingBook);
      setLookupIsbn("");
      return;
    }

    setIsLookingUp(true);
    try {
      const bookData = await lookupBook(sanitizedIsbn, lookupCountry);

      const existingBookFromApi = books.find((b) => b.isbn === bookData.isbn);
      if (existingBookFromApi) {
        setIsDuplicateAdd(true);
        setOpenAccordionId(existingBookFromApi.id);
        openAddCopy(existingBookFromApi);
      } else {
        setInitialBookData(bookData);
        setManualAddOpen(true);
      }
    } catch (error: any) {
      console.error("Failed to look up book:", error);
      toast({
        title: "Lookup Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
      setLookupIsbn("");
    }
  };

  const handleScan = (decodedText: string) => {
    setScannerOpen(false);
    handleLookup(decodedText);
  };

  const handleAddBook = async (
    book: Omit<Book, "id" | "copies" | "sortIndex">
  ) => {
    try {
      await addBook(book);
      await fetchBooks();
    } catch (error) {
      console.error("Failed to add book:", error);
      toast({
        title: "Error Adding Book",
        description: (error as Error).message,
        variant: "destructive",
      });
      throw error; // Re-throw to be caught in the modal
    }
  };

  const handleUpdateBook = async (
    bookData: Omit<Book, "id" | "copies" | "sortIndex">
  ) => {
    if (!editingBook) return;
    try {
      await updateBookDetails(editingBook.id, bookData);
      await fetchBooks();
    } catch (error) {
      console.error("Failed to update book:", error);
      toast({
        title: "Error Updating Book",
        description: (error as Error).message,
        variant: "destructive",
      });
      throw error; // Re-throw to be caught in the modal
    }
  };

  const handleSaveCopy = async (bookId: string, copy: Copy) => {
    try {
      await saveCopy(bookId, copy);
      await fetchBooks();
    } catch (error) {
      console.error("Failed to save copy:", error);
      toast({
        title: "Error Saving Copy",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    try {
      await deleteBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      toast({
        title: "Book Deleted",
        description: "The book and all its copies have been removed.",
      });
    } catch (error) {
      console.error("Failed to delete book:", error);
      toast({
        title: "Error Deleting Book",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteCopy = async (bookId: string, copyId: string) => {
    try {
      await deleteCopy(copyId); // deleteCopy only needs copyId
      await fetchBooks();
      toast({
        title: "Copy Deleted",
        description: "The copy has been removed.",
      });
    } catch (error) {
      console.error("Failed to delete copy:", error);
      toast({
        title: "Error Deleting Copy",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleToggleListed = async (
    bookId: string,
    copyId: string,
    isListed: boolean
  ) => {
    const book = books.find((b) => b.id === bookId);
    if (!book) return;

    const copy = book.copies?.find((c) => c.id === copyId);
    if (!copy) return;

    // Create a new copy object with the updated isListed status
    const updatedCopy: Copy = { ...copy, isListed };

    try {
      await saveCopy(bookId, updatedCopy); // Pass the camelCase copy object
      // Optimistically update the UI
      const updatedBooks = books.map((b) =>
        b.id === bookId
          ? {
              ...b,
              copies: (b.copies || []).map((c) => (c.id === copyId ? updatedCopy : c)),
            }
          : b
      );
      setBooks(updatedBooks);
    } catch (error) {
      console.error("Failed to toggle listed status:", error);
      toast({
        title: "Error Updating Copy",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const openAddCopy = (book: Book) => {
    setIsDuplicateAdd(false); // Reset duplicate flag when opening for new copy
    setAddingCopyToBook(book);
    setEditingCopy(null);
    setAddCopyOpen(true);
  };

  const openEditCopy = (book: Book, copy: Copy) => {
    setAddingCopyToBook(null);
    setEditingCopy({ book, copy });
    setAddCopyOpen(true);
  };

  const openEditBookModal = (book: Book) => {
    setEditingBook(book);
    setInitialBookData({
      title: book.title,
      authors: book.authors,
      publishedYear: book.year,
      publisher: book.publisher,
      binding: (
        [
          "Hardcover",
          "Paperback",
          "Trade PB/Uk-B",
          "Mass Market/UK-A",
          "UK-C",
          "Oversize/Softcover",
          "specialty binding",
          "other",
        ] as const
      ).includes(book.binding)
        ? book.binding
        : "other",
      isbn: book.isbn,
      coverUrl: book.coverUrl, // Use camelCase property
    });
    setManualAddOpen(true);
  };

  const handleManualAddClose = () => {
    setManualAddOpen(false);
    setInitialBookData(null);
    setEditingBook(null);
  };

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    if (
      active.data.current?.type === "book" &&
      over.data.current?.type === "book" &&
      active.id !== over.id
    ) {
      const oldIndex = books.findIndex((item) => item.id === active.id);
      const newIndex = books.findIndex((item) => item.id === over.id);

      const reorderedBooks = arrayMove(books, oldIndex, newIndex);
      // Update sortIndex for all reordered books based on their new position
      const booksWithNewSortIndex = reorderedBooks.map((book, idx) => ({
        ...book,
        sortIndex: idx,
      }));

      setBooks(booksWithNewSortIndex); // Optimistic update

      try {
        // Pass only id and sortIndex for update
        await updateBookOrder(booksWithNewSortIndex.map(b => ({ id: b.id, sortIndex: b.sortIndex })));
      } catch (error) {
        console.error("Failed to update book order:", error);
        toast({
          title: "Error Saving Order",
          description: (error as Error).message,
          variant: "destructive",
        });
        fetchBooks(); // Revert on failure
      }
      return;
    }

    const activeIsCopy = active.data.current?.type === "copy";
    const overIsCopy = over.data.current?.type === "copy";
    if (activeIsCopy && overIsCopy && active.id !== over.id) {
      const bookId = active.data.current?.bookId;
      const book = books.find((b) => b.id === bookId);
      if (!book || !book.copies) return;

      const oldCopyIndex = book.copies.findIndex((c) => c.id === active.id);
      const newCopyIndex = book.copies.findIndex((c) => c.id === over.id);

      const reorderedCopies = arrayMove(
        book.copies,
        oldCopyIndex,
        newCopyIndex
      );

      // Update sortIndex for all reordered copies based on their new position
      const copiesWithNewSortIndex = reorderedCopies.map((copy, idx) => ({
        ...copy,
        sortIndex: idx,
      }));

      // Optimistic update
      setBooks((prev) =>
        prev.map((b) =>
          b.id === bookId ? { ...b, copies: copiesWithNewSortIndex } : b
        )
      );

      try {
        // Pass the full copies array with updated sortIndex
        await updateCopiesOrder(bookId, copiesWithNewSortIndex);
      } catch (error) {
        console.error("Failed to update copy order:", error);
        toast({
          title: "Error Saving Order",
          description: (error as Error).message,
          variant: "destructive",
        });
        fetchBooks(); // Revert on failure
      }
    }
  }

  function SortableBookItem({ book }: { book: Book }) {
    const isManualSort = sortOption === "manual";
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: book.id,
        data: { type: "book" },
        disabled: !isManualSort,
      });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <AccordionItem
          value={book.id}
          className="border-border bg-card rounded-lg border overflow-hidden"
        >
          <div className="flex w-full items-start p-4 text-left">
            <div
              {...(isManualSort ? listeners : {})}
              className={cn(
                "touch-none flex-shrink-0 pt-1",
                isManualSort ? "cursor-grab" : "cursor-auto"
              )}
            >
              <GripVertical
                className={cn(
                  "h-5 w-5 text-muted-foreground",
                  !isManualSort && "opacity-30"
                )}
              />
            </div>

            <div className="ml-4 relative flex-shrink-0">
              <Image
                src={getBookCoverUrl(book)} // Uses book.coverUrl
                alt={`Cover of ${book.title}`}
                width={64}
                height={96}
                className="rounded object-cover shadow-md"
                data-ai-hint="book cover"
              />
            </div>

            <div className="ml-4 flex-grow min-w-0">
              <h3 className="font-headline text-lg font-bold leading-tight">
                {book.title}
              </h3>
              <p className="text-sm font-semibold text-primary">
                ISBN: {book.isbn}
              </p>
              <div className="mt-2 flex flex-col gap-y-1 text-xs text-muted-foreground">
                <span className="truncate">
                  {Array.isArray(book.authors)
                    ? book.authors.join(", ")
                    : ""}
                </span>
                <span className="truncate">{book.publisher || "N/A"}</span>
                <div className="flex flex-wrap items-center gap-x-2">
                  <span>{book.binding}</span>
                  {book.year && (
                    <span className="text-muted-foreground">&bull;</span>
                  )}
                  {book.year && <span>{book.year}</span>}
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-start gap-1 pl-2">
              <div className="flex flex-col items-end gap-2">
                <Badge
                  variant="secondary"
                  className="px-2 py-1 text-xs whitespace-nowrap"
                >
                  {Array.isArray(book.copies) ? book.copies.length : 0}{" "}
                  {Array.isArray(book.copies) && book.copies.length === 1
                    ? "Copy"
                    : "Copies"}
                </Badge>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditBookModal(book);
                    }}
                  >
                    <Pencil className="h-4 w-4 text-accent" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this Book?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{book.title}" and all of
                          its copies from your collection. This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteBook(book.id)}
                          className="bg-destructive hover:bg-destructive/80"
                        >
                          Delete Book
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <AccordionPrimitive.Header>
                <AccordionPrimitive.Trigger className="p-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
            </div>
          </div>
          <AccordionContent className="p-4 pt-0">
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-headline text-lg font-semibold">
                  Copies ({(book.copies || []).length})
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAddCopy(book)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Copy
                </Button>
              </div>
              <div className="space-y-4">
                {(book.copies || []).length > 0 ? (
                  <SortableContext
                    items={(book.copies || []).map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(book.copies || []).map((copy) => (
                      <SortableCopyItem key={copy.id} book={book} copy={copy} />
                    ))}
                  </SortableContext>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No copies found. Add one!
                  </p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </div>
    );
  }

  function SortableCopyItem({ book, copy }: { book: Book; copy: Copy }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: copy.id, data: { type: "copy", bookId: book.id } });
    const style = { transform: CSS.Transform.toString(transform), transition };

    const financialMetrics = useMemo(() => {
      const p = copy.purchasePrice;
      const m = copy.marketPrice;

      if (p === null || p === undefined || m === null || m === undefined) {
        return { pnl: null, margin: null, roi: null };
      }

      const pnl = m - p;
      const margin = m > 0 ? (pnl / m) * 100 : 0;
      const roi = p > 0 ? (pnl / p) * 100 : null;

      return { pnl, margin, roi };
    }, [copy.purchasePrice, copy.marketPrice]);

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="flex items-start gap-4 p-4 rounded-md border border-border/50 bg-background touch-none"
      >
        <div {...listeners} className="cursor-grab pt-1">
          <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
        <div className="flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-semibold text-muted-foreground">Condition</p>
              <p>{copy.condition}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">
                Price (Purchase/Market)
              </p>
              <p>
                ${copy.purchasePrice?.toFixed(2) ?? "N/A"} / $
                {copy.marketPrice?.toFixed(2) ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">Acquired</p>
              <p>
                {copy.purchaseDate
                  ? copy.purchaseDate.toLocaleDateString()
                  : "N/A"}{" "}
                at {copy.purchaseLocation || "N/A"}
              </p>
            </div>
          </div>
          {copy.notes && (
            <div className="mt-4">
              <p className="font-semibold text-muted-foreground">Notes</p>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                {copy.notes}
              </p>
            </div>
          )}

          {financialMetrics.pnl !== null && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                Profitability Analysis
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">P/L</p>
                  <p
                    className={`font-bold text-lg ${
                      financialMetrics.pnl < 0
                        ? "text-destructive"
                        : "text-green-500"
                    }`}
                  >
                    ${financialMetrics.pnl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margin</p>
                  <p
                    className={`font-bold text-lg ${
                      financialMetrics.margin !== null &&
                      financialMetrics.margin < 0
                        ? "text-destructive"
                        : "text-green-500"
                    }`}
                  >
                    {financialMetrics.margin?.toFixed(0) ?? "-"}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ROI</p>
                  <p
                    className={`font-bold text-lg ${
                      financialMetrics.roi !== null && financialMetrics.roi < 0
                        ? "text-destructive"
                        : "text-green-500"
                    }`}
                  >
                    {financialMetrics.roi?.toFixed(0) ?? "-"}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-4">
          <div className="flex items-center space-x-2">
            <Label
              htmlFor={`listed-${copy.id}`}
              className="text-sm text-muted-foreground"
            >
              Listed
            </Label>
            <Switch
              id={`listed-${copy.id}`}
              checked={copy.isListed ?? false}
              onCheckedChange={(checked) =>
                handleToggleListed(book.id, copy.id, checked)
              }
              className="data-[state=checked]:bg-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditCopy(book, copy)}
            >
              <Pencil className="h-4 w-4 text-accent" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    this copy from your collection.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteCopy(book.id, copy.id)}
                    className="bg-destructive hover:bg-destructive/80"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (isLoading && books.length === 0) {
      return (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }

    if (books.length === 0 && !isLoading) {
      return (
        <div className="text-center py-20">
          <h3 className="font-headline text-2xl font-bold">
            Your Collection is Empty
          </h3>
          <p className="text-muted-foreground mt-2">
            Start by adding your first book using the lookup or manual entry.
          </p>
        </div>
      );
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <Accordion
          type="single"
          collapsible
          className="w-full space-y-4"
          value={openAccordionId}
          onValueChange={setOpenAccordionId}
        >
          <SortableContext
            items={displayedBooks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {displayedBooks.map((book) => (
              <SortableBookItem book={book} key={book.id} />
            ))}
          </SortableContext>
        </Accordion>
      </DndContext>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo className="h-8 w-8 text-accent" />
              <h1 className="font-headline text-2xl font-bold tracking-wider text-primary">
                SCRYVAULT
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-2">
                <Select value={lookupCountry} onValueChange={setLookupCountry}>
                  <SelectTrigger className="w-[90px]">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">USA</SelectItem>
                    <SelectItem value="GB">UK</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  placeholder="Enter ISBN-13..."
                  className="w-48"
                  value={lookupIsbn}
                  onChange={(e) => setLookupIsbn(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                />
                <Button
                  variant="outline"
                  className="border-accent text-accent hover:bg-accent/10 hover:text-accent"
                  onClick={() => handleLookup()}
                  disabled={isLookingUp}
                >
                  {isLookingUp ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BookUp className="mr-2 h-4 w-4" />
                  )}
                  Lookup
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-accent sm:hidden"
                onClick={() => setScannerOpen(true)}
              >
                <ScanLine />
              </Button>
              <Button
                className="bg-primary hover:bg-primary/80"
                onClick={() => setManualAddOpen(true)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add Manually</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <h2 className="font-headline text-3xl font-bold shrink-0">
            Your Collection
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto md:justify-end">
            <Input
              placeholder="Filter by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-40"
            />
            <Select value={sortOption} onValueChange={setSortOption}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Order</SelectItem>
                <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                <SelectItem value="year-newest">Year (Newest)</SelectItem>
                <SelectItem value="year-oldest">Year (Oldest)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2 p-2 rounded-md border border-input sm:border-none sm:p-0">
              <Switch
                id="show-listed"
                checked={showListedOnly}
                onCheckedChange={setShowListedOnly}
              />
              <Label htmlFor="show-listed" className="whitespace-nowrap">
                Listed only
              </Label>
            </div>
          </div>
        </div>
        {renderContent()}
      </main>

      <ManualAddModal
        isOpen={isManualAddOpen}
        onClose={handleManualAddClose}
        onSaveBook={editingBook ? handleUpdateBook : handleAddBook}
        initialData={initialBookData}
        isEditing={!!editingBook}
      />

      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      <AddCopyModal
        isOpen={isAddCopyOpen}
        onClose={() => {
          setAddCopyOpen(false);
          setIsDuplicateAdd(false);
        }}
        book={editingCopy?.book || addingCopyToBook}
        copy={editingCopy?.copy}
        onSave={handleSaveCopy}
        isDuplicateAdd={isDuplicateAdd}
      />
    </div>
  );
}
