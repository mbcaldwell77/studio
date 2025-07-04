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
import { getMarketPrice } from '@/ai/flows/get-market-price-flow' // Import getMarketPrice
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

// Define the allowed condition values as a constant array
const VALID_CONDITIONS = ['Brand New', 'Like New', 'Very Good', 'Good', 'Acceptable'] as const;
// Infer the type from the constant array for stronger type checking
type ConditionType = typeof VALID_CONDITIONS[number];

const copySchema = z.object({
  condition: z.enum(VALID_CONDITIONS), // Use the constant array for the enum
  purchasePrice: z.string() // Input is string
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
  marketPrice: z.string() // Input is string
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
  purchaseDate: z.date().nullable(), // Expects Date object, or null
  purchaseLocation: z.string().optional(),
  notes: z.string().optional(),
  isListed: z.boolean(),
});

type CopyFormInput = z.input<typeof copySchema>; // Type for form inputs (before transform)
type CopyFormOutput = z.output<typeof copySchema>; // Type for form output (after transform)


export function AddCopyModal({ isOpen, onClose, book, copy, onSave, isDuplicateAdd }: AddCopyModalProps) {
  const { toast } = useToast()
  // Explicitly define the generic types for useForm:
  // 1. TFieldValues: CopyFormInput (the shape of the raw form data)
  // 2. TContext: any (or undefined if not used)
  // 3. TTransformedValues: CopyFormOutput (the shape of the data after resolver transforms)
  const { register, handleSubmit, control, reset, setValue, getValues, watch, formState: { errors } } = useForm<CopyFormInput, any, CopyFormOutput>({
    // Cast the zodResolver to ensure it matches the TFieldValues type expected by useForm
    resolver: zodResolver(copySchema) as any, // Temporarily cast to any to bypass the deep type checking
    defaultValues: {
      isListed: false,
      purchasePrice: '', // Default to empty string for input type (CopyFormInput)
      marketPrice: '',    // Default to empty string for input type (CopyFormInput)
      purchaseDate: null,
      purchaseLocation: '',
      notes: '',
      condition: 'Good', // Default condition
    }
  })
  const [isSuggestingPrice, setIsSuggestingPrice] = useState(false)

  // watch returns the raw input value, which is CopyFormInput
  const watchedCondition = watch('condition');
  const watchedPurchasePrice = watch('purchasePrice'); // This will be a string
  const watchedMarketPrice = watch('marketPrice');     // This will be a string

  // Updated handleSuggestPrice to accept ConditionType
  const handleSuggestPrice = useCallback(async (condition: ConditionType) => {
    if (!book) return;
    setIsSuggestingPrice(true);
    try {
      const result = await getMarketPrice({
        title: book.title,
        authors: book.authors,
        isbn: book.isbn,
        condition, // This 'condition' is now correctly typed as ConditionType
      });
      // setValue for 'marketPrice' needs to be a string because the form's TFieldValues is CopyFormInput
      // The Input component expects a string value.
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
        // When editing an existing copy, populate form fields
        // Ensure copy.condition is one of the VALID_CONDITIONS, otherwise default to 'Good'
        const safeCondition: ConditionType = VALID_CONDITIONS.includes(copy.condition as ConditionType)
          ? copy.condition as ConditionType
          : 'Good';

        reset({
          condition: safeCondition,
          // Convert number | null to string for input fields when resetting (CopyFormInput)
          purchasePrice: copy.purchasePrice !== null && copy.purchasePrice !== undefined ? String(copy.purchasePrice) : '',
          marketPrice: copy.marketPrice !== null && copy.marketPrice !== undefined ? String(copy.marketPrice) : '',
          purchaseDate: copy.purchaseDate, // purchaseDate is already a Date object or null
          purchaseLocation: copy.purchaseLocation,
          notes: copy.notes,
          isListed: copy.isListed,
        });
      } else {
        // For new copies, reset and fetch price for default condition
        reset({
          condition: 'Good',
          purchasePrice: '', // Initialize with empty string for input type (CopyFormInput)
          marketPrice: '',    // Initialize with empty string for input type (CopyFormInput)
          purchaseDate: null,
          purchaseLocation: '',
          notes: '',
          isListed: false,
        });
        // Call handleSuggestPrice with a valid ConditionType
        handleSuggestPrice('Good');
      }
    }
  }, [isOpen, copy, reset, handleSuggestPrice]);

  // Re-suggest price when the user changes the condition
  useEffect(() => {
      if (isOpen && book && watchedCondition) {
          // Only suggest if it's a new copy or if the condition has actually changed for an existing copy
          if (!copy || (copy && watchedCondition !== copy.condition)) {
             handleSuggestPrice(watchedCondition); // watchedCondition is already ConditionType
          }
      }
  }, [watchedCondition, isOpen, book, copy, handleSuggestPrice]);
  
  const financialMetrics = useMemo(() => {
    // watchedPurchasePrice and watchedMarketPrice here are the raw string values from the input.
    // We need to parse them to numbers for calculations.
    const p = parseFloat(watchedPurchasePrice);
    const m = parseFloat(watchedMarketPrice);

    if (isNaN(p) || isNaN(m) || m === null || p === null) {
        return { pnl: null, margin: null, roi: null };
    }

    const pnl = m - p;
    const margin = m > 0 ? (pnl / m) * 100 : 0;
    const roi = p > 0 ? (pnl / p) * 100 : null; // ROI is infinite/undefined if purchase price is 0

    return { pnl, margin, roi };
  }, [watchedPurchasePrice, watchedMarketPrice]);


  // The 'data' received here is correctly typed as CopyFormOutput due to the TTransformedValues generic
  const onSubmit = (data: CopyFormOutput) => {
    if (!book) return
    
    const newCopy: Copy = {
      id: copy?.id || Date.now().toString(), // Use existing ID if editing, otherwise generate new
      bookId: book.id, // Ensure bookId is set
      sortIndex: copy?.sortIndex ?? 0, // IMPORTANT: Add sortIndex here, defaulting to 0 if new
      ...data,
      // No need for explicit conversion here as data.purchasePrice and data.marketPrice are already numbers
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
                    {VALID_CONDITIONS.map(c => ( // Use the constant array here
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
              {/* Input type="number" with register will handle string to number conversion on change */}
              <Input id="purchasePrice" type="number" step="0.01" {...register('purchasePrice')} placeholder="e.g. 19.99" />
               {errors.purchasePrice && <p className="text-sm text-destructive">{errors.purchasePrice.message}</p>}
            </div>
            <div className="space-y-2">
               <div className="flex items-center justify-between">
                <Label htmlFor="marketPrice">Market Price ($)</Label>
                {isSuggestingPrice && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {/* Input type="number" with register will handle string to number conversion on change */}
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
