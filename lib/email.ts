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
  const transporter1 = nodemailer.createTransport({
   service: 'gmail',
    auth: {
 user: "imranmohamed46@gmail.com",
        pass: "ygobbcdxvtkkyfdu",
    },
  });

const transporter = nodemailer.createTransport({
    host: 'smtpout.secureserver.net',
    port: 465,
    secure: true, // true for 465, false for 587
    auth: {
      user: 'info@fiddle.fitness',      // Your GoDaddy email
      pass: '12March@1987',                    // Your GoDaddy email password
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


