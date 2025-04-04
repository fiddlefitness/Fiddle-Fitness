import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Define EVENT_CATEGORIES locally since we can't import it
const EVENT_CATEGORIES = [
  { value: 'cat_yoga', label: 'Yoga' },
  { value: 'cat_meditation', label: 'Meditation' },
  { value: 'cat_workout', label: 'Workout' },
  { value: 'cat_dance', label: 'Dance' },
  { value: 'cat_swimming', label: 'Swimming' },
  { value: 'cat_cycling', label: 'Cycling' },
  { value: 'cat_running', label: 'Running' },
  { value: 'cat_martial_arts', label: 'Martial Arts' },
  { value: 'cat_pilates', label: 'Pilates' },
  { value: 'cat_zumba', label: 'Zumba' },
]

async function getUpcomingEventCategories() {
  const now = new Date()
  // Set time to midnight to match database date format
  now.setHours(0, 0, 0, 0)
  console.log('Current time (midnight):', now.toISOString())
  
  const upcomingEvents = await prisma.event.findMany({
    where: {
      eventDate: {
        gte: now,
      },
      OR: [
        { registrationDeadline: null },
        { registrationDeadline: { gte: now } }, 
      ],
    },
    select: {
      category: true,
      title: true,
      registrationDeadline: true,
      eventDate: true,
    },
    orderBy: {
      eventDate: 'asc',
    },
  })

  const allEvents = await prisma.event.findMany()

  console.log('\nAll events:')
  allEvents.forEach(event => {
    console.log(`- ${event.title} (Category: ${event.category})`)
    console.log(`  Event Date: ${event.eventDate.toISOString()}`)
    console.log(`  Registration Deadline: ${event.registrationDeadline?.toISOString() || 'None'}`)
  })


  console.log('\nAll upcoming events:')
  upcomingEvents.forEach(event => {
    console.log(`- ${event.title} (Category: ${event.category})`)
    console.log(`  Event Date: ${event.eventDate.toISOString()}`)
    console.log(`  Registration Deadline: ${event.registrationDeadline?.toISOString() || 'None'}`)
  })

  const eventCategories = [
    ...new Set(upcomingEvents.map(event => event.category)),
  ]

  console.log('\nUnique event categories:', eventCategories)

  const filteredCategories = EVENT_CATEGORIES.filter((category: any) =>
    eventCategories.some(
      eventCategory =>
        category.value === eventCategory ||
        category.value === `cat_${eventCategory}` ||
        eventCategory === `cat_${category.value.replace('cat_', '')}`,
    ),
  )

  console.log('\nFiltered categories:')
  filteredCategories.forEach(cat => {
    console.log(`- ${cat.label} (${cat.value})`)
  })
  
  return filteredCategories
}

async function main() {
  try {
    console.log('Testing getUpcomingEventCategories function...')
    await getUpcomingEventCategories()
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main() 