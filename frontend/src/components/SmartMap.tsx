import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Place {
  id: number
  name: string
  lat: number
  lon: number
  address: string
  tags: Record<string, string>
}

interface SmartMapProps {
  places: Place[]
  category: string
}

const createVintageIcon = (category: string) => {
  const iconColor = '#92400e'
  return L.divIcon({
    html: `
      <div style="
        background-color: ${iconColor};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid #fbbf24;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        ${category.charAt(0).toUpperCase()}
      </div>
    `,
    className: 'vintage-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  })
}

function MapBounds({ places }: { places: Place[] }) {
  const map = useMap()
  
  useEffect(() => {
    if (places.length > 0) {
      const bounds = L.latLngBounds(
        places.map(place => [place.lat, place.lon])
      )
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [places, map])
  
  return null
}

export function SmartMap({ places, category }: SmartMapProps) {
  const mapRef = useRef<L.Map>(null)
  
  const center = places.length > 0 
    ? [
        places.reduce((sum, place) => sum + place.lat, 0) / places.length,
        places.reduce((sum, place) => sum + place.lon, 0) / places.length
      ] as [number, number]
    : [48.8566, 2.3522] as [number, number]
  
  const formatAddress = (place: Place) => {
    if (place.address) return place.address
    return `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`
  }
  
  const getPlaceDetails = (place: Place): string[] => {
    const details: string[] = []
    if (place.tags.phone) details.push(`📞 ${place.tags.phone}`)
    if (place.tags.website) {
      const website = place.tags.website
      const displayText = website.length > 40 ? website.substring(0, 37) + '...' : website
      details.push(`🌐 ${displayText}`)
    }
    if (place.tags.opening_hours) details.push(`🕒 ${place.tags.opening_hours}`)
    
    // Handle other contact URLs
    Object.entries(place.tags).forEach(([key, value]) => {
      if (key.startsWith('contact:') && typeof value === 'string' && value.startsWith('http')) {
        const displayText = value.length > 40 ? value.substring(0, 37) + '...' : value
        details.push(`🔗 ${key.replace('contact:', '')}: ${displayText}`)
      }
    })
    
    return details
  }
  
  return (
    <div className="h-64 sm:h-80 md:h-96 w-full rounded-lg overflow-hidden border-2 border-amber-300 shadow-lg">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapBounds places={places} />
        
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lon]}
            icon={createVintageIcon(category)}
          >
            <Popup className="vintage-popup">
              <div className="font-serif text-amber-900 max-w-xs">
                <h3 className="font-bold text-sm sm:text-base md:text-lg mb-2 break-words overflow-wrap-anywhere">{place.name}</h3>
                <p className="text-xs sm:text-sm text-amber-700 mb-2 break-words overflow-wrap-anywhere">{formatAddress(place)}</p>
                {getPlaceDetails(place).map((detail, index) => (
                  <p key={index} className="text-xs text-amber-600 mb-1 break-words overflow-wrap-anywhere">{detail}</p>
                ))}
                {Object.entries(place.tags)
                  .filter(([key]) => !['name', 'phone', 'website', 'opening_hours', 'addr:full', 'addr:street', 'addr:city', 'addr:housenumber'].includes(key))
                  .slice(0, 2)
                  .map(([key, value]) => (
                    <span key={key} className="inline-block bg-amber-100 text-amber-800 text-xs px-1 sm:px-2 py-1 rounded mr-1 mb-1 break-words overflow-wrap-anywhere">
                      {key}: {value}
                    </span>
                  ))}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
