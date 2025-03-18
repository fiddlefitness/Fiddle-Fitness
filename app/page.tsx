'use client'

import Image from 'next/image'
import { sendAiSensyRequest } from './components/FiddleFitness'

export default function Home() {
  const sendRequestHandler = async () => {
    const params = {
      campaignName: 'Fiddle Fitness testing',
      destination: '8305387299',
      userName: 'Fiddle Fitness LLP',
      templateParams: [],
      source: 'new-landing-page form',
      media: {},
      buttons: [],
      carouselCards: [],
      location: {},
      attributes: {},
      paramsFallbackValue: {},
    }

    const response = await sendAiSensyRequest(params)
    console.log(response)
  }

  return (
    <div className='bg-white w-full flex flex-col items-center justify-center'>
      <h1>Home page</h1>

      <button onClick={sendRequestHandler}>send request</button>
    </div>
  )
}
