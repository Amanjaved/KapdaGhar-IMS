import { Sale } from '@/types';
import { formatCurrency } from './currency';

export interface StoreInfo {
  name: string;
  address: string;
  phone: string;
}

/**
 * Renders a pixel-perfect, crisp receipt onto an HTML5 canvas and returns a PNG Blob
 */
export async function generateReceiptImageBlob(
  sale: Sale,
  storeInfo: StoreInfo
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  // High-DPI 2x scale for ultra-crisp display on smartphones & Retina screens
  const scale = 2;
  const width = 440; // Base logical width (matches 80mm thermal receipt look)
  
  // Calculate dynamic height
  const items = sale.items || [];
  const isUdhar = sale.payment_method === 'udhar' || (sale.balance_due !== undefined && sale.balance_due > 0);
  const baseHeaderHeight = sale.customer_name ? 180 : 160;
  const itemRowHeight = 26;
  const itemsHeight = Math.max(items.length, 1) * itemRowHeight;
  const totalsHeight = (sale.discount > 0 ? 30 : 0) + (isUdhar ? 135 : 88);
  const footerHeight = 70;
  const totalLogicalHeight = baseHeaderHeight + itemsHeight + totalsHeight + footerHeight;

  canvas.width = width * scale;
  canvas.height = totalLogicalHeight * scale;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalLogicalHeight);

  // Subtle outer paper receipt border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, width - 8, totalLogicalHeight - 8);

  const fontMono = '"JetBrains Mono", "Courier New", Courier, monospace';
  const padX = 24;
  let y = 30;

  // Helper for drawing dashed line
  const drawDashedLine = (currY: number) => {
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padX, currY);
    ctx.lineTo(width - padX, currY);
    ctx.stroke();
    ctx.restore();
  };

  // 1. Store Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 19px ${fontMono}`;
  ctx.fillText(storeInfo.name.toUpperCase(), width / 2, y);

  y += 18;
  ctx.fillStyle = '#475569';
  ctx.font = `11px ${fontMono}`;
  ctx.fillText(storeInfo.address, width / 2, y);

  y += 16;
  ctx.fillText(`Ph: ${storeInfo.phone}`, width / 2, y);

  // Divider
  y += 16;
  drawDashedLine(y);

  // 2. Receipt Meta Section
  y += 18;
  ctx.font = `11px ${fontMono}`;
  ctx.fillStyle = '#0f172a';

  // Receipt #
  ctx.textAlign = 'left';
  ctx.font = `bold 11px ${fontMono}`;
  ctx.fillText('Receipt:', padX, y);
  ctx.textAlign = 'right';
  ctx.fillText(`#${sale.receipt_number}`, width - padX, y);

  // Date
  y += 18;
  ctx.textAlign = 'left';
  ctx.font = `11px ${fontMono}`;
  ctx.fillStyle = '#475569';
  ctx.fillText('Date:', padX, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#1e293b';
  const dateFormatted = new Date(sale.created_at).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  ctx.fillText(dateFormatted, width - padX, y);

  // Payment Mode
  y += 18;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.fillText('Payment Mode:', padX, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = isUdhar ? '#e11d48' : '#0f172a';
  ctx.font = `bold 11px ${fontMono}`;
  ctx.fillText(sale.payment_method === 'udhar' ? 'UDHAR / CREDIT' : sale.payment_method.toUpperCase(), width - padX, y);

  // Customer Name if attached
  if (sale.customer_name) {
    y += 18;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = `11px ${fontMono}`;
    ctx.fillText('Customer:', padX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 11px ${fontMono}`;
    ctx.fillText(sale.customer_name, width - padX, y);
  }

  // Divider
  y += 15;
  drawDashedLine(y);

  // 3. Table Column Headers
  y += 18;
  ctx.fillStyle = '#475569';
  ctx.font = `bold 11px ${fontMono}`;
  
  // Item (left: padX), Qty (x: 230), Rate (x: 315), Amt (right: width - padX)
  ctx.textAlign = 'left';
  ctx.fillText('Item', padX, y);
  ctx.textAlign = 'center';
  ctx.fillText('Qty', 230, y);
  ctx.textAlign = 'right';
  ctx.fillText('Rate', 315, y);
  ctx.fillText('Amt', width - padX, y);

  y += 10;
  ctx.save();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(width - padX, y);
  ctx.stroke();
  ctx.restore();

  // 4. Items List
  y += 16;
  ctx.font = `11px ${fontMono}`;

  if (items.length === 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('1x Store Purchase', padX, y);
    ctx.textAlign = 'center';
    ctx.fillText('1', 230, y);
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(sale.total), 315, y);
    ctx.fillText(formatCurrency(sale.total), width - padX, y);
    y += itemRowHeight;
  } else {
    for (const item of items) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      
      // Truncate product name if too long for receipt column
      let name = item.product_name;
      if (name.length > 20) {
        name = name.substring(0, 19) + '…';
      }
      ctx.fillText(name, padX, y);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#334155';
      ctx.fillText(String(item.quantity), 230, y);

      ctx.textAlign = 'right';
      ctx.fillText(formatCurrency(item.selling_price), 315, y);

      ctx.font = `bold 11px ${fontMono}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(formatCurrency(item.subtotal), width - padX, y);
      ctx.font = `11px ${fontMono}`;

      y += itemRowHeight;
    }
  }

  // Divider
  y += 2;
  drawDashedLine(y);

  // 5. Summary / Totals
  y += 20;
  ctx.font = `12px ${fontMono}`;
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText('Subtotal:', padX, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(formatCurrency(sale.subtotal), width - padX, y);

  if (sale.discount > 0) {
    y += 18;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#059669';
    ctx.fillText('Discount:', padX, y);
    ctx.textAlign = 'right';
    ctx.fillText(`-${formatCurrency(sale.discount)}`, width - padX, y);
  }

  if (isUdhar) {
    y += 20;
    ctx.font = `12px ${fontMono}`;
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText('Bill Total:', padX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(formatCurrency(sale.total), width - padX, y);

    y += 18;
    ctx.fillStyle = '#059669';
    ctx.textAlign = 'left';
    ctx.fillText('Paid Now:', padX, y);
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(sale.paid_amount || 0), width - padX, y);

    // Big Bold Balance Due
    y += 24;
    ctx.fillStyle = '#e11d48';
    ctx.font = `bold 14px ${fontMono}`;
    ctx.textAlign = 'left';
    ctx.fillText('BALANCE DUE (UDHAR):', padX, y);
    ctx.textAlign = 'right';
    ctx.font = `bold 17px ${fontMono}`;
    ctx.fillText(formatCurrency(sale.balance_due || sale.total), width - padX, y);
  } else {
    // Big Bold Total Paid
    y += 24;
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 16px ${fontMono}`;
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL PAID:', padX, y);
    ctx.textAlign = 'right';
    ctx.font = `bold 18px ${fontMono}`;
    ctx.fillText(formatCurrency(sale.total), width - padX, y);
  }

  // Divider
  y += 16;
  drawDashedLine(y);

  // 6. Footer Note
  y += 22;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.font = `bold 12px ${fontMono}`;
  ctx.fillText('Thank you for your business!', width / 2, y);

  y += 16;
  ctx.fillStyle = '#64748b';
  ctx.font = `11px ${fontMono}`;
  ctx.fillText('Please visit again', width / 2, y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create receipt image blob'));
    }, 'image/png');
  });
}

/**
 * Generates an image and returns an Object URL
 */
export async function generateReceiptImageDataUrl(
  sale: Sale,
  storeInfo: StoreInfo
): Promise<string> {
  const blob = await generateReceiptImageBlob(sale, storeInfo);
  return URL.createObjectURL(blob);
}

/**
 * Shares the generated receipt image directly to WhatsApp:
 * 1. Uses Web Share API with File payload on mobile (opens WhatsApp with attached image)
 * 2. Copies Image to Clipboard and opens WhatsApp on Desktop
 */
export async function shareReceiptImageToWhatsApp(
  sale: Sale,
  storeInfo: StoreInfo,
  customerPhone?: string
): Promise<{
  success: boolean;
  method: 'native_share' | 'clipboard' | 'download_fallback';
  message: string;
}> {
  try {
    const blob = await generateReceiptImageBlob(sale, storeInfo);
    const fileName = `Receipt-${sale.receipt_number}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Clean phone number (strip spaces, dashes, +91)
    let cleanPhone = customerPhone?.replace(/[^0-9]/g, '') || '';
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const shareCaption = `*${storeInfo.name}* — Receipt #${sale.receipt_number} for ${formatCurrency(sale.total)}. Thank you for shopping with us!`;

    // 1. Check if native file sharing is supported (Mobile Chrome, Safari, Android, iOS)
    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `${storeInfo.name} Receipt #${sale.receipt_number}`,
          text: shareCaption,
          files: [file],
        });
        return {
          success: true,
          method: 'native_share',
          message: 'Receipt image shared successfully!',
        };
      } catch (err: any) {
        // If user cancelled the share sheet, return gracefully
        if (err.name === 'AbortError') {
          return { success: false, method: 'native_share', message: 'Share cancelled' };
        }
        console.warn('Native share failed, falling back to clipboard:', err);
      }
    }

    // 2. Desktop / Fallback: Copy PNG Image directly to Clipboard & Open WhatsApp
    let clipboardSuccess = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        clipboardSuccess = true;
      } catch (clipErr) {
        console.warn('Clipboard write failed:', clipErr);
      }
    }

    // Build WhatsApp URL
    const targetUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareCaption)}`
      : `https://wa.me/?text=${encodeURIComponent(shareCaption)}`;

    window.open(targetUrl, '_blank');

    if (clipboardSuccess) {
      return {
        success: true,
        method: 'clipboard',
        message: 'Receipt image copied! In WhatsApp chat, press Ctrl + V (Paste) to send image.',
      };
    }

    // 3. If clipboard wasn't permitted, trigger PNG download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    return {
      success: true,
      method: 'download_fallback',
      message: 'Receipt image downloaded! Attach it in WhatsApp.',
    };
  } catch (err: any) {
    console.error('Failed to generate/share receipt image:', err);
    return {
      success: false,
      method: 'download_fallback',
      message: err.message || 'Failed to share receipt image',
    };
  }
}
