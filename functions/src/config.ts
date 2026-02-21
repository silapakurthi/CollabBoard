/**
 * Centralized configuration for all environment variables.
 * Firebase automatically loads functions/.env at runtime.
 */
export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  langfuse: {
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    host: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
  },
};
