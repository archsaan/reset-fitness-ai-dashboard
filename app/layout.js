import "./globals.css";

export const metadata = {
  title: "Reset Fitness — Agent Dashboard",
  description: "Manage AI agents, knowledge bases, and prompts for Reset Fitness.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
