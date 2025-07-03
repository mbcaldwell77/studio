
'use server';
/**
 * @fileOverview A flow to look up book metadata by ISBN.
 *
 * - lookupBook - A function that fetches book details for a specific country.
 * - BookLookupOutput - The return type for the lookupBook function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const BookLookupOutputSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  publishedYear: z.number().int().optional().nullable(),
  publisher: z.string().nullable().optional(),
  binding: z.enum(['Hardcover', 'Paperback', 'Trade PB/Uk-B', 'Mass Market/UK-A', 'UK-C', 'Oversize/Softcover', 'specialty binding', 'other']),
  isbn: z.string(),
  coverUrl: z.string().url().optional(),
});
export type BookLookupOutput = z.infer<typeof BookLookupOutputSchema>;

const fetchBookDataByIsbn = ai.defineTool(
  {
    name: 'fetchBookDataByIsbn',
    description: 'Fetches book data from the Google Books API using its ISBN and an optional country code.',
    inputSchema: z.object({
      isbn: z.string(),
      country: z.string().optional().describe('An ISO 3166-1 alpha-2 country code (e.g., US, GB, CA).')
    }),
    outputSchema: z.any(),
  },
  async ({ isbn, country }) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Google API key is missing.');
      throw new Error('The book lookup service is not configured. The GOOGLE_API_KEY is missing from the .env file.');
    }
    
    const countryCode = country || 'US';
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=${countryCode}&key=${apiKey}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        let errorMsg = `Google Books API request failed with status: ${response.status}`;
        try {
            const errorData = await response.json();
            console.error("Google Books API error:", errorData);
            if (errorData?.error?.message) {
                if (errorData.error.message.includes('location')) {
                    errorMsg = "Cannot determine user location for a geographically restricted operation. Please specify a country for the search.";
                } else {
                    errorMsg += `. Message: ${errorData.error.message}`;
                }
            }
             if (response.status === 403) {
                errorMsg += " This may be due to an incorrect API key, or the key may not have the 'Google Books API' enabled in your Google Cloud project.";
            }
        } catch (jsonError) {
            const textError = await response.text();
            console.error("Google Books API non-JSON error:", textError);
        }
        throw new Error(errorMsg);
      }
      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        throw new Error(`No book found for this ISBN in the ${countryCode} catalog.`);
      }
      return data.items[0].volumeInfo;
    } catch (e: any) {
      throw new Error(`Failed to fetch book data: ${e.message}`);
    }
  }
);

const lookupBookPrompt = ai.definePrompt({
  name: 'lookupBookPrompt',
  tools: [fetchBookDataByIsbn],
  input: { schema: z.object({ isbn: z.string(), country: z.string().optional() }) },
  output: { schema: BookLookupOutputSchema },
  prompt: `
    You are a book cataloging expert. Your job is to find book data and format it correctly.
    
    1. Use the 'fetchBookDataByIsbn' tool with the provided ISBN ('{{{isbn}}}') and country code ('{{{country}}}').
    2. Analyze the returned data.
    3. Format the data into the required JSON output structure.
    
    IMPORTANT: If a piece of information is not available in the tool's output, OMIT the corresponding key from your JSON response.
    
    - For 'publisher', use the 'publisher' field. If it is not available, omit the 'publisher' key.
    - For 'publishedYear', extract only the year from the 'publishedDate' field. If it is not available, omit the 'publishedYear' key.
    - For 'isbn', look in the 'industryIdentifiers' list from the tool's response. You MUST prioritize the identifier with type 'ISBN_13'. If no 'ISBN_13' is found, use the identifier with type 'ISBN_10'. If neither is found, use the original ISBN '{{{isbn}}}' that was provided for the search.
    - For 'binding', infer the most likely binding type. Choose from: 'Hardcover', 'Paperback', 'Trade PB/Uk-B', 'Mass Market/UK-A', 'UK-C', 'Oversize/Softcover', 'specialty binding', 'other'. Default to 'Paperback' if unsure.
    - For 'coverUrl', use 'imageLinks.thumbnail' or 'imageLinks.smallThumbnail'. If unavailable, omit the 'coverUrl' key.
  `,
});

const lookupBookFlow = ai.defineFlow(
  {
    name: 'lookupBookFlow',
    inputSchema: z.object({ isbn: z.string(), country: z.string().optional() }),
    outputSchema: BookLookupOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await lookupBookPrompt(input);
        if (!output) {
            throw new Error("Could not retrieve book data. The AI model did not return valid information. This can happen if the book is not found or the ISBN is incorrect.");
        }
        return output;
    } catch (e: any) {
        console.error("Full error during lookup:", e);
        if (e.message) {
            if (e.message.includes("API key not valid") || (e.message.includes("permission") && e.message.includes("denied")) || e.message.includes("API key is invalid")) {
                throw new Error("Failed to connect to the AI service. Please ensure your GOOGLE_API_KEY is correct and has the 'Generative Language API' enabled in your Google Cloud project. Then, restart the server.");
            }
            if (e.message.includes("Google Books API")) {
                 throw new Error(e.message);
            }
        }
        throw new Error(e.message || "An unknown error occurred during the lookup.");
    }
  }
);

export async function lookupBook(isbn: string, country?: string): Promise<BookLookupOutput> {
  if (!process.env.GOOGLE_API_KEY) {
     throw new Error("The application is not configured. The GOOGLE_API_KEY is missing from the .env file. Please ensure the key is set and that it has both 'Google Books API' and 'Generative Language API' enabled in your Google Cloud project.");
  }
  return lookupBookFlow({ isbn, country });
}
