// app/api/test-pdf-email/route.ts
import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import nodemailer from 'nodemailer'

export async function GET() {
  try {
    // 1. Create PDF with pdf-lib
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([600, 400])
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    page.drawText('Hello from Fiddle Fitness!', {
      x: 50,
      y: 300,
      size: 24,
      font,
      color: rgb(0, 0.53, 0.71),
    })

    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = Buffer.from(pdfBytes)

    // 2. Create email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    })

    // 3. Send the email
    await transporter.sendMail({
      from: `"Fiddle Fitness" <${process.env.EMAIL_USERNAME}>`,
      to: 'your_test_email@example.com', // 🔁 Replace with your email for testing
      subject: 'Test PDF Receipt',
      text: 'This is a test email with a PDF attached.',
      attachments: [
        {
          filename: 'receipt.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })

    return NextResponse.json({ success: true, message: 'Email sent with PDF!' })
  } catch (error) {
    console.error('Failed to send test email:', error)
    return NextResponse.json({ success: false, message: 'Email send failed' }, { status: 500 })
  }
}
