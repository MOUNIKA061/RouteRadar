import React, { useState } from 'react'
import { submitRerouteRequest } from '../utils/api'

const RerouteRequestModal = ({ isOpen, onClose, shipmentId, driverId, driverName, onSuccess }) => {
  const [formData, setFormData] = useState({
    reason: 'Road blocked',
    details: '',
    locationText: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reasons = [
    'Road blocked',
    'Accident ahead',
    'Severe weather',
    'Vehicle issue',
    'Heavy traffic',
    'Other',
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.locationText.trim()) {
        setError('Location is required')
        setLoading(false)
        return
      }

      const response = await submitRerouteRequest(
        shipmentId,
        driverId,
        driverName,
        formData.reason + (formData.details ? ': ' + formData.details : ''),
        formData.locationText,
        { lat: 0, lng: 0 } // Placeholder - could use geolocation
      )

      if (response.data.success) {
        setFormData({ reason: 'Road blocked', details: '', locationText: '' })
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit reroute request')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-96 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Request Reroute</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason Dropdown */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Disruption Reason *</label>
            <select
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-accent focus:outline-none"
            >
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Additional Details */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Additional Details</label>
            <textarea
              name="details"
              value={formData.details}
              onChange={handleChange}
              placeholder="Describe the situation (optional)"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-accent focus:outline-none text-sm"
              rows="3"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Current Location *</label>
            <input
              type="text"
              name="locationText"
              value={formData.locationText}
              onChange={handleChange}
              placeholder="Enter your current location"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-accent focus:outline-none"
            />
          </div>

          {/* Error Message */}
          {error && <div className="text-red-400 text-sm bg-red-900 bg-opacity-30 p-2 rounded">{error}</div>}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-accent hover:bg-accent-dark text-black rounded font-bold disabled:opacity-50"
            >
              {loading ? '📡 Sending...' : '🔄 Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RerouteRequestModal
