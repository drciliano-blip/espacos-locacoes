'use client'

import { useState } from 'react'
import CalendarView from '@/components/agenda/CalendarView'
import EventList from '@/components/agenda/EventList'
import { eventos } from '@/lib/mock-data'

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        <CalendarView
          eventos={eventos}
          selectedDate={selectedDate}
          onDaySelect={setSelectedDate}
        />
        <EventList eventos={eventos} selectedDate={selectedDate} />
      </div>
    </div>
  )
}
