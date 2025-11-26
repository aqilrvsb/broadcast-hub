import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase, ContactCategory, Device } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

export default function Contacts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { deviceId } = useParams<{ deviceId: string }>()
  const [categories, setCategories] = useState<ContactCategory[]>([])
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
  })

  useEffect(() => {
    if (deviceId) {
      loadData()
    }
  }, [deviceId])

  const loadData = async () => {
    try {
      // Load current device
      const { data: deviceData, error: deviceError } = await supabase
        .from('device_setting')
        .select('*')
        .eq('id', deviceId)
        .single()

      if (deviceError) throw deviceError
      setCurrentDevice(deviceData)

      // Load contact categories for this device
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('contact_categories')
        .select('*')
        .eq('device_id', deviceId)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (categoriesError) throw categoriesError

      // Get leads count for each category
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
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

      setCategories(categoriesWithCounts)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      await Swal.fire({
        icon: 'error',
        title: 'Not Logged In',
        text: 'User not logged in',
      })
      return
    }

    if (!formData.name.trim()) {
      await Swal.fire({
        icon: 'error',
        title: 'Invalid Name',
        text: 'Please enter a category name',
      })
      return
    }

    if (!deviceId) {
      await Swal.fire({
        icon: 'error',
        title: 'No Device',
        text: 'Device not found',
      })
      return
    }

    try {
      const { error } = await supabase
        .from('contact_categories')
        .insert({
          name: formData.name.trim(),
          device_id: deviceId,
          user_id: user.id,
        })

      if (error) throw error

      setFormData({ name: '' })
      setShowAddModal(false)

      await Swal.fire({
        icon: 'success',
        title: 'Contact Category Created!',
        text: 'Your contact category has been created successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadData()
    } catch (error: any) {
      console.error('Error creating category:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Create Category',
        text: error.message || 'Failed to create contact category',
      })
    }
  }

  const handleDeleteCategory = async (id: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Contact Category?',
      text: 'This will also delete all leads in this category. This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })

    if (!result.isConfirmed) return

    try {
      // Delete all leads in this category first
      await supabase
        .from('leads')
        .delete()
        .eq('category_id', id)

      // Then delete the category
      const { error } = await supabase
        .from('contact_categories')
        .delete()
        .eq('id', id)

      if (error) throw error

      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Contact category has been deleted successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadData()
    } catch (error: any) {
      console.error('Error deleting category:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Delete',
        text: error.message || 'Failed to delete contact category',
      })
    }
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate('/device-settings')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium mb-2 flex items-center gap-1"
            >
              ← Back to Devices
            </button>
            <h2 className="text-3xl font-bold text-gray-900">Contact Categories</h2>
            <p className="text-gray-600">
              Device: <span className="font-semibold text-primary-600">{currentDevice?.device_id || 'Loading...'}</span>
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
          >
            + Add Contact Category
          </button>
        </div>

        {/* Categories List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-600 text-lg">No contact categories created yet</p>
            <p className="text-gray-500 mt-2">Click "Add Contact Category" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <div key={category.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{category.name}</h3>
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-primary-100 text-primary-700">
                    {category.leads_count || 0} Leads
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Created</p>
                    <p className="text-gray-900 font-medium text-sm">
                      {new Date(category.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => navigate(`/contacts/${deviceId}/leads/${category.id}`)}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2.5 rounded-lg transition-colors font-semibold text-sm shadow-sm"
                  >
                    View Leads
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="w-full bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Category Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Add Contact Category</h3>

              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Hot Leads, Cold Leads"
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Device</label>
                  <input
                    type="text"
                    value={currentDevice?.device_id || ''}
                    className="w-full bg-gray-100 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 cursor-not-allowed"
                    disabled
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Add Category
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setFormData({ name: '' })
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
