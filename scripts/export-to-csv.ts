import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { parse } from 'json2csv';

const prisma = new PrismaClient();

const exportModel = async (modelName: string, data: any[]) => {
  try {
    const csv = parse(data);
    writeFileSync(`${modelName}.csv`, csv);
    console.log(`✅ Exported ${modelName} to ${modelName}.csv`);
  } catch (err) {
    console.error(`❌ Failed to export ${modelName}:`, err);
  }
};

async function main() {
  await exportModel('User', await prisma.user.findMany());
  await exportModel('Event', await prisma.event.findMany());
  await exportModel('Trainer', await prisma.trainer.findMany());
  await exportModel('EventRegistration', await prisma.eventRegistration.findMany());
  await exportModel('CompletedEvent', await prisma.completedEvent.findMany());
  await exportModel('EventTrainer', await prisma.eventTrainer.findMany());
  await exportModel('Pool', await prisma.pool.findMany());
  await exportModel('PoolAttendee', await prisma.poolAttendee.findMany());
  await exportModel('Payment', await prisma.payment.findMany());
  await exportModel('Invoice', await prisma.invoice.findMany());
  await exportModel('PaymentOrder', await prisma.paymentOrder.findMany());
  await exportModel('EventReview', await prisma.eventReview.findMany());

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});