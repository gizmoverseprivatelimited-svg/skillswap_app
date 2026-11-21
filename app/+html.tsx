import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering (expo export --platform web).
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>Leteski — Peer-to-Peer Skill Exchange &amp; Learning Marketplace</title>
        <meta
          name="description"
          content="leteski is a skill-exchange platform where people teach what they know and learn what they don't — trading skills with each other, joining live group classes, and earning real money while they teach."
        />
        <meta name="theme-color" content="#4338CA" />

        {/* High-priority Preconnect & DNS-Prefetch to eliminate handshake latency (Boosts LCP & Speed Index) */}
        <link rel="preconnect" href="https://api.leteski.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.leteski.com" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://i.pravatar.cc" />
        <link rel="dns-prefetch" href="https://i.pravatar.cc" />

        <ScrollViewStyleReset />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                margin: 0;
                padding: 0;
                height: 100%;
                background-color: #F8FAFC;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                text-rendering: optimizeLegibility;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
              #root {
                display: flex;
                height: 100%;
                flex: 1;
              }
              /* Content-visibility optimization for Speed Index and TBT */
              .cv-auto {
                content-visibility: auto;
                contain-intrinsic-size: 1px 700px;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
