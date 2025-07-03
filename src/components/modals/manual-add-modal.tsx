"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Book } from "@/lib/types";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { BookLookupOutput } from "@/ai/flows/lookup-book-flow";

interface ManualAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBook: (
    book: Omit<Book, "id" | "copies" | "sortIndex">
  ) => Promise<void>;
  initialData?: BookLookupOutput | null;
  isEditing?: boolean;
}

// In form schema and default values, use authors as string (for input), but convert to array for Book type
const bookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  authors: z.string().min(1, "At least one author is required"), // comma-separated in input
  year: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().nullable()
  ),
  publisher: z.string().optional(),
  binding: z.string().optional(),
  isbn: z.string().optional(),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  sort_index: z
    .preprocess(
      (val) =>
        val === undefined || val === null || val === "" ? 0 : Number(val),
      z.number()
    )
    .optional(),
});

export function ManualAddModal({
  isOpen,
  onClose,
  onSaveBook,
  initialData,
  isEditing,
}: ManualAddModalProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof bookSchema>>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      binding: "Paperback",
      cover_image_url: "https://placehold.co/300x450.png",
      publisher: "",
      authors: "",
      title: "",
      isbn: "",
      year: new Date().getFullYear(),
      sort_index: 0,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          ...initialData,
          authors: Array.isArray(initialData.authors)
            ? initialData.authors.join(", ")
            : initialData.authors || "",
          year:
            (initialData as any).year ??
            (initialData as any).publishedYear ??
            null,
          cover_image_url:
            initialData.coverUrl || "https://placehold.co/300x450.png",
          publisher: initialData.publisher || "",
          sort_index: (initialData as any).sort_index ?? 0,
        });
      } else {
        reset({
          title: "",
          authors: "",
          year: null,
          publisher: "",
          binding: "Paperback",
          isbn: "",
          cover_image_url: "https://placehold.co/300x450.png",
          sort_index: 0,
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const onSubmit = async (data: z.infer<typeof bookSchema>) => {
    const authorsArray = data.authors
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    const bookToSave = {
      ...data,
      authors: authorsArray,
      sort_index: data.sort_index ?? 0,
      publisher: data.publisher ?? "",
      binding: data.binding ?? "",
      isbn: data.isbn ?? "",
      cover_image_url: data.cover_image_url ?? "",
    };
    try {
      await onSaveBook(bookToSave);
      toast({
        title: isEditing ? "Book updated!" : "Book added!",
        description: `"${data.title}" has been saved.`,
      });
      onClose();
    } catch (e) {
      // The error toast is already handled in the parent component.
      // We just need to catch the error here so the form doesn't close.
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {isEditing
              ? "Edit Book Details"
              : initialData
              ? "Confirm Book Details"
              : "Add a Book Manually"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details for this book."
              : initialData
              ? "We found this book based on the ISBN. Please confirm the details."
              : "Enter the details for your book. You can add copies later."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} disabled={isSubmitting} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="authors">Author(s)</Label>
            <Input
              id="authors"
              {...register("authors")}
              placeholder="Separate with commas"
              disabled={isSubmitting}
            />
            {errors.authors && (
              <p className="text-sm text-destructive">
                {errors.authors.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="text"
                {...register("year")}
                placeholder="e.g. 1965"
                disabled={isSubmitting}
              />
              {errors.year && (
                <p className="text-sm text-destructive">
                  {errors.year.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher</Label>
              <Input
                id="publisher"
                {...register("publisher")}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="binding">Binding</Label>
              <Controller
                name="binding"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="binding">
                      <SelectValue placeholder="Select binding" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hardcover">Hardcover</SelectItem>
                      <SelectItem value="Paperback">Paperback</SelectItem>
                      <SelectItem value="Trade PB/Uk-B">
                        Trade PB/Uk-B
                      </SelectItem>
                      <SelectItem value="Mass Market/UK-A">
                        Mass Market/UK-A
                      </SelectItem>
                      <SelectItem value="UK-C">UK-C</SelectItem>
                      <SelectItem value="Oversize/Softcover">
                        Oversize/Softcover
                      </SelectItem>
                      <SelectItem value="specialty binding">
                        Specialty Binding
                      </SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input
                id="isbn"
                {...register("isbn")}
                placeholder="10 or 13 digits, or N/A"
                disabled={isSubmitting}
              />
              {errors.isbn && (
                <p className="text-sm text-destructive">
                  {errors.isbn.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cover_image_url">Cover Image URL</Label>
            <Input
              id="cover_image_url"
              {...register("cover_image_url")}
              placeholder="https://..."
              disabled={isSubmitting}
            />
            {errors.cover_image_url && (
              <p className="text-sm text-destructive">
                {errors.cover_image_url.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/80"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Add Book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
