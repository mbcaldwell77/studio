"use client"

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Book } from '@/lib/types'
import { useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { BookLookupOutput } from '@/ai/flows/lookup-book-flow'

interface ManualAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveBook: (book: Omit<Book, 'id' | 'copies' | 'sortIndex'>) => Promise<void>
  initialData?: BookLookupOutput | null
  isEditing?: boolean
}

const bookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  authors: z.string().min(1, 'Author is required'),
  publishedYear: z.preprocess(
    (val) => (String(val).trim() === '' ? null : Number(val)),
    z.number().int().min(1000).max(new Date().getFullYear()).nullable()
  ),
  publisher: z.string().optional(),
  binding: z.enum(['Hardcover', 'Paperback', 'Trade PB/Uk-B', 'Mass Market/UK-A', 'UK-C', 'Oversize/Softcover', 'specialty binding', 'other']),
  isbn: z.string().transform(val => val.replace(/[-/]/g, '')).refine((val) => {
    if (val.toUpperCase() === 'NA') return true;
    return (val.length === 10 && /^[0-9]{9}[0-9X]$/i.test(val)) ||
           (val.length === 13 && /^[0-9]{13}$/.test(val));
  }, {
    message: "Invalid ISBN. Must be 10 or 13 digits (X is allowed), or 'N/A'."
  }),
  coverUrl: z.string().url().optional().or(z.literal('')),
})

export function ManualAddModal({ isOpen, onClose, onSaveBook, initialData, isEditing }: ManualAddModalProps) {
  const { toast } = useToast()
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof bookSchema>>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      binding: 'Paperback',
      coverUrl: 'https://placehold.co/300x450.png',
      publisher: '',
      authors: '',
      title: '',
      isbn: '',
      publishedYear: new Date().getFullYear(),
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          ...initialData,
          authors: Array.isArray(initialData.authors) ? initialData.authors.join(', ') : (initialData.authors || ''),
          publisher: initialData.publisher || '',
          publishedYear: initialData.publishedYear ?? null,
          coverUrl: initialData.coverUrl || 'https://placehold.co/300x450.png'
        })
      } else {
        reset({
          title: '',
          authors: '',
          publishedYear: null,
          publisher: '',
          binding: 'Paperback',
          isbn: '',
          coverUrl: 'https://placehold.co/300x450.png',
        })
      }
    }
  }, [isOpen, initialData, reset])

  const onSubmit = async (data: z.infer<typeof bookSchema>) => {
    const newBookData = {
      ...data,
      authors: data.authors.split(',').map(a => a.trim()),
      coverUrl: data.coverUrl || 'https://placehold.co/300x450.png',
      publisher: data.publisher || '',
      publishedYear: data.publishedYear
    }
    try {
      await onSaveBook(newBookData)
      toast({ title: isEditing ? "Book updated!" : "Book added!", description: `"${data.title}" has been saved.` })
      onClose()
    } catch (e) {
      // The error toast is already handled in the parent component.
      // We just need to catch the error here so the form doesn't close.
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEditing ? 'Edit Book Details' : initialData ? 'Confirm Book Details' : 'Add a Book Manually'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details for this book.' : initialData ? 'We found this book based on the ISBN. Please confirm the details.' : 'Enter the details for your book. You can add copies later.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} disabled={isSubmitting} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="authors">Author(s)</Label>
            <Input id="authors" {...register('authors')} placeholder="Separate with commas" disabled={isSubmitting} />
            {errors.authors && <p className="text-sm text-destructive">{errors.authors.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publishedYear">Year</Label>
              <Input id="publishedYear" type="text" {...register('publishedYear')} placeholder="e.g. 1965" disabled={isSubmitting} />
              {errors.publishedYear && <p className="text-sm text-destructive">{errors.publishedYear.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher</Label>
              <Input id="publisher" {...register('publisher')} disabled={isSubmitting} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="binding">Binding</Label>
                <Controller
                  name="binding"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isSubmitting}>
                      <SelectTrigger id="binding">
                        <SelectValue placeholder="Select binding" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hardcover">Hardcover</SelectItem>
                        <SelectItem value="Paperback">Paperback</SelectItem>
                        <SelectItem value="Trade PB/Uk-B">Trade PB/Uk-B</SelectItem>
                        <SelectItem value="Mass Market/UK-A">Mass Market/UK-A</SelectItem>
                        <SelectItem value="UK-C">UK-C</SelectItem>
                        <SelectItem value="Oversize/Softcover">Oversize/Softcover</SelectItem>
                        <SelectItem value="specialty binding">Specialty Binding</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
             </div>
             <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input id="isbn" {...register('isbn')} placeholder="10 or 13 digits, or N/A" disabled={isSubmitting}/>
              {errors.isbn && <p className="text-sm text-destructive">{errors.isbn.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverUrl">Cover Image URL</Label>
            <Input id="coverUrl" {...register('coverUrl')} placeholder="https://..." disabled={isSubmitting} />
            {errors.coverUrl && <p className="text-sm text-destructive">{errors.coverUrl.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/80" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Book'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
