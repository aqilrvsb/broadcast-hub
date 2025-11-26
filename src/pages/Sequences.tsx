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
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  contact_count?: number
  device?: Device
  category?: ContactCategory
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
  const [currentSequence, setCurrentSequence] = useState<Sequence | null>(null)
  const [currentFlowNumber, setCurrentFlowNumber] = useState<number>(1)
  const [sequenceFlows, setSequenceFlows] = useState<SequenceFlow[]>([])
  const [tempFlows, setTempFlows] = useState<SequenceFlow[]>([]) // For create modal

  // Filter states
  const getFirstDayOfMonth = () => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  }
  const getLastDayOfMonth = () => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
  }
  const [filterStartDate, setFilterStartDate] = useState(getFirstDayOfMonth())
  const [filterEndDate, setFilterEndDate] = useState(getLastDayOfMonth())
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

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
    status: 'inactive' as 'active' | 'inactive',
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

            return {
              ...seq,
              contact_count: count || 0,
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

  const handleToggleStatus = async (sequence: Sequence) => {
    try {
      const newStatus = sequence.status === 'active' ? 'inactive' : 'active'

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

  const handleSaveFlowInCreate = () => {
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
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="active">Lock</option>
                <option value="inactive">Pending</option>
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
                        sequence.status === 'active'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {sequence.status === 'active' ? 'Lock' : 'Pending'}
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
                    <p className="text-gray-500">Schedule: <span className="text-gray-900 font-medium">
                      {sequence.schedule_date
                        ? `${new Date(sequence.schedule_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')} ${sequence.schedule_time ? new Date(`2000-01-01T${sequence.schedule_time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '09:00 AM'}`
                        : 'Not scheduled'}
                    </span></p>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Only show Update and Delete buttons when status is Pending (inactive) */}
                  {sequence.status !== 'active' && (
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
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-gray-600">Status:</span>
                    <label className={`relative inline-flex items-center ${sequence.status === 'active' ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={sequence.status === 'active'}
                        onChange={() => handleToggleStatus(sequence)}
                        disabled={sequence.status === 'active'}
                        className="sr-only peer"
                      />
                      <div className={`w-11 h-6 ${sequence.status === 'active' ? 'bg-red-600' : 'bg-gray-200'} peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600`}></div>
                      <span className={`ml-2 text-sm font-medium ${sequence.status === 'active' ? 'text-red-700' : 'text-gray-700'}`}>
                        {sequence.status === 'active' ? 'Lock' : 'Pending'}
                      </span>
                    </label>
                  </div>
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
      </div>
    </Layout>
  )
}
