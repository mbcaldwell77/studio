// Vercel SDK client setup
// Replace <YOUR_BEARER_TOKEN_HERE> with your actual token or use an environment variable for security
import { Vercel } from "@vercel/sdk";

const vercel = new Vercel({
  bearerToken: process.env.VERCEL_BEARER_TOKEN || "<YOUR_BEARER_TOKEN_HERE>",
});

export default vercel;
