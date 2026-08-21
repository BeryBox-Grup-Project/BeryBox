import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const BEKASI_CENTER = [-6.2383, 106.9756]

const listings = [
  { id: 1, title: 'Kursi Kerja', type: 'Donasi', position: [-6.2383, 106.9756] },
  { id: 2, title: 'Rak Buku', type: 'Jual', position: [-6.25, 106.99] },
  { id: 3, title: 'Kamera Analog', type: 'Lelang', position: [-6.22, 106.96] },
]

const listingMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function ExploreMapSection() {
  return (
    <main className="explore-page">
      <section className="explore-section" aria-labelledby="explore-title">
        <div className="explore-copy">
          <p className="explore-eyebrow">EXPLORE BERYBOX</p>
          <h1 id="explore-title">Barang baik nggak harus berhenti di kamu.</h1>
          <p className="explore-description">
            Temukan barang di sekitar kamu yang sedang didonasikan, dijual, atau
            dilelang. Beri barang kesempatan untuk berpindah ke tangan berikutnya.
          </p>
          <button className="explore-cta" type="button">
            Jelajahi Sekarang
          </button>
        </div>

        <div className="explore-map" aria-label="Peta listing beryBox di Bekasi">
          <MapContainer center={BEKASI_CENTER} zoom={12} scrollWheelZoom className="leaflet-map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {listings.map((listing) => (
              <Marker key={listing.id} position={listing.position} icon={listingMarkerIcon}>
                <Popup>
                  <strong>{listing.title}</strong>
                  <span>{listing.type}</span>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </section>
    </main>
  )
}

export default ExploreMapSection
