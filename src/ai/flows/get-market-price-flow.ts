
'use server';
/**
 * @fileOverview A flow to estimate the market price of a book.
 *
 * - getMarketPrice - A function that suggests a market price for a book.
 * - GetMarketPriceInput - The input type for the getMarketPrice function.
 * - GetMarketPriceOutput - The return type for the getMarketPrice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const GetMarketPriceInputSchema = z.object({
  title: z.string().describe('The title of the book.'),
  authors: z.array(z.string()).describe('The authors of the book.'),
  isbn: z.string().describe('The ISBN of the book.'),
  condition: z.enum(['Brand New', 'Like New', 'Very Good', 'Good', 'Acceptable']).describe('The condition of the book.'),
});
export type GetMarketPriceInput = z.infer<typeof GetMarketPriceInputSchema>;

const GetMarketPriceOutputSchema = z.object({
  marketPrice: z.number().describe('The estimated market price in USD.'),
});
export type GetMarketPriceOutput = z.infer<typeof GetMarketPriceOutputSchema>;


export async function getMarketPrice(input: GetMarketPriceInput): Promise<GetMarketPriceOutput> {
  return getMarketPriceFlow(input);
}

const marketPricePrompt = ai.definePrompt({
  name: 'marketPricePrompt',
  input: { schema: GetMarketPriceInputSchema },
  output: { schema: GetMarketPriceOutputSchema },
  prompt: `
    You are an expert book appraiser. Your task is to estimate the current average market price for a used copy of a book in "{{{condition}}}" condition, based on listings from popular online marketplaces like eBay, AbeBooks, and Amazon.

    Book Details:
    - Title: {{{title}}}
    - Author(s): {{#each authors}}{{{this}}}{{/each}}
    - ISBN: {{{isbn}}}

    Provide your price estimate in USD. Respond only with the structured JSON output.
  `,
});


const getMarketPriceFlow = ai.defineFlow(
  {
    name: 'getMarketPriceFlow',
    inputSchema: GetMarketPriceInputSchema,
    outputSchema: GetMarketPriceOutputSchema,
  },
  async (input) => {
    const { output } = await marketPricePrompt(input);
    return output!;
  }
);
