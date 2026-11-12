import { JetBrains_Mono } from 'next/font/google';

/** The Studio's code face: editor, terminal, paths and tool calls. */
export const studioMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-studio-mono',
  display: 'swap',
});
