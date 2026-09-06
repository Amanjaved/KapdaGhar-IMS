'use client';

import React, { useState, useEffect } from 'react';
import { Sale } from '@/types';
import { formatCurrency } from '@/lib/utils/currency';
import { Printer, CheckCircle2, MessageCircle, X, Plus, Share2, FileText, Download, Copy, Check, Phone, ImageIcon } from 'lucide-react';
import { generateReceiptImageBlob, shareReceiptImageToWhatsApp } from '@/lib/utils/receiptImage';

interface ReceiptModalProps {
  sale: Sale;
  onClose: () => void;
  onNewSale: () => void;
}

export function ReceiptModal({ sale, onClose, onNewSale }: ReceiptModalProps) {
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm' | 'a4'>('80mm');
  const [storeName, setStoreName] = useState(process.env.NEXT_PUBLIC_APP_NAME || 'Kapda Ghar');
  const [storePhone, setStorePhone] = useState(process.env.NEXT_PUBLIC_STORE_PHONE || '+91 98765 43210');
  const [storeAddress, setStoreAddress] = useState(process.env.NEXT_PUBLIC_STORE_ADDRESS || 'Main Market, New Delhi');
  const [customerPhone, setCustomerPhone] = useState((sale as any).customer_phone || '');
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem('kapda_ghar_printer_width') as '80mm' | '58mm' | 'a4' | null;
      if (savedWidth && ['80mm', '58mm', 'a4'].includes(savedWidth)) {
        setPaperWidth(savedWidth);
      }
      const savedName = localStorage.getItem('kapda_ghar_store_name');
      if (savedName) setStoreName(savedName);

      const savedPhone = localStorage.getItem('kapda_ghar_store_phone');
      if (savedPhone) setStorePhone(savedPhone);

      const savedAddress = localStorage.getItem('kapda_ghar_store_address');
      if (savedAddress) setStoreAddress(savedAddress);
    } catch (e) {}

    const handleStorageChange = () => {
      try {
        const savedWidth = localStorage.getItem('kapda_ghar_printer_width') as '80mm' | '58mm' | 'a4' | null;
        if (savedWidth && ['80mm', '58mm', 'a4'].includes(savedWidth)) {
          setPaperWidth(savedWidth);
        }
      } catch (e) {}
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleSelectPaperWidth = (width: '80mm' | '58mm' | 'a4') => {
    setPaperWidth(width);
    try {
      localStorage.setItem('kapda_ghar_printer_width', width);
    } catch (e) {}
  };

  const handlePrint = () => {
    // Create an isolated hidden iframe to guarantee clean 1-page printing with 100% visible text
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const dateFormatted = new Date(sale.created_at).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    let receiptHtml = '';

    if (paperWidth === 'a4') {
      // Formal A4 Tax Invoice Layout
      const itemRows = (sale.items || [])
        .map(
          (item, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 10px 8px; font-weight: 600; color: #0f172a;">${item.product_name}</td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${item.quantity}</td>
          <td style="padding: 10px 8px; text-align: right; color: #334155;">${formatCurrency(item.selling_price)}</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(item.subtotal)}</td>
        </tr>`
        )
        .join('');

      receiptHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Tax Invoice #${sale.receipt_number}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 15mm;
              }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #0f172a;
                background: #ffffff;
                font-size: 13px;
                line-height: 1.5;
                padding: 10px;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 16px;
                margin-bottom: 20px;
              }
              .store-name { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
              .store-meta { font-size: 12px; color: #475569; margin-top: 2px; }
              .invoice-meta { text-align: right; }
              .invoice-title { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: 1px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
              th {
                background: #f1f5f9;
                padding: 10px 8px;
                text-align: left;
                font-weight: 700;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 2px solid #cbd5e1;
              }
              .summary-box {
                margin-left: auto;
                width: 320px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                overflow: hidden;
              }
              .summary-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 14px;
                font-size: 13px;
                border-bottom: 1px solid #f1f5f9;
              }
              .summary-total {
                background: #0f172a;
                color: #ffffff;
                font-size: 16px;
                font-weight: 800;
                padding: 10px 14px;
              }
              .terms {
                margin-top: 40px;
                padding-top: 16px;
                border-top: 1px dashed #cbd5e1;
                font-size: 11px;
                color: #64748b;
                display: flex;
                justify-content: space-between;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="store-name">${storeName}</div>
                <div class="store-meta">${storeAddress}</div>
                <div class="store-meta">Phone: ${storePhone}</div>
              </div>
              <div class="invoice-meta">
                <div class="invoice-title">RETAIL CASH MEMO</div>
                <div style="font-size: 13px; font-weight: 600; margin-top: 4px;">Receipt #${sale.receipt_number}</div>
                <div style="font-size: 12px; color: #475569; margin-top: 2px;">Date: ${dateFormatted}</div>
                <div style="font-size: 12px; color: #475569;">Payment: <strong style="text-transform: uppercase;">${sale.payment_method}</strong></div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 8%; text-align: center;">#</th>
                  <th style="width: 48%;">Item Description</th>
                  <th style="width: 12%; text-align: center;">Qty</th>
                  <th style="width: 16%; text-align: right;">Rate</th>
                  <th style="width: 16%; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>

            <div class="summary-box">
              <div class="summary-row">
                <span style="color: #64748b;">Subtotal:</span>
                <span style="font-weight: 600;">${formatCurrency(sale.subtotal)}</span>
              </div>
              ${
                sale.discount > 0
                  ? `<div class="summary-row" style="color: #059669;">
                      <span>Discount:</span>
                      <span>-${formatCurrency(sale.discount)}</span>
                    </div>`
                  : ''
              }
              <div class="summary-row summary-total">
                <span>TOTAL PAID:</span>
                <span>${formatCurrency(sale.total)}</span>
              </div>
            </div>

            <div class="terms">
              <div>
                <p><strong>Terms & Conditions:</strong></p>
                <p>1. Goods once sold can be exchanged within 7 days with price tag attached.</p>
                <p>2. Please retain this invoice for any exchanges or warranty claims.</p>
              </div>
              <div style="text-align: right;">
                <p>Authorized Signatory</p>
                <p style="margin-top: 25px; font-weight: bold;">${storeName}</p>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      // Thermal Roll Formats (58mm or 80mm)
      const is58 = paperWidth === '58mm';
      const bodyWidth = is58 ? '52mm' : '76mm';
      const fontSize = is58 ? '9.5px' : '11px';
      const titleSize = is58 ? '13px' : '16px';
      const metaSize = is58 ? '9px' : '10.5px';
      const totalSize = is58 ? '12.5px' : '14px';

      const itemsRows = (sale.items || [])
        .map(
          (item) => `
          <tr>
            <td style="padding: 3px 0; font-weight: 600; text-align: left; vertical-align: top;">${item.product_name}</td>
            <td style="padding: 3px 2px; text-align: center; vertical-align: top;">${item.quantity}</td>
            <td style="padding: 3px 0; text-align: right; vertical-align: top;">${formatCurrency(item.selling_price)}</td>
            <td style="padding: 3px 0; text-align: right; font-weight: bold; vertical-align: top;">${formatCurrency(item.subtotal)}</td>
          </tr>`
        )
        .join('');

      const discountRow =
        sale.discount > 0
          ? `<tr>
              <td colspan="3" style="padding: 2px 0; text-align: left; color: #111;">Discount:</td>
              <td style="padding: 2px 0; text-align: right; color: #111;">-${formatCurrency(sale.discount)}</td>
            </tr>`
          : '';

      receiptHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Receipt #${sale.receipt_number}</title>
            <style>
              @page {
                size: ${is58 ? '58mm auto' : '80mm auto'};
                margin: 0;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              html, body {
                width: ${bodyWidth};
                margin: 0 auto;
                padding: ${is58 ? '4mm 2mm' : '6mm 4mm'};
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
                font-size: ${fontSize};
                line-height: ${is58 ? '1.25' : '1.35'};
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .center { text-align: center; }
              .right { text-align: right; }
              .bold { font-weight: bold; }
              .dashed-line {
                border-top: 1px dashed #000000;
                margin: 5px 0;
              }
              .store-title {
                font-size: ${titleSize};
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .sub-info {
                font-size: ${metaSize};
                color: #222222;
                margin-top: 1px;
              }
              .meta-row {
                display: flex;
                justify-content: space-between;
                font-size: ${fontSize};
                margin: 2px 0;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: ${fontSize};
              }
              th {
                border-bottom: 1px dashed #000000;
                padding: 3px 0;
                text-align: left;
                font-weight: 700;
                font-size: ${metaSize};
              }
              .total-row {
                display: flex;
                justify-content: space-between;
                font-size: ${totalSize};
                font-weight: 900;
                padding-top: 4px;
                border-top: 1px solid #000000;
                margin-top: 3px;
              }
            </style>
          </head>
          <body>
            <div class="center">
              <div class="store-title">${storeName}</div>
              <div class="sub-info">${storeAddress}</div>
              <div class="sub-info">Ph: ${storePhone}</div>
            </div>

            <div class="dashed-line"></div>

            <div class="meta-row">
              <span class="bold">Receipt:</span>
              <span class="bold">#${sale.receipt_number}</span>
            </div>
            <div class="meta-row">
              <span>Date:</span>
              <span>${dateFormatted}</span>
            </div>
            <div class="meta-row">
              <span>Payment Mode:</span>
              <span class="bold" style="text-transform: uppercase;">${sale.payment_method}</span>
            </div>

            <div class="dashed-line"></div>

            <table>
              <thead>
                <tr>
                  <th style="width: 44%;">Item</th>
                  <th style="width: 14%; text-align: center;">Qty</th>
                  <th style="width: 21%; text-align: right;">Rate</th>
                  <th style="width: 21%; text-align: right;">Amt</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="dashed-line"></div>

            <div class="meta-row">
              <span>Subtotal:</span>
              <span>${formatCurrency(sale.subtotal)}</span>
            </div>
            ${discountRow}

            <div class="total-row">
              <span>TOTAL PAID:</span>
              <span>${formatCurrency(sale.total)}</span>
            </div>

            <div class="dashed-line"></div>

            <div class="center" style="margin-top: 6px;">
              <div class="bold" style="font-size: ${metaSize};">Thank you for shopping with us!</div>
              <div style="font-size: 9px; color: #444; margin-top: 1px;">Please visit again</div>
            </div>
          </body>
        </html>
      `;
    }

    doc.open();
    doc.write(receiptHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        } catch (e) {}
      }, 2000);
    }, 200);
  };

  const handleShareImageWhatsApp = async () => {
    setIsSharingImage(true);
    setShareNotice(null);
    try {
      const res = await shareReceiptImageToWhatsApp(
        sale,
        { name: storeName, address: storeAddress, phone: storePhone },
        customerPhone
      );
      if (res.message) {
        setShareNotice(res.message);
        setTimeout(() => setShareNotice(null), 7000);
      }
    } catch (err: any) {
      setShareNotice('Failed to generate image. Please try again.');
      setTimeout(() => setShareNotice(null), 5000);
    } finally {
      setIsSharingImage(false);
    }
  };

  const handleDownloadReceiptImage = async () => {
    try {
      const blob = await generateReceiptImageBlob(sale, {
        name: storeName,
        address: storeAddress,
        phone: storePhone,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${sale.receipt_number}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setShareNotice('Receipt image downloaded to device!');
      setTimeout(() => setShareNotice(null), 4000);
    } catch (err) {
      console.error(err);
      setShareNotice('Failed to download receipt image.');
      setTimeout(() => setShareNotice(null), 4000);
    }
  };

  const handleCopyReceiptImage = async () => {
    try {
      const blob = await generateReceiptImageBlob(sale, {
        name: storeName,
        address: storeAddress,
        phone: storePhone,
      });
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
        setShareNotice('Receipt image copied to clipboard! Paste (Ctrl+V) in WhatsApp.');
        setTimeout(() => setShareNotice(null), 5000);
      } else {
        await handleDownloadReceiptImage();
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      await handleDownloadReceiptImage();
    }
  };

  const handleWhatsAppShare = () => {
    const itemsText = (sale.items || [])
      .map((item) => `• ${item.product_name} (${item.quantity}x) = ${formatCurrency(item.subtotal)}`)
      .join('\n');

    const isUdhar = sale.payment_method === 'udhar' || (sale.balance_due !== undefined && sale.balance_due > 0);
    const custHeader = sale.customer_name ? `Customer: *${sale.customer_name}*\n` : '';
    const paymentLine = isUdhar
      ? `Bill Total: ${formatCurrency(sale.total)}\n` +
        `Paid Now: ${formatCurrency(sale.paid_amount || 0)}\n` +
        `*BALANCE DUE (UDHAR):* *${formatCurrency(sale.balance_due || sale.total)}*\n`
      : `*TOTAL PAID:* *${formatCurrency(sale.total)}*\n`;

    const message =
      `*${storeName} — Sales Receipt*\n` +
      `--------------------------------\n` +
      `Receipt No: *#${sale.receipt_number}*\n` +
      `Date: ${new Date(sale.created_at).toLocaleString('en-IN')}\n` +
      custHeader +
      `--------------------------------\n` +
      `*Items:*\n${itemsText}\n\n` +
      `Subtotal: ${formatCurrency(sale.subtotal)}\n` +
      (sale.discount > 0 ? `Discount: -${formatCurrency(sale.discount)}\n` : '') +
      paymentLine +
      `Payment: ${sale.payment_method === 'udhar' ? 'UDHAR / CREDIT' : sale.payment_method.toUpperCase()}\n` +
      `--------------------------------\n` +
      `Thank you for shopping with us!`;

    const targetUrl = customerPhone
      ? `https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(targetUrl, '_blank');
  };

  // Card modal max width based on preset
  const modalContainerWidth =
    paperWidth === 'a4' ? 'max-w-2xl' : paperWidth === '58mm' ? 'max-w-xs' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div
        className={`relative w-full ${modalContainerWidth} max-h-[94vh] flex flex-col bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto transition-all duration-200`}
      >
        {/* Header Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#0b0f19]/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Sale Completed • #{sale.receipt_number}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Paper Width Preset Switcher Tabs in Modal */}
        <div className="px-4 sm:px-5 py-2 bg-slate-100/70 dark:bg-[#070b12] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Printer className="w-3 h-3" />
            <span>Format:</span>
          </span>
          <div className="flex items-center gap-1">
            {(
              [
                { id: '80mm', label: '80mm POS' },
                { id: '58mm', label: '58mm Mini' },
                { id: 'a4', label: 'A4 Sheet' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPaperWidth(p.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  paperWidth === p.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-[#0f1523] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Printable Receipt Paper (Dynamic on-screen preview) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white text-slate-900 shadow-inner" id="printable-receipt">
          {paperWidth === 'a4' ? (
            /* A4 Full Sheet Preview Layout */
            <div className="space-y-4 font-sans text-xs">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                <div>
                  <h2 className="text-lg font-black uppercase text-slate-950">{storeName}</h2>
                  <p className="text-[11px] text-slate-600">{storeAddress}</p>
                  <p className="text-[11px] text-slate-500">Ph: {storePhone}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block">
                    Retail Cash Memo
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-950 block mt-0.5">
                    #{sale.receipt_number}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {new Date(sale.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-[11px]">
                      <th className="py-1.5 px-2 text-left font-bold">Item Description</th>
                      <th className="py-1.5 px-2 text-center font-bold">Qty</th>
                      <th className="py-1.5 px-2 text-right font-bold">Rate</th>
                      <th className="py-1.5 px-2 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(sale.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-2 font-medium text-slate-900">{item.product_name}</td>
                        <td className="py-1.5 px-2 text-center font-mono">{item.quantity}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                          {formatCurrency(item.selling_price)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-950">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <div className="w-56 space-y-1 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatCurrency(sale.subtotal)}</span>
                  </div>
                  {sale.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatCurrency(sale.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-950 pt-1.5 border-t border-slate-300">
                    <span>TOTAL:</span>
                    <span className="font-mono text-indigo-700">{formatCurrency(sale.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Thermal Roll Layout (58mm or 80mm) */
            <div
              className={`font-mono ${
                paperWidth === '58mm' ? 'text-[10px] space-y-2' : 'text-xs space-y-3'
              }`}
            >
              {/* Header */}
              <div className="text-center pb-2.5 border-b border-dashed border-slate-300">
                <h2
                  className={`font-bold uppercase tracking-tight text-slate-950 ${
                    paperWidth === '58mm' ? 'text-sm' : 'text-base'
                  }`}
                >
                  {storeName}
                </h2>
                <p className="text-[10px] text-slate-600 mt-0.5">{storeAddress}</p>
                <p className="text-[10px] text-slate-500">Ph: {storePhone}</p>
              </div>

              {/* Receipt Info */}
              <div className="py-2 text-[10.5px] border-b border-dashed border-slate-300 space-y-0.5">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Receipt:</span>
                  <span>#{sale.receipt_number}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Date:</span>
                  <span>
                    {new Date(sale.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Payment Mode:</span>
                  <span className={`font-bold uppercase ${sale.payment_method === 'udhar' ? 'text-rose-600' : 'text-slate-800'}`}>
                    {sale.payment_method === 'udhar' ? 'UDHAR / CREDIT' : sale.payment_method}
                  </span>
                </div>
                {sale.customer_name && (
                  <div className="flex justify-between text-slate-600">
                    <span>Customer:</span>
                    <span className="font-bold text-slate-900">{sale.customer_name}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="py-2 border-b border-dashed border-slate-300">
                <table className="w-full text-[10.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="text-left py-1 font-semibold">Item</th>
                      <th className="text-center py-1 font-semibold">Qty</th>
                      <th className="text-right py-1 font-semibold">Rate</th>
                      <th className="text-right py-1 font-semibold">Amt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(sale.items || []).map((item, idx) => (
                      <tr key={idx} className="text-slate-800">
                        <td className="py-1 pr-1 font-medium">{item.product_name}</td>
                        <td className="py-1 text-center">{item.quantity}</td>
                        <td className="py-1 text-right">{formatCurrency(item.selling_price)}</td>
                        <td className="py-1 text-right font-bold">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="py-2 text-[10.5px] space-y-1 border-b border-dashed border-slate-300">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="tabular-nums">{formatCurrency(sale.subtotal)}</span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Discount:</span>
                    <span className="tabular-nums">-{formatCurrency(sale.discount)}</span>
                  </div>
                )}
                {sale.payment_method === 'udhar' || (sale.balance_due !== undefined && sale.balance_due > 0) ? (
                  <>
                    <div className="flex justify-between text-slate-700">
                      <span>Bill Total:</span>
                      <span className="tabular-nums font-semibold">{formatCurrency(sale.total)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>Paid Now:</span>
                      <span className="tabular-nums font-semibold">{formatCurrency(sale.paid_amount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-rose-600 pt-1 border-t border-slate-200">
                      <span>UDHAR DUE:</span>
                      <span className="text-base tabular-nums font-black">{formatCurrency(sale.balance_due || sale.total)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm font-bold text-slate-950 pt-1 border-t border-slate-200">
                    <span>TOTAL PAID:</span>
                    <span className="text-base tabular-nums">{formatCurrency(sale.total)}</span>
                  </div>
                )}
              </div>

              {/* Footer Note */}
              <div className="pt-2 text-center text-[10px] text-slate-500">
                <p className="font-medium">Thank you for your business!</p>
                <p className="mt-0.5">Please visit again</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 p-3 sm:p-4 bg-slate-50 dark:bg-[#0d1322] border-t border-slate-200 dark:border-slate-800 space-y-2.5 print:hidden">
          {/* WhatsApp Digital Receipt Image Section */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/25 border border-emerald-500/25 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>WhatsApp Receipt Image</span>
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                One-Tap Image Sharing
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type="tel"
                  placeholder="Customer WhatsApp # (e.g. 9876543210)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-9 pl-7 pr-2.5 text-xs bg-white dark:bg-[#0b0f19] border border-emerald-300 dark:border-emerald-800/80 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <Phone className="w-3.5 h-3.5 text-emerald-600/70 dark:text-emerald-400/70 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={handleShareImageWhatsApp}
                disabled={isSharingImage}
                title="Share Receipt Image directly to WhatsApp"
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{isSharingImage ? 'Preparing...' : 'Send Image'}</span>
              </button>

              <button
                onClick={handleDownloadReceiptImage}
                title="Download Receipt Image (PNG)"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleCopyReceiptImage}
                title="Copy Receipt Image to Clipboard"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {shareNotice && (
              <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 bg-white/80 dark:bg-emerald-900/40 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{shareNotice}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 h-10 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold text-xs transition-colors border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print ({paperWidth.toUpperCase()})</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-2 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Send Text Bill</span>
            </button>
          </div>

          <button
            onClick={onNewSale}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-[0.99] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Next Customer Sale</span>
          </button>
        </div>
      </div>
    </div>
  );
}
