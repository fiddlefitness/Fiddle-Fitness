import easyinvoice from "easyinvoice";

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
  const data = {
    currency: "INR",
    taxNotation: "gst",
    sender: {
      company: "Fiddle Fitness",
      address: "123 Gym Street",
      zip: "560001",
      city: "Bangalore",
      country: "India",
    },
    client: {
      company: clientName,
            address: clientEmail,
            zip: clientPhone
            },
    invoiceNumber,
    invoiceDate: date,
    products: items,
    bottomNotice: "Thank you for your purchase!",

    // ✅ Translations to rename column headers
    translate: {
      "products": "Events",
      "quantity": "Qty",
      "description": "Event",
      "price": "Amount",
      "subtotal": "Total"
    }
  };

  const result = await easyinvoice.createInvoice(data);
  return Buffer.from(result.pdf, "base64");
}
