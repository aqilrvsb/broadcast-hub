import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Chart, registerables } from 'chart.js'
import { Radio, Send, XCircle, Clock, Users, UserCheck, TrendingUp } from 'lucide-react'

Chart.register(...registerables)

type Stats = {
  totalDevices: number
  activeDevices: number
  offlineDevices: number
}

type BroadcastStats = {
  totalBroadcast: number
  shouldSend: number
  sent: number
  failed: number
  remaining: number
  totalLeads: number
  uniqueRecipients: number
  successRate: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalDevices: 0,
    activeDevices: 0,
    offlineDevices: 0,
  })
  const [broadcastStats, setBroadcastStats] = useState<BroadcastStats>({
    totalBroadcast: 0,
    shouldSend: 0,
    sent: 0,
    failed: 0,
    remaining: 0,
    totalLeads: 0,
    uniqueRecipients: 0,
    successRate: 0,
  })
  const [loading, setLoading] = useState(true)

  // Filter states
  const [deviceFilter, setDeviceFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [devices, setDevices] = useState<{ id: string; device_id: string }[]>([])

  // Chart refs and state
  const dailyTrendsChartRef = useRef<HTMLCanvasElement>(null)
  const dailyTrendsChartInstance = useRef<Chart | null>(null)
  const [dailySentData, setDailySentData] = useState<{ date: string; count: number }[]>([])

  useEffect(() => {
    setDefaultDates()
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      loadDashboardData()
    }
  }, [deviceFilter, startDate, endDate])

  const setDefaultDates = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')

    setStartDate(`${year}-${month}-01`)
    setEndDate(`${year}-${month}-${day}`)
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      const isAdmin = user?.role === 'admin'

      // Query 1: Device settings
      let deviceSettingsQuery = supabase
        .from('device_setting')
        .select('id, device_id, status')

      if (!isAdmin) {
        deviceSettingsQuery = deviceSettingsQuery.eq('user_id', user?.id)
      }

      const { data: devicesData } = await deviceSettingsQuery
      const userDeviceIds = devicesData?.map(d => d.id).filter(Boolean) || []

      // Set devices for dropdown
      setDevices(devicesData || [])

      // Calculate device stats
      const totalDevices = devicesData?.length || 0
      const activeDevices = devicesData?.filter(d => d.status === 'CONNECTED').length || 0
      setStats({
        totalDevices,
        activeDevices,
        offlineDevices: totalDevices - activeDevices,
      })

      // Query 2: Sequences (broadcasts) for user
      let sequencesQuery = supabase
        .from('sequences')
        .select('id, device_id, created_at')

      if (!isAdmin) {
        sequencesQuery = sequencesQuery.eq('user_id', user?.id)
      }
      if (deviceFilter) {
        sequencesQuery = sequencesQuery.eq('device_id', deviceFilter)
      }
      if (startDate) {
        sequencesQuery = sequencesQuery.gte('created_at', `${startDate}T00:00:00`)
      }
      if (endDate) {
        sequencesQuery = sequencesQuery.lte('created_at', `${endDate}T23:59:59`)
      }

      const { data: sequences } = await sequencesQuery
      const sequenceIds = sequences?.map(s => s.id) || []

      // Query 3: Scheduled messages for these sequences
      let messagesQuery = supabase
        .from('sequence_scheduled_messages')
        .select('id, status, prospect_num, scheduled_time, created_at')

      if (sequenceIds.length > 0) {
        messagesQuery = messagesQuery.in('sequence_id', sequenceIds)
      } else {
        // No sequences, return empty
        messagesQuery = messagesQuery.eq('sequence_id', 'none')
      }

      const { data: messages } = await messagesQuery

      // Calculate broadcast stats
      const totalBroadcast = sequences?.length || 0
      const shouldSend = messages?.length || 0
      const sent = messages?.filter(m => m.status === 'sent').length || 0
      const failed = messages?.filter(m => m.status === 'failed').length || 0
      const remaining = messages?.filter(m => m.status === 'scheduled').length || 0
      const uniqueRecipients = new Set(messages?.map(m => m.prospect_num) || []).size
      const successRate = shouldSend > 0 ? parseFloat(((sent / shouldSend) * 100).toFixed(1)) : 0

      // Query 4: Total leads count
      let leadsQuery = supabase
        .from('leads')
        .select('id', { count: 'exact' })

      if (!isAdmin) {
        leadsQuery = leadsQuery.eq('user_id', user?.id)
      }
      if (deviceFilter) {
        leadsQuery = leadsQuery.eq('device_id', deviceFilter)
      }

      const { count: leadsCount } = await leadsQuery

      setBroadcastStats({
        totalBroadcast,
        shouldSend,
        sent,
        failed,
        remaining,
        totalLeads: leadsCount || 0,
        uniqueRecipients,
        successRate,
      })

      // Render chart with sent messages by date
      if (messages && messages.length > 0) {
        renderDailyTrendsChart(messages.filter(m => m.status === 'sent'))
      } else {
        if (dailyTrendsChartInstance.current) {
          dailyTrendsChartInstance.current.destroy()
          dailyTrendsChartInstance.current = null
        }
        setDailySentData([])
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setDeviceFilter('')
    setDefaultDates()
  }

  const renderDailyTrendsChart = (sentMessages: any[]) => {
    if (!dailyTrendsChartRef.current) return

    // Group sent messages by date
    const dateGroups: Record<string, number> = {}
    sentMessages.forEach(msg => {
      if (msg.scheduled_time) {
        const date = new Date(msg.scheduled_time)
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
        dateGroups[dateStr] = (dateGroups[dateStr] || 0) + 1
      }
    })

    // Get last 7 days
    const labels: string[] = []
    const data: number[] = []
    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
      labels.push(dateStr)
      data.push(dateGroups[dateStr] || 0)
    }

    // Destroy previous chart if exists
    if (dailyTrendsChartInstance.current) {
      dailyTrendsChartInstance.current.destroy()
    }

    // Create new chart
    const ctx = dailyTrendsChartRef.current.getContext('2d')
    if (!ctx) return

    dailyTrendsChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Messages Sent',
          data: data,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    })
  }

  const StatCard = ({ title, value, icon, color, subtitle }: { title: string; value: number; icon: string; color: string; subtitle: string }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900">
        {loading ? (
          <div className="h-9 w-20 bg-gray-200 animate-pulse rounded"></div>
        ) : (
          value
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
    </div>
  )

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-primary-600 mb-2">Welcome back, {user?.full_name || 'User'}!</h2>
          <p className="text-gray-600">Here's an overview of your broadcast performance.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Devices"
            value={stats.totalDevices}
            icon="📱"
            color="bg-blue-100"
            subtitle="All registered devices"
          />
          <StatCard
            title="Active Devices"
            value={stats.activeDevices}
            icon="✅"
            color="bg-green-100"
            subtitle="Currently active"
          />
          <StatCard
            title="Offline Devices"
            value={stats.offlineDevices}
            icon="❌"
            color="bg-red-100"
            subtitle="Currently offline"
          />
        </div>

        {/* Broadcast Analytics Cards - 7 cards */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-8">
          {/* Total Broadcast */}
          <div className="bg-white rounded-xl p-4 card-soft card-hover transition-smooth border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Broadcast</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{broadcastStats.totalBroadcast}</div>
          </div>

          {/* Should Send */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Should Send</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{broadcastStats.shouldSend}</div>
          </div>

          {/* Sent */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-green-100">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Sent</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{broadcastStats.sent}</div>
          </div>

          {/* Failed */}
          <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Failed</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{broadcastStats.failed}</div>
          </div>

          {/* Remaining */}
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-yellow-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Remaining</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{broadcastStats.remaining}</div>
          </div>

          {/* Total Leads */}
          <div className="bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl p-4 card-soft card-hover transition-smooth border border-cyan-100">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-cyan-600" />
              <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">Total Leads</span>
            </div>
            <div className="text-2xl font-bold text-cyan-600">{broadcastStats.totalLeads}</div>
          </div>

          {/* Success Rate */}
          <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl p-4 card-medium card-hover transition-smooth">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-white" />
              <span className="text-xs font-semibold text-purple-100 uppercase tracking-wide">Success Rate</span>
            </div>
            <div className="text-2xl font-bold text-white">{broadcastStats.successRate}%</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 mb-8 card-soft transition-smooth">
          <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">Filter by Date Range</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Device</label>
              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Devices</option>
                {devices.map(device => (
                  <option key={device.id} value={device.id}>{device.device_id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <button
              onClick={resetFilters}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg transition-colors font-medium"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Chart - Full Width */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Messages Sent Trends</h3>
          <p className="text-sm text-gray-500 mb-4">Daily sent messages over the last 7 days</p>
          <div className="h-64">
            <canvas ref={dailyTrendsChartRef}></canvas>
          </div>
        </div>
      </div>
    </Layout>
  )
}
