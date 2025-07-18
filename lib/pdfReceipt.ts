import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function createInvoicePDF({
  invoiceNumber,
  date,
  clientName,
  clientEmail,
  clientPhone,
  items,
}: {
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  items: { description: string; quantity: number; price: number }[];
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height, width } = page.getSize();
  const fontSize = 12;
  let y = height - 50;

  const drawText = (
    text: string,
    x: number,
    y: number,
    opts: { bold?: boolean; size?: number } = {}
  ) => {
    page.drawText(text, {
      x,
      y,
      size: opts.size || fontSize,
      font: opts.bold ? boldFont : font,
      color: rgb(0, 0, 0),
    });
  };



 // Fetch logo from public folderdd

 // Fetch logo from public folder
 // ✅ Correct way to load the logo from /public
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');

// Draw logo at top-left
 try {
    const logoBuffer = fs.readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBuffer);

  const logoDims = logoImage.scaleToFit(Number.MAX_SAFE_INTEGER, 80); // Set height to 80
  const logoX = 50;
  const logoY = height - 80;

  // Draw logo
  page.drawImage(logoImage, {
    x: logoX,
    y: logoY,
    width: logoDims.width,
    height: logoDims.height,
  });

  // Reset `y` after logo height
  y = logoY - 20; // drop y below logo for further content
  } catch (error) {
    console.error("Error embedding logo image:", error);
  }


  // Company info (top-right)
drawText("Fiddle Fitness", width - 200, y, { bold: true });
drawText("# B210, Tricolour Palm Cove", width - 200, y - 15);
drawText("Shanthi Nagar, Uppal", width - 200, y - 30);
drawText("Hyderabad", width - 200, y - 45);
drawText("Telangana - 500039", width - 200, y - 60);
y -= 80; // ✅ Push y down enough before invoice section

  // Invoice info
  drawText(`Invoice #: ${invoiceNumber}`, 50, y);
  drawText(`Date: ${date}`, width - 200, y);
  y -= 25;

  // Client info
  drawText(`Client: ${clientName}`, 50, y);
  y -= 15;
  drawText(`Email: ${clientEmail}`, 50, y);
  drawText(`Phone: ${clientPhone}`, width - 200, y);
  y -= 25;

  // Line separator
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 20;

  // Table Headers
  drawText("Event", 50, y, { bold: true });
  drawText("Qty", 250, y, { bold: true });
  drawText("Amount", 400, y, { bold: true });
  y -= 15;

  // Line under headers
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  y -= 15;

  let total = 0;
  for (const item of items) {
    drawText(item.description, 50, y);
    drawText(item.quantity.toString(), 250, y);
    drawText(`INR ${(item.price * item.quantity).toFixed(2)}`, 400, y);
    total += item.price * item.quantity;
    y -= 15;
  }

  y -= 20;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  y -= 20;

  drawText(`Total: INR ${total.toFixed(2)}`, 50, y, { bold: true });

  y -= 40;
  drawText("Thank you for your purchase!", 50, y, { italic: true });

  // Footer
  drawText("Fiddle Fitness • Stay Fit, Stay Healthy", 50, 40, { size: 10 });
  drawText("Page 1 of 1", width - 100, 40, { size: 10 });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
