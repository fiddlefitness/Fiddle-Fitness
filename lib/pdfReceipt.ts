import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function createInvoicePDF({
  invoiceNumber,
  date,
  clientName,
  clientEmail,
  clientPhone,
  items
}: {
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  items: { description: string; quantity: number; price: number }[];
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  const fontSize = 12;
  let y = height - 50;

  const drawText = (text: string, x: number, y: number) => {
    page.drawText(text, { x, y, size: fontSize, font });
  };

  // Header
  drawText("Fiddle Fitness Invoice", 50, y);
  y -= 25;
  drawText(Invoice #: ${invoiceNumber}, 50, y);
  drawText(Date: ${date}, 400, y);
  y -= 20;
  drawText(Client: ${clientName}, 50, y);
  y -= 15;
  drawText(Email: ${clientEmail}, 50, y);
  drawText(Phone: ${clientPhone}, 400, y);
  y -= 30;

  // Table Headers
  drawText("Event", 50, y);
  drawText("Qty", 250, y);
  drawText("Amount", 350, y);
  y -= 15;

  // Table Rows
  let total = 0;
  for (const item of items) {
    drawText(item.description, 50, y);
    drawText(item.quantity.toString(), 250, y);
    drawText(₹${item.price.toFixed(2)}, 350, y);
    total += item.price * item.quantity;
    y -= 15;
  }

  y -= 15;
  drawText(Total: ₹${total.toFixed(2)}, 50, y);
  y -= 25;

  drawText("Thank you for your purchase!", 50, y);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}