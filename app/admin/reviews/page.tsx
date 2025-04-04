'use client'

import {
    Card,
    CardBody,
    CardHeader,
    Chip,
    Select,
    SelectItem,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow
} from "@nextui-org/react"
import axios from 'axios'
import { useEffect, useState } from 'react'
import { FaRegStar, FaStar, FaStarHalfAlt } from 'react-icons/fa'

interface EventReview {
  id: string
  rating: number
  feedback: string
  status: string
  createdAt: string
  updatedAt: string
  userId: string
  eventId: string
  user: {
    name: string
    email: string
    mobileNumber: string
  }
  event: {
    title: string
    eventDate: string
    category: string
  }
}

export default function Reviews() {
  const [reviews, setReviews] = useState<EventReview[]>([])
  const [filteredReviews, setFilteredReviews] = useState<EventReview[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [events, setEvents] = useState<{id: string, title: string}[]>([])

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await axios.get('/api/admin/reviews')
        setReviews(response.data)
        setFilteredReviews(response.data)
        
        // Extract unique events
        const uniqueEvents = Array.from(
          new Set(response.data.map((review: EventReview) => review.eventId))
        ).map(eventId => {
          const review = response.data.find((r: EventReview) => r.eventId === eventId)
          return {
            id: eventId,
            title: review.event.title
          }
        })
        
        setEvents(uniqueEvents)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching reviews:', error)
        setLoading(false)
      }
    }

    fetchReviews()
  }, [])

  useEffect(() => {
    let result = [...reviews]
    
    // Apply rating filter
    if (filter !== 'all') {
      const ratingNum = parseInt(filter)
      result = result.filter(review => review.rating === ratingNum)
    }
    
    // Apply event filter
    if (eventFilter !== 'all') {
      result = result.filter(review => review.eventId === eventFilter)
    }
    
    setFilteredReviews(result)
  }, [filter, eventFilter, reviews])

  const renderStarRating = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<FaStar key={i} className="text-yellow-500" />)
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(<FaStarHalfAlt key={i} className="text-yellow-500" />)
      } else {
        stars.push(<FaRegStar key={i} className="text-gray-300" />)
      }
    }
    
    return <div className="flex gap-1">{stars}</div>
  }

  const getRatingColorClass = (rating: number) => {
    if (rating >= 4) return "bg-green-100 text-green-800"
    if (rating === 3) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Event Reviews</h1>
      
      <div className="flex flex-wrap gap-4 mb-6">
        <Card className="w-full md:w-64">
          <CardHeader className="pb-0">
            <h4 className="font-bold text-large">Filter by Rating</h4>
          </CardHeader>
          <CardBody>
            <Select
              label="Rating"
              placeholder="All Ratings"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <SelectItem key="all" value="all">All Ratings</SelectItem>
              <SelectItem key="5" value="5">5 Stars</SelectItem>
              <SelectItem key="4" value="4">4 Stars</SelectItem>
              <SelectItem key="3" value="3">3 Stars</SelectItem>
              <SelectItem key="2" value="2">2 Stars</SelectItem>
              <SelectItem key="1" value="1">1 Star</SelectItem>
            </Select>
          </CardBody>
        </Card>
        
        <Card className="w-full md:w-64">
          <CardHeader className="pb-0">
            <h4 className="font-bold text-large">Filter by Event</h4>
          </CardHeader>
          <CardBody>
            <Select
              label="Event"
              placeholder="All Events"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <SelectItem key="all" value="all">All Events</SelectItem>
              {events.map(event => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </Select>
          </CardBody>
        </Card>
      </div>
      
      <Card>
        <CardBody>
          <Table aria-label="Event reviews">
            <TableHeader>
              <TableColumn>EVENT</TableColumn>
              <TableColumn>USER</TableColumn>
              <TableColumn>RATING</TableColumn>
              <TableColumn>FEEDBACK</TableColumn>
              <TableColumn>DATE</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={loading ? "Loading reviews..." : "No reviews found."}
              isLoading={loading}
            >
              {filteredReviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{review.event.title}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(review.event.eventDate).toLocaleDateString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{review.user.name}</p>
                      <p className="text-sm text-gray-500">{review.user.mobileNumber}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Chip 
                        className={getRatingColorClass(review.rating)}
                        size="sm"
                      >
                        {review.rating}/5
                      </Chip>
                      {renderStarRating(review.rating)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {review.feedback || <span className="text-gray-400">No feedback provided</span>}
                  </TableCell>
                  <TableCell>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  )
} 