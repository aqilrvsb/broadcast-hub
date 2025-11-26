import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase, Lead, ContactCategory } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

export default function Leads() {
  const { deviceId, categoryId } = useParams<{ deviceId: string; categoryId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [category, setCategory] = useState<ContactCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'import'>('list')
  const [formData, setFormData] = useState({
    prospect_name: '',
    prospect_num: '',
    product: '',
    info: '',
  })
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])

  useEffect(() => {
    if (categoryId) {
      loadData()
    }
  }, [categoryId])

  const loadData = async () => {
    try {
      // Load category info
      const { data: categoryData, error: categoryError } = await supabase
        .from('contact_categories')
        .select('*')
        .eq('id', categoryId)
        .single()

      if (categoryError) throw categoryError
      setCategory(categoryData)

      // Load leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false })

      if (leadsError) throw leadsError
      setLeads(leadsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to load leads data',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id || !categoryId || !category) {
      return
    }

    try {
      const { error } = await supabase
        .from('leads')
        .insert({
          category_id: categoryId,
          device_id: category.device_id,
          prospect_name: formData.prospect_name.trim(),
          prospect_num: formData.prospect_num.trim(),
          product: formData.product.trim() || null,
          info: formData.info.trim() || null,
          user_id: user.id,
        })

      if (error) throw error

      setFormData({ prospect_name: '', prospect_num: '', product: '', info: '' })
      setActiveTab('list')

      await Swal.fire({
        icon: 'success',
        title: 'Lead Added!',
        text: 'Lead has been added successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadData()
    } catch (error: any) {
      console.error('Error adding lead:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Add Lead',
        text: error.message || 'Failed to add lead',
      })
    }
  }

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead)
    setFormData({
      prospect_name: lead.prospect_name,
      prospect_num: lead.prospect_num,
      product: lead.product || '',
      info: lead.info || '',
    })
    setShowEditModal(true)
  }

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingLead) return

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          prospect_name: formData.prospect_name.trim(),
          prospect_num: formData.prospect_num.trim(),
          product: formData.product.trim() || null,
          info: formData.info.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingLead.id)

      if (error) throw error

      setShowEditModal(false)
      setEditingLead(null)
      setFormData({ prospect_name: '', prospect_num: '', product: '', info: '' })

      await Swal.fire({
        icon: 'success',
        title: 'Lead Updated!',
        text: 'Lead has been updated successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadData()
    } catch (error: any) {
      console.error('Error updating lead:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Update Lead',
        text: error.message || 'Failed to update lead',
      })
    }
  }

  const handleDeleteLead = async (id: number) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Lead?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })

    if (!result.isConfirmed) return

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Lead has been deleted successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadData()
    } catch (error: any) {
      console.error('Error deleting lead:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Delete',
        text: error.message || 'Failed to delete lead',
      })
    }
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id || !categoryId || !category) return

    try {
      // Read file as text (CSV)
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        throw new Error('File must have at least one data row')
      }

      // Parse header
      const header = lines[0].toLowerCase()
      const isValidHeader = header.includes('name') && header.includes('phone')

      if (!isValidHeader) {
        throw new Error('File must have Name and Phone columns')
      }

      // Parse data rows
      const leadsToInsert = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        if (values.length >= 2 && values[0] && values[1]) {
          leadsToInsert.push({
            category_id: categoryId,
            device_id: category.device_id,
            prospect_name: values[0],
            prospect_num: values[1],
            product: values[2] || null,
            info: values[3] || null,
            user_id: user.id,
          })
        }
      }

      if (leadsToInsert.length === 0) {
        throw new Error('No valid leads found in file')
      }

      const { error } = await supabase
        .from('leads')
        .insert(leadsToInsert)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Import Successful!',
        text: `${leadsToInsert.length} leads have been imported.`,
        timer: 2000,
        showConfirmButton: false,
      })

      setActiveTab('list')
      loadData()
    } catch (error: any) {
      console.error('Error importing leads:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Import Failed',
        text: error.message || 'Failed to import leads',
      })
    }

    // Reset file input
    e.target.value = ''
  }

  const toggleSelectLead = (id: number) => {
    setSelectedLeads(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllLeads = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id))
    }
  }

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery ||
      lead.prospect_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.prospect_num.includes(searchQuery)
    return matchesSearch
  })

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading leads...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">👥</span>
            <h2 className="text-3xl font-bold text-gray-900">Contacts</h2>
          </div>
          <p className="text-gray-600">Manage your contact list and create batch call campaigns</p>
          <button
            onClick={() => navigate(`/contacts/${deviceId}`)}
            className="mt-4 text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            ← Back to Categories
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'list'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Contact List
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'add'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Add Contact
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'import'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Import Excel
          </button>
        </div>

        {/* Contact List Tab */}
        {activeTab === 'list' && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">👥</span>
                  <span className="text-lg font-bold text-gray-900">Contacts ({filteredLeads.length})</span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contacts..."
                    className="bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
                  />
                  <button
                    onClick={selectAllLeads}
                    className="px-4 py-2 bg-primary-50 text-primary-600 rounded-lg font-medium hover:bg-primary-100 transition-colors"
                  >
                    Select All
                  </button>
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
                    Count: {selectedLeads.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase w-12"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Phone Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        No contacts found. Add your first contact!
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={() => toggleSelectLead(lead.id)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{lead.prospect_name}</td>
                        <td className="px-4 py-3 text-gray-700">{lead.prospect_num}</td>
                        <td className="px-4 py-3 text-gray-700">
                          <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                            {category?.name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditLead(lead)}
                              className="text-gray-500 hover:text-primary-600 transition-colors"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="text-gray-500 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Contact Tab */}
        {activeTab === 'add' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm max-w-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Add New Contact</h3>
            <form onSubmit={handleAddLead} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.prospect_name}
                    onChange={(e) => setFormData({ ...formData, prospect_name: e.target.value })}
                    placeholder="Contact name"
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <input
                    type="text"
                    value={formData.prospect_num}
                    onChange={(e) => setFormData({ ...formData, prospect_num: e.target.value })}
                    placeholder="e.g., 60123456789"
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Add Contact
              </button>
            </form>
          </div>
        )}

        {/* Import Excel Tab */}
        {activeTab === 'import' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm max-w-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Import from Excel/CSV</h3>
            <div className="space-y-4">
              <p className="text-gray-600">
                Upload a CSV file with the following columns:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <code className="text-sm text-gray-700">
                  Name, Phone Number
                </code>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer"
                >
                  <div className="text-4xl mb-4">📄</div>
                  <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
                  <p className="text-gray-500 text-sm">CSV files only</p>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Edit Lead Modal */}
        {showEditModal && editingLead && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Edit Contact</h3>

              <form onSubmit={handleUpdateLead} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.prospect_name}
                    onChange={(e) => setFormData({ ...formData, prospect_name: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <input
                    type="text"
                    value={formData.prospect_num}
                    onChange={(e) => setFormData({ ...formData, prospect_num: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Update Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingLead(null)
                      setFormData({ prospect_name: '', prospect_num: '', product: '', info: '' })
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
