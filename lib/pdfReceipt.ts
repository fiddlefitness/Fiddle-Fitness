import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fs from 'fs'

export async function generateInvoicePdf({
  user,
  event,
  payment
}: {
  user: { name: string; email: string }
  event: { title: string; eventDate: string }
  payment: { amount: number; paymentId: string; date: Date }
}) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  page.drawText('🧾 Payment Receipt', { x: 50, y: 800, size: 20, font })

  page.drawText(`Name: ${user.name}`, { x: 50, y: 770, size: 12, font })
  page.drawText(`Email: ${user.email}`, { x: 50, y: 750, size: 12, font })
  page.drawText(`Event: ${event.title}`, { x: 50, y: 730, size: 12, font })
  page.drawText(`Event Date: ${new Date(event.eventDate).toLocaleDateString()}`, {
    x: 50, y: 710, size: 12, font
  })

  page.drawText(`Amount Paid: ₹${payment.amount}`, { x: 50, y: 690, size: 12, font })
  page.drawText(`Payment ID: ${payment.paymentId}`, { x: 50, y: 670, size: 12, font })
  page.drawText(`Date: ${payment.date.toLocaleString()}`, { x: 50, y: 650, size: 12, font })

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
