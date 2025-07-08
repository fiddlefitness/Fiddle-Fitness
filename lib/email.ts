import nodemailer from 'nodemailer'

export async function sendInvoiceEmail(toEmail: string, pdfBuffer: Buffer) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_SENDER_ADDRESS,
      pass: process.env.EMAIL_SENDER_PASSWORD
    }
  })

  const info = await transporter.sendMail({
    from: `"Fiddle Fitness" <${process.env.EMAIL_SENDER_ADDRESS}>`,
    to: toEmail,
    subject: 'Your Payment Invoice - Fiddle Fitness',
    text: 'Attached is your official receipt for the event payment.',
    attachments: [
      {
        filename: 'invoice.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  })

  console.log('Email sent:', info.messageId)
}
