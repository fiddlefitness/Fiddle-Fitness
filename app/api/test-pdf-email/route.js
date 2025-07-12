import { createInvoicePDF } from "@/lib/pdfReceipt";
import { sendInvoiceEmail } from "@/lib/email";

export async function POST() {
  const invoiceData = {
    invoiceNumber: "INV-2025-001",
    date: new Date().toLocaleDateString(),
    clientName: "John Doe",
    clientEmail: "hemantkanojia7@gmail.com",
    clientPhone: "9994183275",
    items: [
      {
        description: "Annual Membership",
        quantity: 1,
        price: 1200,
      },
    ],
  };

  const pdfBuffer = await createInvoicePDF(invoiceData);

  await sendInvoiceEmail({
    to: invoiceData.clientEmail,
    subject: "Fiddle Fitness Invoice",
    text: "Please find your invoice attached.",
    attachmentBuffer: pdfBuffer,
  });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
