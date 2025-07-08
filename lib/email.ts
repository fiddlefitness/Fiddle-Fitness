// lib/email.ts
import nodemailer from "nodemailer";

export async function sendInvoiceEmail({
  to,
  subject,
  text,
  attachmentBuffer,
}: {
  to: string;
  subject: string;
  text: string;
  attachmentBuffer: Buffer;
}) {
  const transporter = nodemailer.createTransport({
   service: 'gmail',
    auth: {
 user: "imranmohamed46@gmail.com",
        pass: "wpyackygkpcxqqgt",
    },
  });



  await transporter.sendMail({
     from: `"Fiddle Fitness" <afraa@2gmil.com>`,
    to,
    subject,
    text,
    attachments: [
      {
        filename: "invoice.pdf",
        content: attachmentBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}


