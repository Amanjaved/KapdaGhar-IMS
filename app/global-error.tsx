'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>Application Error — Kapda Ghar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{
        margin: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#0b0f19',
        color: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '1.5rem',
        boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            color: '#fb7185',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            fontSize: '24px'
          }}>
            ⚠
          </div>
          <span style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '3px 10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            color: '#fb7185',
            marginBottom: '0.75rem'
          }}>
            Critical System Interruption
          </span>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 0.5rem'
          }}>
            Kapda Ghar POS System
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#94a3b8',
            lineHeight: 1.5,
            margin: '0 0 1.5rem'
          }}>
            A root-level exception occurred. Your stored offline inventory and register data are safe in your browser.
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <button
              onClick={() => reset()}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                backgroundColor: '#6366f1',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Restart Application
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: '1px solid #334155',
                cursor: 'pointer'
              }}
            >
              Return to Store Dashboard
            </button>
          </div>

          {error?.message && (
            <div style={{
              marginTop: '1.5rem',
              padding: '0.75rem',
              backgroundColor: '#020617',
              borderRadius: '8px',
              border: '1px solid #1e293b',
              textAlign: 'left',
              fontSize: '11px',
              color: '#fda4af',
              fontFamily: 'monospace',
              wordBreak: 'break-all'
            }}>
              {error.message}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
