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

  // Dummy logo rectangle (replace later with an image if needed)
  page.drawRectangle({
    x: 50,
    y: y - 30,
    width: 100,
    height: 30,
    color: rgb(0.9, 0.9, 0.9),
    borderColor: rgb(0.5, 0.5, 0.5),
    borderWidth: 1,
  });
 // Fetch logo from public folder
 // ✅ Correct way to load the logo from /public
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');

// Draw logo at top-left
 try {
    const logoBuffer = fs.readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBuffer);

    // Draw the image at the top-left
    page.drawImage(logoImage, {
      x: 50,
      y: height - 80,
      width: 100,
      height: 100,
    });
  } catch (error) {
    console.error("Error embedding logo image:", error);
  }


  // Company info (top-right)
  drawText("Fiddle Fitness Pvt Ltd", width - 200, y, { bold: true });
  drawText("123 Health Street", width - 200, y - 15);
  drawText("Wellness City, Fitland 456789", width - 200, y - 30);
  y -= 60;

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
