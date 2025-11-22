import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapboxConfig } from '@/functions/getMapboxConfig';

// Fix leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// A dedicated component to run inside the MapContainer to handle map updates.
const MapUpdater = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// Enhanced component to handle map events, specifically centering POI and popup
const MapPopupHandler = () => {
  const map = useMap();

  useEffect(() => {
    const onPopupOpen = (e) => {
      const latLng = e.popup.getLatLng();
      if (latLng) {
        // Wait for popup to be fully rendered
        setTimeout(() => {
          // Get map container dimensions
          const mapSize = map.getSize();
          
          // Calculate popup dimensions and offset
          const popupElement = e.popup.getElement();
          if (popupElement) {
            const popupHeight = popupElement.offsetHeight || 180; // fallback height
            
            // Calculate offset to center both icon and popup
            // Move the center point up by half the popup height to ensure full visibility
            // The marker icon's anchor is typically at the bottom center.
            // We want to shift the map upwards so that the marker's tip remains
            // visible and the popup above it also fits.
            // A common strategy is to shift up by half the popup height, plus a bit more
            // if the marker icon itself has significant height above its anchor.
            // Given iconAnchor [20, 50], the base of the icon is at latLng.
            // The popupAnchor [0, -50] places the popup above the icon's tip.
            // If the popup is, say, 180px high, half of that is 90px.
            // We want the *top* of the popup to be visible. So, we shift the map up.
            // The existing popup has a maxWidth 200px and a fixed internal width 180px.
            // The key is to lift the map's center so the whole popup is visible.
            
            // Convert current latLng to pixel coordinates
            const pixelCenter = map.latLngToContainerPoint(latLng);
            
            // Calculate the adjusted pixel y-coordinate.
            // The popup's tip is at the marker's anchor point.
            // The popup is positioned above the marker. If the popup has height H,
            // we want to move the map such that the marker's anchor is now at
            // map center + H/2 (relative to current position, moving map up means marker moves down in viewport).
            // So, new pixel Y for the anchor should be `current_pixel_Y - (popupHeight / 2)`.
            // However, the popup is *already* offset from the marker's top.
            // Let's assume we want the *middle* of the popup content (including image) to be vertically centered.
            // The popup is shown directly above the marker. The marker's iconAnchor is [20,50] (bottom center).
            // The popupAnchor is [0, -50], meaning its tip is 50px above the iconAnchor.
            // This means the effective bottom of the popup content is 50px above the marker's base.
            // If the popup is H high, then its center is H/2 above its tip.
            // So, the total shift for the new center needs to be `(H/2) + 50` pixels upwards from the marker's base.
            
            // Let's go simpler: the current method ensures the popup content is visible.
            // We want the *marker and popup* to be visually centered.
            // The popup content starts effectively at `pixelCenter.y - iconAnchorY - popupAnchorY`.
            // The popup's total height is `popupHeight`.
            // We need to shift the map up by `popupHeight / 2` relative to the marker's anchor.
            // The goal is for the entire marker+popup combo to be visually centered.
            // The popup is effectively above the marker. We need to shift the map up
            // such that the center of the visible area now contains both.
            // A simple approximation is to move the map up by half the popup's height.
            
            const offsetY = popupHeight / 2; // Shift up by half the popup's height
            
            const adjustedCenter = map.containerPointToLatLng([
              pixelCenter.x, 
              pixelCenter.y - offsetY
            ]);
            
            // Smoothly pan to the adjusted center
            map.flyTo(adjustedCenter, map.getZoom(), {
              duration: 0.8,
              easeLinearity: 0.5
            });
          } else {
            // Fallback if popup element not found - basic centering
            map.flyTo(latLng, map.getZoom(), {
              duration: 0.6
            });
          }
        }, 150); // Increased timeout to ensure popup is fully rendered
      }
    };

    // Listen for the 'popupopen' event on the map
    map.on('popupopen', onPopupOpen);

    // Cleanup function to remove the event listener
    return () => {
      map.off('popupopen', onPopupOpen);
    };
  }, [map]);

  return null; // This component does not render anything
};


const LoadingPlaceholder = () => (
  <div className="w-full h-full flex items-center justify-center bg-gray-100" style={{ minHeight: '400px' }}>
    <div className="text-center">
      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
      <p className="text-gray-600">Configuring map...</p>
    </div>
  </div>
);

export default function SimpleMap({ campaigns, userLocation, onMarkerClick }) {
  const [tileConfig, setTileConfig] = useState(null);
  const [error, setError] = useState('');
  const [mapKey, setMapKey] = useState(Date.now());

  useEffect(() => {
    const fetchMapConfig = async () => {
      try {
        console.log('🗺️ Fetching Mapbox configuration...');
        const response = await getMapboxConfig();
        const data = response?.data || response;
        
        if (!data?.accessToken || !data?.styleUrl) {
          throw new Error("Mapbox credentials missing");
        }
        
        const tileUrl = `https://api.mapbox.com/styles/v1/${data.styleUrl}/tiles/{z}/{x}/{y}?access_token=${data.accessToken}`;
        console.log('✅ Mapbox configured successfully');
        
        setTileConfig({
          url: tileUrl,
          attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 18,
        });
        
      } catch (e) {
        console.error("❌ Mapbox error:", e);
        setError("Mapbox unavailable - using OpenStreetMap");
        setTileConfig({
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        });
      } finally {
        setMapKey(Date.now());
      }
    };

    fetchMapConfig();
  }, []);

  const createCashieIcon = () => {
    return L.icon({
      iconUrl: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/7104ec59e_CashPOIIcon02.png',
      iconSize: [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50],
    });
  };

  const defaultCenter = userLocation ? [userLocation.lat, userLocation.lng] : [40.7589, -73.9851];

  if (!tileConfig) {
    return <LoadingPlaceholder />;
  }

  return (
    <div className="w-full h-full relative" style={{ minHeight: '400px' }}>
      {error && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-100 border border-yellow-300 rounded p-2 z-[1000] text-center text-xs text-yellow-800">
          {error}
        </div>
      )}
      
      <MapContainer
        key={mapKey}
        center={defaultCenter}
        zoom={13}
        style={{ width: '100%', height: '100%', minHeight: '400px' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <MapUpdater />
        <MapPopupHandler />
        <TileLayer
          {...tileConfig}
          eventHandlers={{
            tileerror: (err) => {
              const tileSrc = err.tile?.src || 'N/A';
              const errorMessage = err.error?.message || 'Unknown tile error';
              console.error(`Tile loading error. URL: ${tileSrc}, Message: ${errorMessage}`);
              if (tileConfig.url.includes('mapbox')) {
                setError('Mapbox tiles failed. Switched to backup.');
                setTileConfig({
                  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                  maxZoom: 19,
                });
                setMapKey(Date.now());
              } else {
                 setError('All map data sources are currently unavailable.');
              }
            }
          }}
        />
        
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'user-location-marker',
              html: `<div style="width:20px; height:20px; background:#1E90FF; border:3px solid white; border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })}
          >
            <Popup closeButton={true} autoClose={false} closeOnClick={false}>
              <div style={{ padding: '8px', minWidth: '150px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '14px' }}>Your Location</h3>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>You are here</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Campaign POI Markers - Enhanced centering */}
        {campaigns && campaigns.length > 0 && campaigns.map((campaign) => {
          if (!campaign.locations || !Array.isArray(campaign.locations) || campaign.locations.length === 0) return null;
          
          return campaign.locations.map((location, index) => {
            // Ensure coordinates are numbers and valid
            const latNum = typeof location.latitude === 'number' ? location.latitude : parseFloat(location.latitude);
            const lngNum = typeof location.longitude === 'number' ? location.longitude : parseFloat(location.longitude);
            
            // Strict validation for precise placement
            if (isNaN(latNum) || isNaN(lngNum) || 
                latNum < -90 || latNum > 90 || 
                lngNum < -180 || lngNum > 180 || 
                (latNum === 0 && lngNum === 0)) {
              console.warn(`Invalid coordinates for campaign ${campaign.id} location ${index}:`, { lat: latNum, lng: lngNum });
              return null;
            }
            
            return (
              <Marker
                key={`${campaign.id}-${index}`}
                position={[latNum, lngNum]}
                icon={createCashieIcon()}
              >
                <Popup 
                  closeButton={true} 
                  autoClose={false} 
                  closeOnClick={false} 
                  maxWidth={200}
                  className="campaign-popup"
                  offset={[0, -10]} // Slight offset to improve visual alignment
                >
                  <div style={{ width: '180px', borderRadius: '8px', overflow: 'hidden' }}>
                    {/* Campaign Image */}
                    {campaign.image_url && (
                      <img 
                        src={campaign.image_url} 
                        alt={campaign.title} 
                        style={{ width: '100%', height: '80px', objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    
                    <div style={{ padding: '10px' }}>
                      {/* Campaign Name */}
                      <h3 style={{ 
                        margin: '0 0 8px 0', 
                        fontWeight: '600', 
                        fontSize: '14px', 
                        color: '#1f2937', 
                        lineHeight: '1.2',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {campaign.title}
                      </h3>
                      
                      {/* Reward Amount */}
                      <div style={{ 
                        display: 'inline-block',
                        backgroundColor: '#10b981', 
                        color: 'white', 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '12px', 
                        fontWeight: '600',
                        marginBottom: '8px'
                      }}>
                        ${campaign.reward_amount}
                      </div>
                      
                      {/* Requirements Dropdown */}
                      {campaign.requirements && campaign.requirements.length > 0 && (
                        <details style={{ marginBottom: '8px' }}>
                          <summary style={{ 
                            fontWeight: '500', 
                            fontSize: '12px', 
                            color: '#374151', 
                            cursor: 'pointer', 
                            listStyle: 'none', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '2px 0'
                          }}>
                            Requirements
                            <span style={{ fontSize: '10px', transition: 'transform 0.2s' }}>▼</span>
                          </summary>
                          <div style={{ 
                            marginTop: '4px', 
                            padding: '6px', 
                            backgroundColor: '#f9fafb', 
                            borderRadius: '4px',
                            border: '1px solid #e5e7eb'
                          }}>
                            {campaign.requirements.map((req, i) => (
                              <div key={i} style={{ 
                                fontSize: '11px', 
                                color: '#6b7280', 
                                marginBottom: i < campaign.requirements.length - 1 ? '3px' : '0',
                                lineHeight: '1.3'
                              }}>
                                • {req}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      
                      {/* Check In Button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault(); 
                          e.stopPropagation();
                          if (onMarkerClick) onMarkerClick(campaign);
                        }}
                        style={{ 
                          backgroundColor: '#2563eb', 
                          color: 'white', 
                          border: 'none', 
                          padding: '8px 16px', 
                          borderRadius: '6px', 
                          fontSize: '12px', 
                          fontWeight: '600',
                          cursor: 'pointer', 
                          width: '100%',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
                      >
                        Check In
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          }).filter(Boolean);
        })}
      </MapContainer>
      
      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 8px !important;
          padding: 0 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          line-height: 1.2 !important;
        }
        .leaflet-popup-tip {
          background: white !important;
        }
        .campaign-popup .leaflet-popup-content-wrapper {
          max-width: 200px !important; /* Adjusted max-width for the new content */
        }
        .campaign-popup details[open] summary span {
          transform: rotate(180deg);
        }
      `}</style>
    </div>
  );
}