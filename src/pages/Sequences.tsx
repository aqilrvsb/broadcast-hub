import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase, Device, ContactCategory } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

type Sequence = {
  id: string
  user_id: string
  name: string
  device_id: string
  category_id: string
  niche: string
  trigger: string
  description: string
  schedule_date: string
  schedule_time: string
  min_delay: number
  max_delay: number
  status: 'active' | 'inactive' | 'finish'
  created_at: string
  updated_at: string
  contact_count?: number
  flows_count?: number
  device?: Device
  category?: ContactCategory
}

type BroadcastSummary = {
  success: boolean
  sequence: {
    id: string
    name: string
    status: string
    schedule_date: string
    schedule_time: string
    category_name: string
  }
  overall: {
    should_send: number
    sent: number
    sent_percentage: string
    failed: number
    failed_percentage: string
    remaining: number
    remaining_percentage: string
    cancelled: number
    total_leads: number
    success_rate: string
  }
  step_progress: {
    step: number
    step_name: string
    image_url: string | null
    should_send: number
    sent: number
    sent_percentage: string
    failed: number
    failed_percentage: string
    remaining: number
    remaining_percentage: string
    progress: string
  }[]
}

type ScheduledMessageRecipient = {
  id: string
  prospect_num: string
  prospect_name: string
  whacenter_message_id: string
  scheduled_time: string
  status: string
}

type SequenceFlow = {
  id: string
  sequence_id: string
  flow_number: number
  step_trigger: string
  next_trigger: string | null
  delay_hours: number
  message: string
  image_url: string | null
  is_end: boolean
  created_at: string
  updated_at: string
}

type BankImage = {
  id: string
  name: string
  image_url: string
}

export default function Sequences() {
  const { user } = useAuth()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [contactCategories, setContactCategories] = useState<ContactCategory[]>([])
  const [bankImages, setBankImages] = useState<BankImage[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFlowEditModal, setShowFlowEditModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryData, setSummaryData] = useState<BroadcastSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewFlows, setViewFlows] = useState<SequenceFlow[]>([])
  const [viewSequence, setViewSequence] = useState<Sequence | null>(null)
  const [currentSequence, setCurrentSequence] = useState<Sequence | null>(null)
  const [showRecipientsModal, setShowRecipientsModal] = useState(false)
  const [recipientsData, setRecipientsData] = useState<ScheduledMessageRecipient[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(false)
  const [recipientsTitle, setRecipientsTitle] = useState('')
  const [recipientsFlowNumber, setRecipientsFlowNumber] = useState<number>(0)
  const [recipientsStatus, setRecipientsStatus] = useState<string>('')
  const [currentFlowNumber, setCurrentFlowNumber] = useState<number>(1)
  const [sequenceFlows, setSequenceFlows] = useState<SequenceFlow[]>([])
  const [tempFlows, setTempFlows] = useState<SequenceFlow[]>([]) // For create modal

  // Filter states
  const getFirstDayOfMonth = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-01`
  }
  const getLastDayOfMonth = () => {
    const date = new Date()
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    const year = lastDay.getFullYear()
    const month = String(lastDay.getMonth() + 1).padStart(2, '0')
    const day = String(lastDay.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const [filterStartDate, setFilterStartDate] = useState(getFirstDayOfMonth())
  const [filterEndDate, setFilterEndDate] = useState(getLastDayOfMonth())
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'finish'>('all')

  // Form state for creating/editing sequences
  const [formData, setFormData] = useState({
    name: '',
    device_id: '',
    category_id: '',
    niche: '', // Keep for backward compatibility
    trigger: '', // Keep for backward compatibility
    description: '', // Keep for backward compatibility
    schedule_date: '', // Date for scheduling
    schedule_time: '09:00', // Time for scheduling
    min_delay: 5,
    max_delay: 15,
    status: 'inactive' as 'active' | 'inactive' | 'finish',
  })

  // Flow message form state
  const [flowFormData, setFlowFormData] = useState({
    flow_number: 1,
    step_trigger: '',
    next_trigger: '',
    delay_hours: 24,
    message: '',
    image_url: '',
    is_end: false,
  })

  useEffect(() => {
    loadSequences()
    loadDevices()
    loadBankImages()
  }, [])

  const loadSequences = async () => {
    try {
      setLoading(true)

      if (!user?.id) return

      // Fetch sequences for this user
      const { data: sequencesData, error } = await supabase
        .from('sequences')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch contact counts, device and category info for each sequence
      if (sequencesData) {
        const sequencesWithDetails = await Promise.all(
          sequencesData.map(async (seq) => {
            const { count } = await supabase
              .from('sequence_enrollments')
              .select('*', { count: 'exact', head: true })
              .eq('sequence_id', seq.id)

            // Fetch device info if device_id exists
            let device = null
            if (seq.device_id) {
              const { data: deviceData } = await supabase
                .from('device_setting')
                .select('*')
                .eq('id', seq.device_id)
                .single()
              device = deviceData
            }

            // Fetch category info if category_id exists
            let category = null
            let leadsCount = 0
            if (seq.category_id) {
              const { data: categoryData } = await supabase
                .from('contact_categories')
                .select('*')
                .eq('id', seq.category_id)
                .single()
              category = categoryData

              // Fetch leads count for this category
              const { count: categoryLeadsCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('category_id', seq.category_id)
              leadsCount = categoryLeadsCount || 0
            }

            // Fetch flows count for this sequence
            const { count: flowsCount } = await supabase
              .from('sequence_flows')
              .select('*', { count: 'exact', head: true })
              .eq('sequence_id', seq.id)

            return {
              ...seq,
              contact_count: count || 0,
              flows_count: flowsCount || 0,
              device,
              category: category ? { ...category, leads_count: leadsCount } : null,
            }
          })
        )

        setSequences(sequencesWithDetails)
      }
    } catch (error) {
      console.error('Error loading sequences:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error Loading Broadcast',
        text: 'Failed to load sequences',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadDevices = async () => {
    try {
      if (!user?.id) return

      const { data, error } = await supabase
        .from('device_setting')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDevices(data || [])
    } catch (error) {
      console.error('Error loading devices:', error)
    }
  }

  const loadContactCategories = async (deviceId: string) => {
    try {
      if (!user?.id || !deviceId) {
        setContactCategories([])
        return
      }

      const { data, error } = await supabase
        .from('contact_categories')
        .select('*')
        .eq('device_id', deviceId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get leads count for each category
      const categoriesWithCounts = await Promise.all(
        (data || []).map(async (category) => {
          const { count } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id)

          return {
            ...category,
            leads_count: count || 0,
          }
        })
      )

      setContactCategories(categoriesWithCounts)
    } catch (error) {
      console.error('Error loading contact categories:', error)
    }
  }

  const loadBankImages = async () => {
    try {
      if (!user?.id) return

      const { data, error } = await supabase
        .from('bank_images')
        .select('id, name, image_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBankImages(data || [])
    } catch (error) {
      console.error('Error loading bank images:', error)
    }
  }

  const handleCreateSequence = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) return

    // Check if Flow 1 exists
    const hasFlow1 = tempFlows.some(f => f.flow_number === 1)
    if (!hasFlow1) {
      await Swal.fire({
        icon: 'warning',
        title: 'Flow 1 Required',
        text: 'Please set up at least Flow 1 before creating a broadcast.',
      })
      return
    }

    try {
      // Create sequence first
      const { data: sequenceData, error: sequenceError } = await supabase
        .from('sequences')
        .insert({
          user_id: user.id,
          ...formData,
        })
        .select()
        .single()

      if (sequenceError) throw sequenceError

      // Insert all flows that were created in the modal
      if (tempFlows.length > 0 && sequenceData) {
        const flowsToInsert = tempFlows.map(flow => ({
          sequence_id: sequenceData.id,
          flow_number: flow.flow_number,
          step_trigger: flow.step_trigger,
          next_trigger: flow.next_trigger,
          delay_hours: flow.delay_hours,
          message: flow.message,
          image_url: flow.image_url,
          is_end: flow.is_end,
        }))

        const { error: flowsError } = await supabase
          .from('sequence_flows')
          .insert(flowsToInsert)

        if (flowsError) throw flowsError
      }

      await Swal.fire({
        icon: 'success',
        title: 'Broadcast Created!',
        text: 'Your sequence has been created successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      setShowCreateModal(false)
      resetForm()
      setTempFlows([])
      loadSequences()
    } catch (error: any) {
      console.error('Error creating sequence:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Create Broadcast',
        text: error.message || 'Failed to create sequence',
      })
    }
  }

  const handleEditSequence = async (sequence: Sequence) => {
    setCurrentSequence(sequence)
    setFormData({
      name: sequence.name,
      device_id: sequence.device_id || '',
      category_id: sequence.category_id || '',
      niche: sequence.niche || '',
      trigger: sequence.trigger || '',
      description: sequence.description || '',
      schedule_date: sequence.schedule_date || '',
      schedule_time: sequence.schedule_time || '09:00',
      min_delay: sequence.min_delay,
      max_delay: sequence.max_delay,
      status: sequence.status,
    })

    // Load contact categories for the selected device
    if (sequence.device_id) {
      await loadContactCategories(sequence.device_id)
    }

    // Load flows for this sequence
    try {
      const { data: flowsData, error } = await supabase
        .from('sequence_flows')
        .select('*')
        .eq('sequence_id', sequence.id)
        .order('flow_number', { ascending: true })

      if (error) throw error
      setSequenceFlows(flowsData || [])
      setShowEditModal(true)
    } catch (error) {
      console.error('Error loading flows:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error Loading Flows',
        text: 'Failed to load sequence flows',
      })
    }
  }

  const handleUpdateSequence = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentSequence) return

    try {
      const { error } = await supabase
        .from('sequences')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentSequence.id)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Broadcast Updated!',
        text: 'Your sequence has been updated successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      setShowEditModal(false)
      setCurrentSequence(null)
      setSequenceFlows([])
      resetForm()
      loadSequences()
    } catch (error: any) {
      console.error('Error updating sequence:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Update Broadcast',
        text: error.message || 'Failed to update sequence',
      })
    }
  }

  const handleDeleteSequence = async (id: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Broadcast?',
      text: 'This will also delete all flows and enrollments for this sequence. This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })

    if (!result.isConfirmed) return

    try {
      const { error } = await supabase
        .from('sequences')
        .delete()
        .eq('id', id)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Broadcast has been deleted successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadSequences()
    } catch (error: any) {
      console.error('Error deleting sequence:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Delete',
        text: error.message || 'Failed to delete sequence',
      })
    }
  }

  const handleShowSummary = async (sequence: Sequence) => {
    try {
      setSummaryLoading(true)
      setShowSummaryModal(true)
      setCurrentSequence(sequence)

      const DENO_API_URL = import.meta.env.VITE_DENO_API_URL || 'https://broadcast-hub.deno.dev'
      const response = await fetch(`${DENO_API_URL}/api/broadcast/summary?sequence_id=${sequence.id}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch summary')
      }

      setSummaryData(data)
    } catch (error: unknown) {
      console.error('Error fetching summary:', error)
      setShowSummaryModal(false)
      setCurrentSequence(null)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Load Summary',
        text: error instanceof Error ? error.message : 'Failed to load broadcast summary',
      })
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleViewSequence = async (sequence: Sequence) => {
    try {
      setViewSequence(sequence)
      setShowViewModal(true)

      // Load flows for this sequence
      const { data: flowsData, error } = await supabase
        .from('sequence_flows')
        .select('*')
        .eq('sequence_id', sequence.id)
        .order('flow_number', { ascending: true })

      if (error) throw error
      setViewFlows(flowsData || [])
    } catch (error) {
      console.error('Error loading flows for view:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error Loading Flows',
        text: 'Failed to load sequence flows for viewing',
      })
      setShowViewModal(false)
      setViewSequence(null)
    }
  }

  // Handler to show recipients modal with clickable numbers
  const handleShowRecipients = async (flowNumber: number, status: string, title: string) => {
    if (!currentSequence) return

    try {
      setRecipientsLoading(true)
      setRecipientsTitle(title)
      setRecipientsFlowNumber(flowNumber)
      setRecipientsStatus(status)
      setShowRecipientsModal(true)

      // Get scheduled messages for this flow and status
      let query = supabase
        .from('sequence_scheduled_messages')
        .select('id, prospect_num, whacenter_message_id, scheduled_time, status')
        .eq('sequence_id', currentSequence.id)
        .eq('flow_number', flowNumber)

      // Filter by status type
      if (status === 'sent') {
        query = query.eq('status', 'sent')
      } else if (status === 'failed') {
        query = query.eq('status', 'failed')
      } else if (status === 'remaining') {
        query = query.eq('status', 'scheduled')
      } else if (status === 'should_send') {
        // All statuses for this flow
      }

      const { data: messages, error } = await query

      if (error) throw error

      // Get lead names for each prospect_num
      const recipientsWithNames: ScheduledMessageRecipient[] = await Promise.all(
        (messages || []).map(async (msg) => {
          const { data: lead } = await supabase
            .from('leads')
            .select('prospect_name')
            .eq('prospect_num', msg.prospect_num)
            .single()

          return {
            id: msg.id,
            prospect_num: msg.prospect_num,
            prospect_name: lead?.prospect_name || 'Unknown',
            whacenter_message_id: msg.whacenter_message_id || '',
            scheduled_time: msg.scheduled_time,
            status: msg.status,
          }
        })
      )

      setRecipientsData(recipientsWithNames)
    } catch (error) {
      console.error('Error loading recipients:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Load Recipients',
        text: 'Could not load recipient list',
      })
      setShowRecipientsModal(false)
    } finally {
      setRecipientsLoading(false)
    }
  }

  // Handler to delete scheduled message from WhatsApp Center and database
  const handleDeleteScheduled = async (recipient: ScheduledMessageRecipient) => {
    if (!currentSequence) return

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Scheduled Message?',
      html: `
        <p>This will cancel the scheduled message for:</p>
        <p class="font-bold mt-2">${recipient.prospect_name} (${recipient.prospect_num})</p>
        <p class="text-sm text-gray-500 mt-2">The message will be removed from WhatsApp Center schedule.</p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })

    if (!result.isConfirmed) return

    try {
      // Get device instance for WhatsApp Center API
      const { data: device } = await supabase
        .from('device_setting')
        .select('instance')
        .eq('id', currentSequence.device_id)
        .single()

      if (device?.instance && recipient.whacenter_message_id) {
        // Delete from WhatsApp Center
        const WHACENTER_API_URL = 'https://app.whacenter.com/api/deleteMessage'
        const formData = new FormData()
        formData.append('device_id', device.instance)
        formData.append('id', recipient.whacenter_message_id)

        await fetch(WHACENTER_API_URL, {
          method: 'GET',
          body: formData,
        }).catch(err => console.warn('WhatsApp Center delete error:', err))
      }

      // Update status to cancelled in database
      await supabase
        .from('sequence_scheduled_messages')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', recipient.id)

      // Remove from local state
      setRecipientsData(prev => prev.filter(r => r.id !== recipient.id))

      // Refresh summary data
      if (currentSequence) {
        const DENO_API_URL = import.meta.env.VITE_DENO_API_URL || 'https://broadcast-hub.deno.dev'
        const response = await fetch(`${DENO_API_URL}/api/broadcast/summary?sequence_id=${currentSequence.id}`)
        const data = await response.json()
        if (data.success) {
          setSummaryData(data)
        }
      }

      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Scheduled message has been cancelled.',
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (error) {
      console.error('Error deleting scheduled message:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Delete',
        text: 'Could not delete scheduled message',
      })
    }
  }

  // Handler to export recipients to CSV
  const handleExportCSV = () => {
    if (recipientsData.length === 0) return

    const headers = ['Name', 'Phone Number', 'Scheduled Time', 'Status']
    const rows = recipientsData.map(r => [
      r.prospect_name,
      r.prospect_num,
      new Date(r.scheduled_time).toLocaleString('en-GB'),
      r.status,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `recipients_flow${recipientsFlowNumber}_${recipientsStatus}.csv`
    link.click()
  }

  const handleToggleStatus = async (sequence: Sequence) => {
    try {
      const newStatus = sequence.status === 'active' ? 'inactive' : 'active'

      // If changing from Pending to Lock, validate and call Deno Deploy to schedule messages
      if (newStatus === 'active') {
        // Validate required fields
        if (!sequence.schedule_date || !sequence.schedule_time) {
          await Swal.fire({
            icon: 'warning',
            title: 'Missing Schedule',
            text: 'Please set Schedule Date and Time before locking the broadcast.',
          })
          return
        }

        if (!sequence.device_id || !sequence.category_id) {
          await Swal.fire({
            icon: 'warning',
            title: 'Missing Configuration',
            text: 'Please select Device and Category before locking the broadcast.',
          })
          return
        }

        // Check if device is connected
        const { data: deviceStatus, error: deviceError } = await supabase
          .from('device_setting')
          .select('status, device_id')
          .eq('id', sequence.device_id)
          .single()

        if (deviceError || !deviceStatus) {
          await Swal.fire({
            icon: 'error',
            title: 'Device Not Found',
            text: 'Could not verify device status. Please try again.',
          })
          return
        }

        if (deviceStatus.status !== 'Connected') {
          await Swal.fire({
            icon: 'error',
            title: 'Device Not Connected',
            html: `
              <p>The device <strong>${deviceStatus.device_id}</strong> is not connected.</p>
              <p class="mt-2">Current status: <span class="text-red-600 font-bold">${deviceStatus.status || 'UNKNOWN'}</span></p>
              <p class="mt-3 text-gray-600">Please connect your WhatsApp device first before locking the broadcast.</p>
            `,
          })
          return
        }

        // Validate schedule date is at least tomorrow
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const scheduleDate = new Date(sequence.schedule_date)
        scheduleDate.setHours(0, 0, 0, 0)

        if (scheduleDate < tomorrow) {
          const result = await Swal.fire({
            icon: 'warning',
            title: 'Schedule Date Too Soon',
            html: `
              <p>The schedule date must be at least <strong>tomorrow</strong> to lock the broadcast.</p>
              <p class="mt-3"><strong>Current Schedule:</strong></p>
              <p class="text-red-600 font-semibold">${new Date(sequence.schedule_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${sequence.schedule_time}</p>
              <p class="mt-3 text-gray-600">Please update the schedule date to tomorrow or later, then try again.</p>
            `,
            showCancelButton: true,
            confirmButtonText: 'Edit Schedule',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#3b82f6',
          })

          if (result.isConfirmed) {
            // Open edit modal for this sequence
            handleEditSequence(sequence)
          }
          return
        }

        // Confirm action
        const result = await Swal.fire({
          icon: 'question',
          title: 'Lock Broadcast?',
          html: `
            <p>This will schedule messages for all leads in this category.</p>
            <p class="mt-2"><strong>Schedule:</strong> ${new Date(sequence.schedule_date).toLocaleDateString('en-GB')} ${sequence.schedule_time}</p>
            <p><strong>Category:</strong> ${sequence.category?.name || 'Unknown'}</p>
            <p><strong>Total Leads:</strong> ${sequence.category?.leads_count || 0}</p>
          `,
          showCancelButton: true,
          confirmButtonText: 'Yes, Lock it',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#22c55e',
        })

        if (!result.isConfirmed) return

        // Show loading
        Swal.fire({
          title: 'Scheduling Messages...',
          html: 'Please wait while we schedule messages for all leads.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading()
          },
        })

        // Call Deno Deploy endpoint to schedule messages
        const DENO_API_URL = import.meta.env.VITE_DENO_API_URL || 'https://broadcast-hub.deno.dev'

        const response = await fetch(`${DENO_API_URL}/api/broadcast/lock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sequence_id: sequence.id,
          }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to schedule messages')
        }

        await Swal.fire({
          icon: 'success',
          title: 'Broadcast Locked!',
          html: `
            <p>Messages have been scheduled successfully.</p>
            <p class="mt-2"><strong>Total Leads:</strong> ${data.total_leads}</p>
            <p><strong>Messages Scheduled:</strong> ${data.total_scheduled}</p>
            ${data.total_failed > 0 ? `<p class="text-red-600"><strong>Failed:</strong> ${data.total_failed}</p>` : ''}
          `,
          timer: 5000,
          showConfirmButton: true,
        })

        loadSequences()
        return
      }

      // If changing from Lock to Pending (unlock), this shouldn't happen because toggle is disabled when active
      // But keeping the logic here for completeness
      const { error } = await supabase
        .from('sequences')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sequence.id)

      if (error) throw error

      loadSequences()
    } catch (error: any) {
      console.error('Error toggling status:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Update Status',
        text: error.message || 'Failed to update status',
      })
    }
  }

  const handleOpenFlowEdit = (flowNumber: number, isCreateMode: boolean = false) => {
    setCurrentFlowNumber(flowNumber)

    if (isCreateMode) {
      // Load from tempFlows
      const existingFlow = tempFlows.find(f => f.flow_number === flowNumber)
      if (existingFlow) {
        setFlowFormData({
          flow_number: existingFlow.flow_number,
          step_trigger: existingFlow.step_trigger,
          next_trigger: existingFlow.next_trigger || '',
          delay_hours: existingFlow.delay_hours,
          message: existingFlow.message,
          image_url: existingFlow.image_url || '',
          is_end: existingFlow.is_end,
        })
      } else {
        resetFlowForm()
        setFlowFormData({ ...flowFormData, flow_number: flowNumber })
      }
    } else {
      // Load from sequenceFlows
      const existingFlow = sequenceFlows.find(f => f.flow_number === flowNumber)
      if (existingFlow) {
        setFlowFormData({
          flow_number: existingFlow.flow_number,
          step_trigger: existingFlow.step_trigger,
          next_trigger: existingFlow.next_trigger || '',
          delay_hours: existingFlow.delay_hours,
          message: existingFlow.message,
          image_url: existingFlow.image_url || '',
          is_end: existingFlow.is_end,
        })
      } else {
        resetFlowForm()
        setFlowFormData({ ...flowFormData, flow_number: flowNumber })
      }
    }

    setShowFlowEditModal(true)
  }

  const handleSaveFlowInCreate = async () => {
    // Auto-generate step_trigger from sequence trigger and flow number
    const stepTrigger = `${formData.trigger}_flow${currentFlowNumber}`
    const nextTrigger = `${formData.trigger}_flow${currentFlowNumber + 1}`

    // Save to tempFlows for create modal
    const newFlow: SequenceFlow = {
      id: `temp-${currentFlowNumber}`,
      sequence_id: '',
      flow_number: currentFlowNumber,
      step_trigger: stepTrigger,
      next_trigger: nextTrigger,
      delay_hours: flowFormData.delay_hours,
      message: flowFormData.message,
      image_url: flowFormData.image_url || null,
      is_end: false, // Auto-set to false
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const updatedFlows = tempFlows.filter(f => f.flow_number !== currentFlowNumber)
    setTempFlows([...updatedFlows, newFlow])
    setShowFlowEditModal(false)
    resetFlowForm()

    // Show success message
    await Swal.fire({
      icon: 'success',
      title: 'Flow Saved!',
      text: `Flow ${currentFlowNumber} has been saved successfully.`,
      timer: 2000,
      showConfirmButton: false,
    })
  }

  const handleSaveFlowInEdit = async () => {
    if (!currentSequence) return

    try {
      // Auto-generate step_trigger from sequence trigger and flow number
      const stepTrigger = `${currentSequence.trigger}_flow${currentFlowNumber}`
      const nextTrigger = `${currentSequence.trigger}_flow${currentFlowNumber + 1}`

      // Check if flow already exists
      const existingFlow = sequenceFlows.find(f => f.flow_number === currentFlowNumber)

      if (existingFlow) {
        // Update existing flow
        const { error } = await supabase
          .from('sequence_flows')
          .update({
            step_trigger: stepTrigger,
            next_trigger: nextTrigger,
            delay_hours: flowFormData.delay_hours,
            message: flowFormData.message,
            image_url: flowFormData.image_url || null,
            is_end: false, // Auto-set to false
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFlow.id)

        if (error) throw error
      } else {
        // Create new flow
        const { error } = await supabase
          .from('sequence_flows')
          .insert({
            sequence_id: currentSequence.id,
            flow_number: currentFlowNumber,
            step_trigger: stepTrigger,
            next_trigger: nextTrigger,
            delay_hours: flowFormData.delay_hours,
            message: flowFormData.message,
            image_url: flowFormData.image_url || null,
            is_end: false, // Auto-set to false
          })

        if (error) throw error
      }

      // Reload flows
      const { data: flowsData } = await supabase
        .from('sequence_flows')
        .select('*')
        .eq('sequence_id', currentSequence.id)
        .order('flow_number', { ascending: true })

      setSequenceFlows(flowsData || [])
      setShowFlowEditModal(false)
      resetFlowForm()

      await Swal.fire({
        icon: 'success',
        title: 'Flow Saved!',
        text: `Flow ${currentFlowNumber} has been saved successfully.`,
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (error: any) {
      console.error('Error saving flow:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Save Flow',
        text: error.message || 'Failed to save flow',
      })
    }
  }


  const resetForm = () => {
    setFormData({
      name: '',
      device_id: '',
      category_id: '',
      niche: '',
      trigger: '',
      description: '',
      schedule_date: '',
      schedule_time: '09:00',
      min_delay: 5,
      max_delay: 15,
      status: 'inactive',
    })
    setContactCategories([])
  }

  const resetFlowForm = () => {
    setFlowFormData({
      flow_number: 1,
      step_trigger: '',
      next_trigger: '',
      delay_hours: 24,
      message: '',
      image_url: '',
      is_end: false,
    })
  }


  const isFlowSet = (flowNumber: number, isCreateMode: boolean = false) => {
    if (isCreateMode) {
      return tempFlows.some(f => f.flow_number === flowNumber)
    } else {
      return sequenceFlows.some(f => f.flow_number === flowNumber)
    }
  }

  // Get tomorrow's date in YYYY-MM-DD format for min date
  const getTomorrowDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  // Filter sequences based on date range and status
  const filteredSequences = sequences.filter((sequence) => {
    // Filter by status
    if (filterStatus !== 'all' && sequence.status !== filterStatus) {
      return false
    }

    // Filter by date range (based on schedule_date)
    if (sequence.schedule_date) {
      const scheduleDate = new Date(sequence.schedule_date)
      const startDate = new Date(filterStartDate)
      const endDate = new Date(filterEndDate)

      // Set time to start of day for comparison
      scheduleDate.setHours(0, 0, 0, 0)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)

      if (scheduleDate < startDate || scheduleDate > endDate) {
        return false
      }
    }

    return true
  })

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Broadcast</h2>
            <p className="text-gray-600">Create automated drip campaigns for your contacts</p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(true)
              setTempFlows([])
              setCurrentSequence(null) // Clear to ensure Create mode, not Edit mode
            }}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <span>⊕</span>
            <span>Create Broadcast</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive' | 'finish')}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="active">Lock</option>
                <option value="inactive">Pending</option>
                <option value="finish">Finish</option>
              </select>
            </div>
            <div>
              <button
                onClick={() => {
                  setFilterStartDate(getFirstDayOfMonth())
                  setFilterEndDate(getLastDayOfMonth())
                  setFilterStatus('all')
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Broadcast List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading broadcast...</p>
          </div>
        ) : filteredSequences.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-600 text-lg">
              {sequences.length === 0 ? 'No broadcast created yet' : 'No broadcast found matching filters'}
            </p>
            <p className="text-gray-500 mt-2">
              {sequences.length === 0 ? 'Click "Create Broadcast" to get started' : 'Try adjusting your filter criteria'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSequences.map((sequence) => (
              <div key={sequence.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{sequence.name}</h3>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        sequence.status === 'finish'
                          ? 'bg-blue-100 text-blue-700'
                          : sequence.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {sequence.status === 'finish' ? 'Finish' : sequence.status === 'active' ? 'Lock' : 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500">Device: <span className="text-gray-900 font-medium">{sequence.device?.device_id || 'Not set'}</span></p>
                  </div>
                  <div>
                    <p className="text-gray-500">Category: <span className="text-gray-900 font-medium">{sequence.category?.name || 'Not set'}</span></p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Leads: <span className="text-primary-600 font-bold">{sequence.category?.leads_count || 0}</span></p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Flows: <span className="text-purple-600 font-bold">{sequence.flows_count || 0}</span></p>
                  </div>
                  <div>
                    <p className="text-gray-500">Schedule: <span className="text-gray-900 font-medium">
                      {sequence.schedule_date
                        ? `${new Date(sequence.schedule_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')} ${sequence.schedule_time ? new Date(`2000-01-01T${sequence.schedule_time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '09:00 AM'}`
                        : 'Not scheduled'}
                    </span></p>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* View button - always visible for ALL sequences regardless of status */}
                  <button
                    onClick={() => handleViewSequence(sequence)}
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors font-medium text-sm"
                  >
                    👁 View
                  </button>
                  {/* Show Summary button for finished sequences */}
                  {sequence.status === 'finish' && (
                    <button
                      onClick={() => handleShowSummary(sequence)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors font-medium text-sm"
                    >
                      📊 Summary
                    </button>
                  )}
                  {/* Only show Update and Delete buttons when status is Pending (inactive) */}
                  {sequence.status === 'inactive' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSequence(sequence)}
                        className="flex-1 bg-white border border-green-400 text-green-600 px-3 py-2 rounded-md transition-colors font-medium text-sm hover:bg-green-50"
                      >
                        ✎ Update
                      </button>
                      <button
                        onClick={() => handleDeleteSequence(sequence.id)}
                        className="flex-1 bg-white border border-red-400 text-red-600 px-3 py-2 rounded-md transition-colors font-medium text-sm hover:bg-red-50"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  )}
                  {/* Only show status toggle for pending sequences */}
                  {sequence.status === 'inactive' && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-600">Status:</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => handleToggleStatus(sequence)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          Pending
                        </span>
                      </label>
                    </div>
                  )}
                  {/* Show locked status indicator for active sequences */}
                  {sequence.status === 'active' && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-600">Status:</span>
                      <div className="flex items-center">
                        <div className="w-11 h-6 bg-green-600 rounded-full relative">
                          <div className="absolute top-[2px] right-[2px] bg-white border-gray-300 border rounded-full h-5 w-5"></div>
                        </div>
                        <span className="ml-2 text-sm font-medium text-green-700">Lock</span>
                      </div>
                    </div>
                  )}
                  {/* Show finished status indicator for finish sequences */}
                  {sequence.status === 'finish' && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-600">Status:</span>
                      <div className="flex items-center">
                        <div className="w-11 h-6 bg-blue-600 rounded-full relative">
                          <div className="absolute top-[2px] right-[2px] bg-white border-gray-300 border rounded-full h-5 w-5"></div>
                        </div>
                        <span className="ml-2 text-sm font-medium text-blue-700">Finish</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Broadcast Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 w-full max-w-5xl my-8 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Create New Broadcast</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                    setTempFlows([])
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateSequence} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Broadcast Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Device <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.device_id}
                      onChange={(e) => {
                        const deviceId = e.target.value
                        setFormData({ ...formData, device_id: deviceId, category_id: '' })
                        loadContactCategories(deviceId)
                      }}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="">Select Device</option>
                      {devices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.device_id} ({device.phone_number || 'No phone'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category Contact <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                      disabled={!formData.device_id}
                    >
                      <option value="">
                        {formData.device_id ? 'Select Category Contact' : 'Select Device First'}
                      </option>
                      {contactCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.leads_count || 0} leads)
                        </option>
                      ))}
                    </select>
                    {formData.device_id && contactCategories.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No categories found for this device. Create categories first.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.schedule_date}
                      onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                      min={getTomorrowDate()}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Min date: Tomorrow</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.schedule_time}
                      onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.min_delay}
                      onChange={(e) => setFormData({ ...formData, min_delay: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.max_delay}
                      onChange={(e) => setFormData({ ...formData, max_delay: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>
                </div>

                {/* Broadcast Flow Grid */}
                <div className="mt-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Broadcast Flow</h4>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((flowNum) => (
                      <button
                        key={flowNum}
                        type="button"
                        onClick={() => handleOpenFlowEdit(flowNum, true)}
                        className={`px-3 py-6 rounded-lg border-2 font-medium text-sm transition-colors ${
                          isFlowSet(flowNum, true)
                            ? 'bg-green-50 border-green-400 text-green-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-bold mb-1">Flow {flowNum}</div>
                          <div className="text-xs">
                            {isFlowSet(flowNum, true) ? (
                              <span className="text-green-600">✓ Set</span>
                            ) : (
                              <span className="text-gray-500">⊕ Add</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      resetForm()
                      setTempFlows([])
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Create Broadcast
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Broadcast Modal */}
        {showEditModal && currentSequence && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 w-full max-w-5xl my-8 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Edit Broadcast</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setCurrentSequence(null)
                    setSequenceFlows([])
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleUpdateSequence} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Broadcast Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Device <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.device_id}
                      onChange={(e) => {
                        const deviceId = e.target.value
                        setFormData({ ...formData, device_id: deviceId, category_id: '' })
                        loadContactCategories(deviceId)
                      }}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="">Select Device</option>
                      {devices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.device_id} ({device.phone_number || 'No phone'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category Contact <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                      disabled={!formData.device_id}
                    >
                      <option value="">
                        {formData.device_id ? 'Select Category Contact' : 'Select Device First'}
                      </option>
                      {contactCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.leads_count || 0} leads)
                        </option>
                      ))}
                    </select>
                    {formData.device_id && contactCategories.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No categories found for this device. Create categories first.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.schedule_date}
                      onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                      min={getTomorrowDate()}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Min date: Tomorrow</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.schedule_time}
                      onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.min_delay}
                      onChange={(e) => setFormData({ ...formData, min_delay: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Delay (seconds)</label>
                    <input
                      type="number"
                      value={formData.max_delay}
                      onChange={(e) => setFormData({ ...formData, max_delay: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="0"
                    />
                  </div>
                </div>

                {/* Broadcast Flow Grid */}
                <div className="mt-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Broadcast Flow</h4>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((flowNum) => (
                      <button
                        key={flowNum}
                        type="button"
                        onClick={() => handleOpenFlowEdit(flowNum, false)}
                        className={`px-3 py-6 rounded-lg border-2 font-medium text-sm transition-colors ${
                          isFlowSet(flowNum, false)
                            ? 'bg-green-50 border-green-400 text-green-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-bold mb-1">Flow {flowNum}</div>
                          <div className="text-xs">
                            {isFlowSet(flowNum, false) ? (
                              <span className="text-green-600">✓ Set</span>
                            ) : (
                              <span className="text-gray-500">⊕ Add</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setCurrentSequence(null)
                      setSequenceFlows([])
                      resetForm()
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Update Broadcast
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Summary Modal */}
        {showSummaryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] overflow-y-auto">
            <div className="bg-white rounded-xl w-full max-w-5xl my-8 shadow-xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{currentSequence?.name || 'Broadcast Summary'}</h3>
                    <p className="text-blue-100 mt-1">
                      {summaryData?.sequence.category_name || 'Category'} •
                      {summaryData?.sequence.schedule_date ? ` ${new Date(summaryData.sequence.schedule_date).toLocaleDateString('en-GB')}` : ''}
                      {summaryData?.sequence.schedule_time ? ` ${summaryData.sequence.schedule_time}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSummaryModal(false)
                      setSummaryData(null)
                      setCurrentSequence(null)
                    }}
                    className="text-white/80 hover:text-white text-3xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              {summaryLoading ? (
                <div className="p-12 text-center">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
                  <p className="mt-4 text-gray-600">Loading summary...</p>
                </div>
              ) : summaryData ? (
                <div className="p-6">
                  {/* Overall Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-600 font-medium uppercase">Should Send</p>
                      <p className="text-3xl font-bold text-gray-900">{summaryData.overall.should_send}</p>
                      <p className="text-xs text-gray-500">Total Messages</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-green-600 font-medium uppercase">Sent</p>
                      <p className="text-3xl font-bold text-green-700">{summaryData.overall.sent}</p>
                      <p className="text-xs text-green-500">{summaryData.overall.sent_percentage}%</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-red-600 font-medium uppercase">Failed</p>
                      <p className="text-3xl font-bold text-red-700">{summaryData.overall.failed}</p>
                      <p className="text-xs text-red-500">{summaryData.overall.failed_percentage}%</p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-yellow-600 font-medium uppercase">Remaining</p>
                      <p className="text-3xl font-bold text-yellow-700">{summaryData.overall.remaining}</p>
                      <p className="text-xs text-yellow-500">{summaryData.overall.remaining_percentage}%</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-purple-600 font-medium uppercase">Total Leads</p>
                      <p className="text-3xl font-bold text-purple-700">{summaryData.overall.total_leads}</p>
                      <p className="text-xs text-purple-500">Unique Recipients</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-blue-600 font-medium uppercase">Success Rate</p>
                      <p className="text-3xl font-bold text-blue-700">{summaryData.overall.success_rate}%</p>
                      <p className="text-xs text-blue-500">Sent vs Total</p>
                    </div>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="mb-8">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Overall Progress</h4>
                    <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden flex">
                      <div
                        className="bg-green-500 h-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${summaryData.overall.sent_percentage}%` }}
                      >
                        {parseFloat(summaryData.overall.sent_percentage) > 5 ? `Sent: ${summaryData.overall.sent_percentage}%` : ''}
                      </div>
                      <div
                        className="bg-red-500 h-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${summaryData.overall.failed_percentage}%` }}
                      >
                        {parseFloat(summaryData.overall.failed_percentage) > 5 ? `Failed: ${summaryData.overall.failed_percentage}%` : ''}
                      </div>
                      <div
                        className="bg-yellow-400 h-full flex items-center justify-center text-xs text-gray-700 font-medium"
                        style={{ width: `${summaryData.overall.remaining_percentage}%` }}
                      >
                        {parseFloat(summaryData.overall.remaining_percentage) > 5 ? `Remaining: ${summaryData.overall.remaining_percentage}%` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Step-wise Progress */}
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Step-wise Progress</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase">Step</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase">Step Name</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase">Image</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase">Should Send</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase">Sent</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase">Failed</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase">Remaining</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase w-28">Progress</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {summaryData.step_progress.map((step) => (
                            <tr key={step.step} className="hover:bg-gray-50">
                              <td className="px-3 py-3 text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full font-bold text-sm">
                                  {step.step}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-700 max-w-[150px]">
                                <p className="line-clamp-2" title={step.step_name}>{step.step_name}</p>
                              </td>
                              <td className="px-3 py-3 text-center">
                                {step.image_url ? (
                                  <img src={step.image_url} alt="" className="w-10 h-10 object-cover rounded mx-auto" />
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => handleShowRecipients(step.step, 'should_send', `Flow ${step.step} - All Recipients`)}
                                  className="font-bold text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
                                  title="Click to view all recipients"
                                >
                                  {step.should_send}
                                </button>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => handleShowRecipients(step.step, 'sent', `Flow ${step.step} - Sent`)}
                                  className="font-bold text-green-600 hover:text-green-800 hover:underline cursor-pointer"
                                  title="Click to view sent recipients"
                                >
                                  {step.sent}
                                </button>
                                <span className="text-xs text-green-500 block">{step.sent_percentage}%</span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => handleShowRecipients(step.step, 'failed', `Flow ${step.step} - Failed`)}
                                  className="font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                                  title="Click to view failed recipients"
                                >
                                  {step.failed}
                                </button>
                                <span className="text-xs text-red-500 block">{step.failed_percentage}%</span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => handleShowRecipients(step.step, 'remaining', `Flow ${step.step} - Remaining`)}
                                  className="font-bold text-yellow-600 hover:text-yellow-800 hover:underline cursor-pointer"
                                  title="Click to view remaining recipients"
                                >
                                  {step.remaining}
                                </button>
                                <span className="text-xs text-yellow-500 block">{step.remaining_percentage}%</span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="bg-green-500 h-full"
                                    style={{ width: `${step.progress}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-center text-gray-500 mt-1">{step.progress}%</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-gray-600">No summary data available</p>
                </div>
              )}

              {/* Footer */}
              <div className="border-t p-4 flex justify-end">
                <button
                  onClick={() => {
                    setShowSummaryModal(false)
                    setSummaryData(null)
                    setCurrentSequence(null)
                  }}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Flow Edit Modal */}
        {showFlowEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Flow {currentFlowNumber} Message</h3>
                <button
                  onClick={() => {
                    setShowFlowEditModal(false)
                    resetFlowForm()
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delay Hours</label>
                  <input
                    type="number"
                    value={flowFormData.delay_hours}
                    onChange={(e) => setFlowFormData({ ...flowFormData, delay_hours: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Hours to wait before next step</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <textarea
                    id="flow-message"
                    value={flowFormData.message}
                    onChange={(e) => setFlowFormData({ ...flowFormData, message: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={6}
                    placeholder="Enter your message..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>WhatsApp Formatting:</strong> *bold* | _italic_ | ~strikethrough~ | ```monospace``` | 😊 Emojis supported
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Live Preview</h4>
                  {/* Show selected image preview above message */}
                  {flowFormData.image_url && (
                    <div className="mb-3">
                      <img
                        src={flowFormData.image_url}
                        alt="Preview"
                        className="max-w-full max-h-48 rounded-lg border border-gray-300 object-contain"
                      />
                    </div>
                  )}
                  <div className="text-sm text-gray-600 whitespace-pre-wrap min-h-[60px]">
                    {flowFormData.message || 'Your formatted message will appear here...'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image (Optional)</label>
                  <select
                    value={flowFormData.image_url}
                    onChange={(e) => setFlowFormData({ ...flowFormData, image_url: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select Image from Bank</option>
                    {bankImages.map((image) => (
                      <option key={image.id} value={image.image_url}>
                        {image.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select an image from your bank images</p>
                </div>

                <div className="flex gap-4 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFlowEditModal(false)
                      resetFlowForm()
                    }}
                    className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!flowFormData.message) {
                        Swal.fire({
                          icon: 'warning',
                          title: 'Missing Required Fields',
                          text: 'Please fill in the Message field',
                        })
                        return
                      }

                      if (currentSequence) {
                        handleSaveFlowInEdit()
                      } else {
                        handleSaveFlowInCreate()
                      }
                    }}
                    className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Finish
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Modal - Read-only */}
        {showViewModal && viewSequence && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl w-full max-w-5xl my-8 shadow-xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{viewSequence.name}</h3>
                    <p className="text-gray-200 mt-1">Read-only View</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        viewSequence.status === 'finish'
                          ? 'bg-blue-500 text-white'
                          : viewSequence.status === 'active'
                          ? 'bg-green-500 text-white'
                          : 'bg-yellow-500 text-white'
                      }`}
                    >
                      {viewSequence.status === 'finish' ? 'Finish' : viewSequence.status === 'active' ? 'Lock' : 'Pending'}
                    </span>
                    <button
                      onClick={() => {
                        setShowViewModal(false)
                        setViewSequence(null)
                        setViewFlows([])
                      }}
                      className="text-white/80 hover:text-white text-3xl"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Broadcast Details - Read-only */}
                <div className="mb-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Broadcast Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Device</p>
                      <p className="text-gray-900 font-medium">{viewSequence.device?.device_id || 'Not set'}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Category</p>
                      <p className="text-gray-900 font-medium">{viewSequence.category?.name || 'Not set'}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Total Leads</p>
                      <p className="text-primary-600 font-bold text-lg">{viewSequence.category?.leads_count || 0}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Schedule Date</p>
                      <p className="text-gray-900 font-medium">
                        {viewSequence.schedule_date
                          ? new Date(viewSequence.schedule_date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            }).replace(/\//g, '-')
                          : 'Not scheduled'}
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Schedule Time</p>
                      <p className="text-gray-900 font-medium">
                        {viewSequence.schedule_time
                          ? new Date(`2000-01-01T${viewSequence.schedule_time}`).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '09:00 AM'}
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Delay Range</p>
                      <p className="text-gray-900 font-medium">{viewSequence.min_delay || 5}s - {viewSequence.max_delay || 15}s</p>
                    </div>
                  </div>
                </div>

                {/* Flow Grid - Read-only */}
                <div className="mb-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Broadcast Flow</h4>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((flowNum) => {
                      const flow = viewFlows.find(f => f.flow_number === flowNum)
                      const isSet = !!flow
                      return (
                        <div
                          key={flowNum}
                          className={`px-3 py-6 rounded-lg border-2 font-medium text-sm ${
                            isSet
                              ? 'bg-green-50 border-green-400 text-green-700 cursor-pointer hover:bg-green-100'
                              : 'bg-gray-50 border-gray-200 text-gray-400'
                          }`}
                          onClick={() => {
                            if (flow) {
                              Swal.fire({
                                title: `Flow ${flowNum} Message`,
                                html: `
                                  <div class="text-left">
                                    <div class="mb-4">
                                      <label class="text-xs text-gray-500 font-medium uppercase">Delay Hours</label>
                                      <p class="text-gray-900 font-medium">${flow.delay_hours} hours</p>
                                    </div>
                                    ${flow.image_url ? `
                                      <div class="mb-4">
                                        <label class="text-xs text-gray-500 font-medium uppercase">Image</label>
                                        <img src="${flow.image_url}" alt="Flow image" class="w-full max-w-xs rounded-lg mt-2 border" />
                                      </div>
                                    ` : ''}
                                    <div>
                                      <label class="text-xs text-gray-500 font-medium uppercase">Message</label>
                                      <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-1 whitespace-pre-wrap text-sm text-gray-700 max-h-64 overflow-y-auto">${flow.message || 'No message'}</div>
                                    </div>
                                  </div>
                                `,
                                showCloseButton: true,
                                showConfirmButton: false,
                                width: '600px',
                                customClass: {
                                  popup: 'text-left'
                                }
                              })
                            }
                          }}
                        >
                          <div className="text-center">
                            <div className="font-bold mb-1">Flow {flowNum}</div>
                            <div className="text-xs">
                              {isSet ? (
                                <span className="text-green-600">✓ Set</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">Click on a green flow box to view its message content.</p>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t p-4 flex justify-end">
                <button
                  onClick={() => {
                    setShowViewModal(false)
                    setViewSequence(null)
                    setViewFlows([])
                  }}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recipients Modal */}
        {showRecipientsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70] overflow-y-auto">
            <div className="bg-white rounded-xl w-full max-w-3xl my-8 shadow-xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{recipientsTitle}</h3>
                    <p className="text-purple-200 mt-1">{recipientsData.length} recipient(s)</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowRecipientsModal(false)
                      setRecipientsData([])
                    }}
                    className="text-white/80 hover:text-white text-3xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              {recipientsLoading ? (
                <div className="p-12 text-center">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
                  <p className="mt-4 text-gray-600">Loading recipients...</p>
                </div>
              ) : recipientsData.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-gray-600">No recipients found</p>
                </div>
              ) : (
                <div className="p-6">
                  {/* Action buttons */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                    >
                      📥 Export CSV
                    </button>
                  </div>

                  {/* Recipients table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Phone Number</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Scheduled Time</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Status</th>
                          {(recipientsStatus === 'remaining' || recipientsStatus === 'failed') && (
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {recipientsData.map((recipient) => (
                          <tr key={recipient.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{recipient.prospect_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{recipient.prospect_num}</td>
                            <td className="px-4 py-3 text-center text-xs text-gray-600">
                              {recipient.scheduled_time
                                ? `${recipient.scheduled_time.substring(8, 10)}/${recipient.scheduled_time.substring(5, 7)}/${recipient.scheduled_time.substring(0, 4)}, ${recipient.scheduled_time.substring(11, 16)}`
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                recipient.status === 'sent' ? 'bg-green-100 text-green-700' :
                                recipient.status === 'failed' ? 'bg-red-100 text-red-700' :
                                recipient.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {recipient.status === 'scheduled' ? 'Remaining' : recipient.status.charAt(0).toUpperCase() + recipient.status.slice(1)}
                              </span>
                            </td>
                            {(recipientsStatus === 'remaining' || recipientsStatus === 'failed') && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => handleDeleteScheduled(recipient)}
                                  className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors"
                                  title="Delete scheduled message"
                                >
                                  🗑 Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="border-t p-4 flex justify-end">
                <button
                  onClick={() => {
                    setShowRecipientsModal(false)
                    setRecipientsData([])
                  }}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
