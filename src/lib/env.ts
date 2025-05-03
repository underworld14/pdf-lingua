/**
 * Environment variables configuration
 */

export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  LUMINA_API_KEY: process.env.LUMINA_API_KEY || '',
};

// Basic environment validation
export function validateEnv() {
  const requiredVars = ['OPENAI_API_KEY', 'LUMINA_API_KEY'];
  const missingVars = requiredVars.filter(varName => !env[varName as keyof typeof env]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Some features may not work correctly. Please check your .env file.');
    return false;
  }
  
  return true;
}
