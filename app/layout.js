import "./globals.css";

export const metadata = {
  title: "Currency Agent",
  description: "A transparent currency-conversion agent flow",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
