import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import QRCode from 'qrcode.react'
import { useToast } from '../components/Toast'

const ShipmentPass = () => {
  const { shipmentId } = useParams()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)

  // Real-time Firestore listener
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'shipments', shipmentId), (doc) => {
      if (doc.exists()) {
        setShipment(doc.data())
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [shipmentId])

  if (loading) {
    return (
      <div className="min-h-screen bg-navy text-white flex items-center justify-center">
        <p className="text-2xl font-bold">Loading pass...</p>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="min-h-screen bg-navy text-white flex items-center justify-center">
        <p className="text-red-500">Shipment not found</p>
      </div>
    )
  }

  const passUrl = `${window.location.origin}/pass/${shipmentId}`
  const statusColor =
    shipment.status === 'In Transit'
      ? 'text-blue-400'
      : shipment.status === 'Delayed'
        ? 'text-red-400'
        : 'text-green-400'
  const statusBgColor =
    shipment.status === 'In Transit'
      ? 'bg-blue-500'
      : shipment.status === 'Delayed'
        ? 'bg-red-500'
        : 'bg-green-500'

  const handleCopyPass = () => {
    navigator.clipboard.writeText(passUrl)
    alert('Pass URL copied to clipboard!')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 print:p-0">
      <div className="max-w-4xl mx-auto mt-8 print:mt-0">
        {/* Digital Pass Card */}
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden print:shadow-none print:rounded-none">
          {/* Header */}
          <div className="bg-gradient-to-r from-navy to-gray-900 text-white p-8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <img src="/logo.png" alt="RouteRadar Logo" className="w-16 h-16 rounded-full object-cover border-2 border-green-400" />
                <div>
                  <h1 className="text-2xl font-bold text-lime-green">RouteRadar</h1>
                  <p className="text-gray-300 text-sm">Verified Digital Shipment Pass</p>
                </div>
              </div>
              <div
                className={`${statusBgColor} text-white px-4 py-2 rounded font-bold text-sm`}
              >
                {shipment.status}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-8">
            {/* Shipment ID - Large and Bold */}
            <div className="mb-8 pb-8 border-b-2 border-gray-300">
              <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-2">
                Shipment ID
              </p>
              <p className="text-4xl font-black text-navy font-mono">
                {shipment.shipmentId}
              </p>
            </div>

            {/* Route Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* From */}
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-2">
                  Origin
                </p>
                <p className="text-2xl font-bold text-navy mb-4">{shipment.source}</p>
              </div>

              {/* To */}
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-2">
                  Destination
                </p>
                <p className="text-2xl font-bold text-navy mb-4">{shipment.destination}</p>
              </div>
            </div>

            {/* Cargo and Vehicle Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 pb-8 border-b-2 border-gray-300">
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-1">
                  Cargo Type
                </p>
                <p className="text-lg font-bold text-navy">{shipment.cargoType}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-1">
                  Vehicle Number
                </p>
                <p className="text-lg font-bold text-navy">{shipment.vehicleNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-1">
                  Driver Name
                </p>
                <p className="text-lg font-bold text-navy">{shipment.driverName}</p>
              </div>
            </div>

            {/* Party Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b-2 border-gray-300">
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-1">
                  Consignor (Sender)
                </p>
                <p className="text-lg font-bold text-navy">{shipment.consignorName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-1">
                  Consignee (Receiver)
                </p>
                <p className="text-lg font-bold text-navy">{shipment.consigneeName}</p>
              </div>
            </div>

            {/* Invoice and Timestamps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b-2 border-gray-300">
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-1">
                  Invoice / PO Number
                </p>
                <p className="text-lg font-bold text-navy font-mono">{shipment.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-1">
                  Departure Time
                </p>
                <p className="text-lg font-bold text-navy">
                  {new Date(shipment.departureTime).toLocaleString()}
                </p>
              </div>
            </div>

            {/* ETA and Risk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b-2 border-gray-300">
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-1">
                  Estimated Arrival
                </p>
                <p className="text-lg font-bold text-navy">
                  {new Date(shipment.updatedETA).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-1">
                  Current Risk Level
                </p>
                <p
                  className={`text-lg font-bold ${
                    shipment.currentRisk === 'High'
                      ? 'text-red-600'
                      : shipment.currentRisk === 'Medium'
                        ? 'text-yellow-600'
                        : 'text-green-600'
                  }`}
                >
                  {shipment.currentRisk}
                </p>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center justify-center py-8 border-b-2 border-gray-300 mb-8">
              <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-4">
                QR Code - Scan to Verify
              </p>
              <div className="bg-white p-4 rounded-lg border-2 border-navy">
                <QRCode value={passUrl} size={150} level="H" includeMargin={true} />
              </div>
            </div>

            {/* Verification Stamp */}
            <div className="text-center py-6">
              <div className="inline-block bg-gradient-to-r from-accent to-orange-500 text-white px-6 py-3 rounded-full font-bold">
                ✅ Verified by RouteRadar
              </div>
              <p className="text-xs text-gray-600 mt-4">
                This is an official RouteRadar digital shipment pass. Issued: {new Date().toLocaleString()}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-100 px-8 py-6 text-center text-xs text-gray-600 border-t border-gray-300">
            <p>For verification, scan the QR code or visit: {passUrl}</p>
            <p className="mt-2">RouteRadar - Smart Logistics Coordination System</p>
          </div>
        </div>

        {/* Action Buttons - Hidden on Print */}
        <div className="mt-6 space-y-3 print:hidden">
          <button
            onClick={handleCopyPass}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded"
          >
            📋 Copy Pass URL
          </button>
          <button
            onClick={handlePrint}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded"
          >
            🖨️ Print Pass
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShipmentPass
