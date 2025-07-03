"use client"

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from '@/components/ui/date-picker'
import type { Book, Copy } from '@/lib/types'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { getMarketPrice } from '@/ai/flows/get-market-price-flow'
import { Loader2, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface AddCopyModalProps {
  isOpen: boolean
  onClose: () => void
  book: Book | null
  copy?: Copy | null
  onSave: (bookId: string, copy: Copy) => void
  isDuplicateAdd?: boolean
}

const copySchema = z.object({
  condition: z.enum(['Brand New', 'Like New', 'Very Good', 'Good', 'Acceptable']),
  purchasePrice: z.string()
    .transform((val, ctx) => {
      if (val === '' || val === null) return null;
      const parsed = parseFloat(val);
      if (isNaN(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid number' });
        return z.NEVER;
      }
      return parsed;
    })
    .pipe(z.number().nonnegative("Price cannot be negative.").nullable()),
  marketPrice: z.string()
    .transform((val, ctx) => {
      if (val === '' || val === null) return null;
      const parsed = parseFloat(val);
      if (isNaN(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid number' });
        return z.NEVER;
      }
      return parsed;
    })
    .pipe(z.number().nonnegative("Price cannot be negative.").nullable()),
  purchaseDate: z.date().nullable(),
  purchaseLocation: z.string().optional(),
  notes: z.string().optional(),
  isListed: z.boolean(),
});

type CopyFormInput = z.input<typeof copySchema>;
type CopyFormOutput = z.output<typeof copySchema>;


export function AddCopyModal({ isOpen, onClose, book, copy, onSave, isDuplicateAdd }: AddCopyModalProps) {
  const { toast } = useToast()
  const { register, handleSubmit, control, reset, setValue, getValues, watch, formState: { errors } } = useForm<CopyFormInput>({
    resolver: zodResolver(copySchema),
    defaultValues: {
      isListed: false,
      purchasePrice: '',
      marketPrice: '',
      purchaseDate: null,
      purchaseLocation: '',
      notes: '',
      condition: 'Good',
    }
  })
  const [isSuggestingPrice, setIsSuggestingPrice] = useState(false)

  const watchedCondition = watch('condition');
  const watchedPurchasePrice = watch('purchasePrice');
  const watchedMarketPrice = watch('marketPrice');

  const handleSuggestPrice = useCallback(async (condition: string) => {
    if (!book) return;
    setIsSuggestingPrice(true);
    try {
      const result = await getMarketPrice({
        title: book.title,
        authors: book.authors,
        isbn: book.isbn,
        condition,
      });
      setValue('marketPrice', String(result.marketPrice.toFixed(2)), { shouldValidate: true });
    } catch (error) {
      console.error('Failed to suggest price:', error);
      toast({ title: 'Error Suggesting Price', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsSuggestingPrice(false);
    }
  }, [book, setValue, toast]);

  useEffect(() => {
    if (isOpen) {
      if (copy) {
        reset({
          condition: copy.condition,
          purchasePrice: copy.purchasePrice !== null && copy.purchasePrice !== undefined ? String(copy.purchasePrice) : '',
          marketPrice: copy.marketPrice !== null && copy.marketPrice !== undefined ? String(copy.marketPrice) : '',
          purchaseDate: copy.purchaseDate,
          purchaseLocation: copy.purchaseLocation,
          notes: copy.notes,
          isListed: copy.isListed,
        });
      } else {
        // For new copies, reset and fetch price for default condition
        reset({
          condition: 'Good',
          purchasePrice: '',
          marketPrice: '',
          purchaseDate: null,
          purchaseLocation: '',
          notes: '',
          isListed: false,
        });
        handleSuggestPrice('Good');
      }
    }
  }, [isOpen, copy, reset, handleSuggestPrice]);

  // Re-suggest price when the user changes the condition
  useEffect(() => {
      if (isOpen && book && watchedCondition) {
          if (!copy || (copy && watchedCondition !== copy.condition)) {
             handleSuggestPrice(watchedCondition);
          }
      }
  }, [watchedCondition, isOpen, book, copy, handleSuggestPrice]);
  
  const financialMetrics = useMemo(() => {
    const p = parseFloat(watchedPurchasePrice as string);
    const m = parseFloat(watchedMarketPrice as string);

    if (isNaN(p) || isNaN(m) || m === null || p === null) {
        return { pnl: null, margin: null, roi: null };
    }

    const pnl = m - p;
    const margin = m > 0 ? (pnl / m) * 100 : 0;
    const roi = p > 0 ? (pnl / p) * 100 : null; // ROI is infinite/undefined if purchase price is 0

    return { pnl, margin, roi };
  }, [watchedPurchasePrice, watchedMarketPrice]);


  const onSubmit = (data: CopyFormOutput) => {
    if (!book) return
    
    const newCopy: Copy = {
      id: copy?.id || Date.now().toString(),
      ...data,
      purchasePrice: data.purchasePrice,
      marketPrice: data.marketPrice,
      purchaseLocation: data.purchaseLocation || '',
      notes: data.notes || '',
    }

    onSave(book.id, newCopy)
    toast({ title: "Copy saved!", description: `The copy for "${book.title}" has been saved.` })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{copy ? 'Edit Copy' : 'Add New Copy'}</DialogTitle>
          <DialogDescription>For {book?.title}</DialogDescription>
        </DialogHeader>
        
        {isDuplicateAdd && (
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Book Already in Collection</AlertTitle>
                <AlertDescription>
                    This book is already in your inventory. Please add the details for the new copy.
                </AlertDescription>
            </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Controller
              name="condition"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                  <SelectTrigger id="condition">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Brand New', 'Like New', 'Very Good', 'Good', 'Acceptable'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
             {errors.condition && <p className="text-sm text-destructive">{errors.condition.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
              <Input id="purchasePrice" type="number" step="0.01" {...register('purchasePrice')} placeholder="e.g. 19.99" />
               {errors.purchasePrice && <p className="text-sm text-destructive">{errors.purchasePrice.message}</p>}
            </div>
            <div className="space-y-2">
               <div className="flex items-center justify-between">
                <Label htmlFor="marketPrice">Market Price ($)</Label>
                {isSuggestingPrice && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <Input id="marketPrice" type="number" step="0.01" {...register('marketPrice')} placeholder={isSuggestingPrice ? "Suggesting..." : "e.g. 29.99"} />
               {errors.marketPrice && <p className="text-sm text-destructive">{errors.marketPrice.message}</p>}
            </div>
          </div>
          
           {(financialMetrics.pnl !== null || financialMetrics.margin !== null || financialMetrics.roi !== null) && (
              <div className="p-3 rounded-md border bg-muted/50 space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Profitability Analysis</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">P/L</p>
                    <p className={`font-bold text-lg ${financialMetrics.pnl !== null && financialMetrics.pnl < 0 ? 'text-destructive' : 'text-green-500'}`}>
                      ${financialMetrics.pnl?.toFixed(2) ?? '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Margin</p>
                    <p className={`font-bold text-lg ${financialMetrics.margin !== null && financialMetrics.margin < 0 ? 'text-destructive' : 'text-green-500'}`}>
                      {financialMetrics.margin?.toFixed(0) ?? '-'}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p className={`font-bold text-lg ${financialMetrics.roi !== null && financialMetrics.roi < 0 ? 'text-destructive' : 'text-green-500'}`}>
                      {financialMetrics.roi?.toFixed(0) ?? '-'}%
                    </p>
                  </div>
                </div>
              </div>
            )}


          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Controller
                    name="purchaseDate"
                    control={control}
                    render={({ field }) => (
                        <DatePicker value={field.value || undefined} onChange={field.onChange} />
                    )}
                />
                 {errors.purchaseDate && <p className="text-sm text-destructive">{errors.purchaseDate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchaseLocation">Purchase Location</Label>
                <Input id="purchaseLocation" {...register('purchaseLocation')} placeholder="e.g. Amazon, Bookstore" />
              </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} placeholder="e.g. First edition, signed copy..." />
          </div>
          <div className="flex items-center space-x-2">
            <Controller
              name="isListed"
              control={control}
              render={({ field }) => (
                <Switch id="isListed" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="isListed">Is this copy listed for sale?</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/80">Save Copy</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
