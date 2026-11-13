import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, ExternalLink, LocateFixed, MapPin, Navigation, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { NearbyBusiness, QueueState } from './types'
import { calculateDistanceKm } from './utils/queueAssistant'

const KEMANG: [number, number] = [-6.2603, 106.8192]
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

function markerIcon(business: NearbyBusiness) {
  const color = business.live ? (business.kind === 'car-wash' ? '#147d9a' : '#0f766e') : '#8fa89f'
  const label = business.kind === 'car-wash' ? '🚙' : business.kind === 'barber' ? '✂' : '•'
  return L.divIcon({
    className: 'qease-map-marker-wrap',
    html: `<span class="qease-map-marker" style="--marker:${color}">${label}</span>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
  })
}

function MapCameraSync({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !target) return
    map.panTo({ lat: target[0], lng: target[1] })
    map.setZoom(15)
  }, [map, target])
  return null
}

function BusinessAdvancedMarker({
  business,
  liveState,
  userLocation,
  activeSlug,
  onSelect,
}: {
  business: NearbyBusiness
  liveState?: QueueState
  userLocation: [number, number] | null
  activeSlug: string | null
  onSelect: (slug: string | null) => void
}) {
  const [markerRef, marker] = useAdvancedMarkerRef()
  const isOpen = activeSlug === business.slug
  const waiting =
    liveState?.tickets.filter((t) => ['waiting', 'return-soon', 'called'].includes(t.status)).length ?? 0
  const distance = userLocation
    ? calculateDistanceKm(userLocation, [business.latitude, business.longitude])
    : null
  const pinColor = business.live
    ? liveState?.business.accentColor || (business.kind === 'car-wash' ? '#147d9a' : '#0f766e')
    : '#64748b'
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: business.latitude, lng: business.longitude }}
        title={business.name}
        onClick={() => onSelect(isOpen ? null : business.slug)}
      >
        <Pin
          background={pinColor}
          borderColor="#ffffff"
          glyphColor="#ffffff"
          scale={business.live ? 1.25 : 0.95}
        >
          {business.kind === 'car-wash' ? '🚙' : business.kind === 'barber' ? '✂' : '•'}
        </Pin>
      </AdvancedMarker>
      {isOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => onSelect(null)} maxWidth={250}>
          <div className="qease-map-popup">
            <b>{business.name}</b>
            <small>{business.category}</small>
            {business.live ? (
              <span className="map-popup-live">● Live on QEase</span>
            ) : (
              <span className="map-popup-soon">Coming soon</span>
            )}
            <p>
              {business.live ? `${waiting} in queue` : 'Not live yet'}
              {distance !== null
                ? ` · ${distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`} away`
                : ` · ${business.distance}`}
            </p>
            <div>
              {business.live && (
                <Link className="map-popup-queue" to={`/q/${business.slug}`}>
                  View queue
                </Link>
              )}
              <a
                className="map-popup-directions"
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Directions ↗
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  )
}

export function NearbyMap({
  businesses,
  states,
  userLocation: controlledLocation,
  onLocationChange,
}: {
  businesses: NearbyBusiness[]
  states: Partial<Record<string, QueueState>>
  userLocation?: [number, number] | null
  onLocationChange?: (coords: [number, number] | null) => void
}) {
  const element = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [internalLocation, setInternalLocation] = useState<[number, number] | null>(null)
  const location = controlledLocation !== undefined ? controlledLocation : internalLocation
  const [cameraTarget, setCameraTarget] = useState<[number, number]>(KEMANG)
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [quotaFallback, setQuotaFallback] = useState(false)
  const [message, setMessage] = useState(
    GOOGLE_MAPS_KEY
      ? 'Google Maps Platform active · tap "Near me" to match your real location'
      : 'Interactive map · tap "Near me" to match your real location',
  )

  const useGoogleMaps = Boolean(GOOGLE_MAPS_KEY) && !quotaFallback

  useEffect(() => {
    const onQuotaExceeded = () => {
      setQuotaFallback(true)
      setMessage('Switched to backup map view while Google Maps quota refreshes.')
    }
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded)
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded)
  }, [])

  const updateUserLocation = useCallback(
    (next: [number, number] | null) => {
      setInternalLocation(next)
      onLocationChange?.(next)
    },
    [onLocationChange],
  )

  const locate = useCallback(
    (silent = false) => {
      if (!navigator.geolocation) {
        if (!silent) setMessage('Location is not available in this browser.')
        return
      }
      if (!silent) setMessage('Finding your exact location to place nearby queues around you…')
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const next: [number, number] = [coords.latitude, coords.longitude]
          updateUserLocation(next)
          setCameraTarget(next)
          mapRef.current?.setView(next, 15)
          setMessage('Showing accurate distances & nearby QEase locations around you.')
        },
        () => {
          if (!silent) {
            setMessage('Location permission was not granted. Showing Kemang neighborhood queues.')
          }
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      )
    },
    [updateUserLocation],
  )

  // Automatically attempt silent geolocation on mount so the map is accurate near the user
  useEffect(() => {
    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (result.state === 'granted') {
            locate(true)
          }
        })
        .catch(() => {
          /* ignore */
        })
    }
  }, [locate])

  // Leaflet fallback when no VITE_GOOGLE_MAPS_API_KEY is present or on quota fallback
  useEffect(() => {
    if (useGoogleMaps || !element.current) return
    const map = L.map(element.current, { zoomControl: false, attributionControl: true }).setView(
      location ?? KEMANG,
      15,
    )
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [useGoogleMaps])

  useEffect(() => {
    if (useGoogleMaps) return
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    const popupHtml = (business: NearbyBusiness) => {
      const live = states[business.slug]
      const waiting = live?.tickets.filter((t) =>
        ['waiting', 'return-soon', 'called'].includes(t.status),
      ).length
      const distance = location
        ? calculateDistanceKm(location, [business.latitude, business.longitude])
        : null
      const directions = `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`
      const status = business.live
        ? `<span class="map-popup-live">● Live on QEase</span>`
        : '<span class="map-popup-soon">Coming soon</span>'
      const queue = business.live
        ? `<p>${waiting ?? 0} in queue${
            distance !== null
              ? ` · ${distance < 1 ? Math.round(distance * 1000) + ' m' : distance.toFixed(1) + ' km'} away`
              : ''
          }</p>`
        : `<p>${
            distance !== null
              ? `${distance < 1 ? Math.round(distance * 1000) + ' m' : distance.toFixed(1) + ' km'} away`
              : 'Not live yet'
          }</p>`
      const actions = business.live
        ? `<a class="map-popup-queue" href="/q/${business.slug}">View queue</a>`
        : ''
      return `<div class="qease-map-popup"><b>${business.name}</b><small>${business.category}</small>${status}${queue}<div>${actions}<a class="map-popup-directions" href="${directions}" target="_blank" rel="noreferrer">Directions ↗</a></div></div>`
    }

    businesses.forEach((business) => {
      L.marker([business.latitude, business.longitude], {
        icon: markerIcon(business),
        title: business.name,
      })
        .bindPopup(popupHtml(business))
        .addTo(layer)
    })

    if (location) {
      L.circleMarker(location, {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
      })
        .bindTooltip('You are here')
        .addTo(layer)
    }
  }, [businesses, states, location, useGoogleMaps])

  const recenterDefault = () => {
    updateUserLocation(null)
    setCameraTarget(KEMANG)
    mapRef.current?.setView(KEMANG, 15)
    setMessage('Map recentered on Kemang, Jakarta.')
  }

  return (
    <div className="interactive-map-shell">
      {useGoogleMaps && GOOGLE_MAPS_KEY ? (
        <APIProvider apiKey={GOOGLE_MAPS_KEY} libraries={['marker']}>
          <div
            className="interactive-map"
            style={{ width: '100%', height: '300px' }}
            aria-label="Interactive Google Map of nearby QEase businesses"
          >
            <GoogleMap
              defaultCenter={{ lat: cameraTarget[0], lng: cameraTarget[1] }}
              defaultZoom={15}
              mapId="DEMO_MAP_ID"
              gestureHandling="greedy"
              disableDefaultUI={false}
              streetViewControl={false}
              mapTypeControl={false}
              fullscreenControl={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '300px' }}
            >
              <MapCameraSync target={cameraTarget} />
              {businesses.map((business) => (
                <BusinessAdvancedMarker
                  key={business.slug}
                  business={business}
                  liveState={states[business.slug]}
                  userLocation={location}
                  activeSlug={activeSlug}
                  onSelect={setActiveSlug}
                />
              ))}
              {location && (
                <AdvancedMarker
                  position={{ lat: location[0], lng: location[1] }}
                  title="Your current location"
                >
                  <div className="qease-user-location-dot" aria-label="Your current location" />
                </AdvancedMarker>
              )}
            </GoogleMap>
          </div>
        </APIProvider>
      ) : (
        <div
          ref={element}
          className="interactive-map"
          aria-label="Interactive map of nearby QEase businesses"
        />
      )}

      <div className="map-overlay-title">
        <MapPin size={15} />
        <span>{location ? 'Near your current location' : 'Kemang, Jakarta'}</span>
      </div>
      <div className="map-overlay-controls">
        <button type="button" onClick={() => locate(false)}>
          <LocateFixed size={16} /> Near me
        </button>
        <button type="button" onClick={recenterDefault} aria-label="Recenter map on Kemang">
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="map-overlay-note">
        <Crosshair size={13} />
        {message}
      </div>
    </div>
  )
}

export function DirectionsLink({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <a
      className="directions-link"
      href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
      target="_blank"
      rel="noreferrer"
    >
      <Navigation size={15} /> Directions <ExternalLink size={13} />
    </a>
  )
}
