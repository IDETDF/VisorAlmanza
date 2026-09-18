// Coordenadas aproximadas de Tierra del Fuego
const INITIAL_CENTER = [-67.5, -54.0];
const INITIAL_ZOOM = 6;

const map = new maplibregl.Map({
    container: 'map',
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
    style: {
        'version': 8,
        'glyphs': 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        'sources': {
            'argenmap-src': {
                'type': 'raster',
                'tiles': [
                    'https://wms.ign.gob.ar/geoserver/gwc/service/wmts?layer=capabaseargenmap&style=normal&tilematrixset=EPSG:3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:3857:{z}&TileCol={x}&TileRow={y}'
                ],
                'tileSize': 256,
                'attribution': '&copy; Instituto Geográfico Nacional de la República Argentina'
            },
            'google-src': {
                'type': 'raster',
                'tiles': [
                    'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
                ],
                'tileSize': 256,
                'attribution': '&copy; Google'
            }
        },
        'layers': [
            {
                'id': 'base-argenmap',
                'type': 'raster',
                'source': 'argenmap-src',
                'layout': { 'visibility': 'visible' }
            },
            {
                'id': 'base-google',
                'type': 'raster',
                'source': 'google-src',
                'layout': { 'visibility': 'none' }
            }
        ]
    }
});

// Lista de SVGs a cargar
const iconList = [
    'comercio', 'cartel', 'obstaculo', 'wifi', 'vial', 
    'escuela', 'plaza', 'posible_encuentro', 'punto_reunion', 'via_escape',
    'almacen', 'gastronomico', 'kiosco', 'pesca', 'comercio_otro', 'otro',
    'foto_svg'
];

map.on('load', () => {
    // 1. Cargar SVGs dinámicamente
    iconList.forEach(iconName => {
        const img = new Image(24, 24);
        img.onload = () => {
            if (!map.hasImage(iconName)) {
                map.addImage(iconName, img);
            }
        };
        img.src = `./svg_icons/${iconName}.svg`;
    });

    // --- CENTRADO AUTOMÁTICO BASADO EN LA CAPA DE RELEVAMIENTO ---
    fetch('./data/relevamiento.geojson')
        .then(response => response.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                let firstCoord = data.features[0].geometry.coordinates;
                let minLng = firstCoord[0], minLat = firstCoord[1];
                let maxLng = firstCoord[0], maxLat = firstCoord[1];

                data.features.forEach(feature => {
                    let coords = feature.geometry.coordinates;
                    if (coords && typeof coords[0] === 'number') {
                        if (coords[0] < minLng) minLng = coords[0];
                        if (coords[1] < minLat) minLat = coords[1];
                        if (coords[0] > maxLng) maxLng = coords[0];
                        if (coords[1] > maxLat) maxLat = coords[1];
                    }
                });

                map.fitBounds(
                    [[minLng, minLat], [maxLng, maxLat]],
                    { padding: 50, duration: 1000 }
                );
            }
        })
        .catch(err => console.error("Error al calcular el encuadre:", err));

    // 2. Fuentes de datos (GeoJSON)
    map.addSource('parcelario-src', { type: 'geojson', data: './data/parcelario.geojson' });
    map.addSource('inundable-src', { type: 'geojson', data: './data/inundable.geojson' });
    map.addSource('ruta-src', { type: 'geojson', data: './data/ruta.geojson' });
    map.addSource('relevamiento-src', { type: 'geojson', data: './data/relevamiento.geojson' });
    map.addSource('fotos-src', { type: 'geojson', data: './data/fotos.geojson' });
    map.addSource('riesgo-src', { type: 'geojson', data: './data/zona_conflicto.geojson' });

    // 3. Capa: Zona Inundable (Oculta por defecto)
    map.addLayer({
        'id': 'capa-inundable',
        'type': 'fill',
        'source': 'inundable-src',
        'layout': {
            'visibility': 'none'
        },
        'paint': {
            'fill-color': '#0097A7',
            'fill-opacity': 0.4
        }
    });

    // 4a. Capa: Parcelario (Relleno y borde)
    map.addLayer({
        'id': 'capa-parcelario',
        'type': 'fill',
        'source': 'parcelario-src',
        'paint': {
            'fill-color': '#E0E0E0',
            'fill-opacity': 0.4,
            'fill-outline-color': '#000000'
        }
    });

    // 4b. Capa: Parcelario (Etiquetas)
    map.addLayer({
        'id': 'capa-parcelario-etiquetas',
        'type': 'symbol',
        'source': 'parcelario-src',
        'layout': {
            'text-field': ['get', 'cca'],
            'text-font': ['Open Sans Regular'],
            'text-size': 11,
            'text-allow-overlap': false
        },
        'paint': {
            'text-color': '#424242',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 1.5
        }
    });

    // 5. Capa: Trackeo de ruta (Oculta por defecto)
    map.addLayer({
        'id': 'capa-ruta',
        'type': 'line',
        'source': 'ruta-src',
        'layout': {
            'visibility': 'none'
        },
        'paint': {
            'line-color': '#D32F2F',
            'line-width': 3,
            'line-dasharray': [2, 1]
        }
    });

    // 6a. Halo de color según "Nivel de Urgencia"
    map.addLayer({
        'id': 'capa-relevamiento-halo',
        'type': 'circle',
        'source': 'relevamiento-src',
        'paint': {
            'circle-radius': 14,
            'circle-color': [
                'match',
                ['get', 'Nivel de Urgencia'],
                'Alta', 'rgba(211,47,47,0.75)',
                'Media', 'rgba(249,168,37,0.66)',
                'rgba(255,255,255,0.66)'
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#424242'
        }
    });

    // 6b. Icono SVG y etiqueta
    map.addLayer({
        'id': 'capa-relevamiento-icono',
        'type': 'symbol',
        'source': 'relevamiento-src',
        'layout': {
            'icon-image': [
                'case',
                ['==', ['get', 'Tipo de elemento preexistente a relevar'], 'Comercios'],
                    ['match', ['get', 'Subtipo de comercio'],
                        'Almacenes', 'almacen',
                        'Gastronómicos', 'gastronomico',
                        'Kioscos', 'kiosco',
                        'Plantas de procesamiento de pesca y puntos de venta', 'pesca',
                        'Otros', 'comercio_otro',
                        'comercio'
                    ],
                ['==', ['get', 'Tipo de elemento preexistente a relevar'], 'Otro'],
                    ['match', ['get', 'Especifique otro tipo de elemento'],
                        'Escuela', 'escuela',
                        'Plaza', 'plaza',
                        'Posible punto de encuentro ', 'posible_encuentro',
                        'Punto de reunión', 'punto_reunion',
                        'Posible vía de escape ', 'via_escape',
                        'otro'
                    ],
                ['match', ['get', 'Tipo de elemento preexistente a relevar'],
                    'Cartelería e información', 'cartel',
                    'Obstáculos en vías de escape', 'obstaculo',
                    'Conectividad Digital (Puntos Wi-Fi)', 'wifi',
                    'Estructura vial', 'vial',
                    'otro'
                ]
            ],
            'icon-size': 1,
            'icon-allow-overlap': true,
            'text-field': [
                'coalesce',
                ['get', 'Nombre del elemento (Ej. Mirador del Beagle)'],
                ['case', 
                    ['==', ['get', 'Tipo de elemento preexistente a relevar'], 'Comercios'], ['coalesce', ['get', 'Subtipo de comercio'], 'Comercios'],
                    ['==', ['get', 'Tipo de elemento preexistente a relevar'], 'Otro'], ['get', 'Especifique otro tipo de elemento'],
                    ['get', 'Tipo de elemento preexistente a relevar']
                ]
            ],
            'text-font': ['Open Sans Regular'],
            'text-size': 12,
            'text-offset': [0, 1.5],
            'text-anchor': 'top'
        },
        'paint': {
            'text-color': '#212121',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2
        }
    });

    // 7. Popups al hacer clic en puntos de relevamiento
    map.on('click', 'capa-relevamiento-icono', (e) => {
        const props = e.features[0].properties;
        
        let htmlContent = '<div style="max-height: 250px; overflow-y: auto; padding-right: 5px;">';
        htmlContent += '<h4 style="margin: 0 0 10px 0; border-bottom: 2px solid #ccc; padding-bottom: 5px;">Detalles del Elemento</h4>';
        htmlContent += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        
        for (const [key, value] of Object.entries(props)) {
            const excluido = key.startsWith('_') || key.startsWith('meta') || key.startsWith('Foto');
            
            if (!excluido && value !== null && value !== undefined && value !== '') {
                htmlContent += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 5px 5px 5px 0; font-weight: bold; width: 45%; vertical-align: top;">${key}:</td>
                        <td style="padding: 5px 0; word-break: break-word; vertical-align: top;">${value}</td>
                    </tr>
                `;
            }
        }
        
        htmlContent += '</table></div>';
        
        new maplibregl.Popup({ maxWidth: '350px' })
            .setLngLat(e.lngLat)
            .setHTML(htmlContent)
            .addTo(map);
    });
    
    map.on('mouseenter', 'capa-relevamiento-icono', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'capa-relevamiento-icono', () => map.getCanvas().style.cursor = '');

    // 8. Capa de Fotos (Oculta por defecto)
    map.addLayer({
        'id': 'capa-fotos',
        'type': 'symbol',
        'source': 'fotos-src',
        'layout': {
            'visibility': 'none',
            'icon-image': 'foto_svg',
            'icon-size': 1,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
        }
    });

    // Popups de Fotos
    map.on('click', 'capa-fotos', (e) => {
        const props = e.features[0].properties;
        let descriptionHTML = props['description'] || props['Name'] || ''; 

        if (descriptionHTML.includes('<img') && descriptionHTML.includes('src="files/')) {
            descriptionHTML = descriptionHTML.replace('src="files/', 'src="./fotos/');
            descriptionHTML = descriptionHTML.replace('width:400px', 'width:100%; max-width:300px; border-radius: 4px;');
        }

        new maplibregl.Popup({ maxWidth: '340px' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="text-align: center;">${descriptionHTML}</div>`)
            .addTo(map);
    });

    map.on('mouseenter', 'capa-fotos', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'capa-fotos', () => map.getCanvas().style.cursor = '');

    // 9. Capa Zona de Riesgo (Oculta por defecto)
    map.addLayer({
        'id': 'capa-riesgo',
        'type': 'fill',
        'source': 'riesgo-src',
        'layout': {
            'visibility': 'none'
        },
        'paint': {
            'fill-color': '#F44336',
            'fill-opacity': 0.4,
            'fill-outline-color': '#B71C1C'
        }
    });
});

// ============================================================
// LÓGICA DE INTERFAZ Y CONTROLES
// ============================================================

// Función para calcular bounding box y hacer zoom a geometrías complejas
function hacerZoomA(url) {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (!data.features || data.features.length === 0) return;
            
            let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
            
            function procesarCoordenadas(coords) {
                if (typeof coords[0] === 'number') {
                    if (coords[0] < minLng) minLng = coords[0];
                    if (coords[1] < minLat) minLat = coords[1];
                    if (coords[0] > maxLng) maxLng = coords[0];
                    if (coords[1] > maxLat) maxLat = coords[1];
                } else if (Array.isArray(coords)) {
                    coords.forEach(procesarCoordenadas);
                }
            }

            data.features.forEach(f => procesarCoordenadas(f.geometry.coordinates));
            
            if (minLng !== 180) { 
                map.fitBounds(
                    [[minLng, minLat], [maxLng, maxLat]],
                    { padding: 50, duration: 1000 }
                );
            }
        })
        .catch(err => console.error("Error al calcular el encuadre:", err));
}

const layerMapping = {
    'toggle-parcelario': ['capa-parcelario', 'capa-parcelario-etiquetas'],
    'toggle-inundable': ['capa-inundable'],
    'toggle-ruta': ['capa-ruta'],
    'toggle-relevamiento': ['capa-relevamiento-halo', 'capa-relevamiento-icono'],
    'toggle-fotos': ['capa-fotos'],
    'toggle-riesgo': ['capa-riesgo']
};

// Alternar visibilidad de capas y gatillar zoom
Object.keys(layerMapping).forEach(checkboxId => {
    document.getElementById(checkboxId).addEventListener('change', function(e) {
        const isChecked = e.target.checked;
        const visibility = isChecked ? 'visible' : 'none';
        
        layerMapping[checkboxId].forEach(layer => {
            if (map.getLayer(layer)) {
                map.setLayoutProperty(layer, 'visibility', visibility);
            }
        });

        if (isChecked) {
            if (checkboxId === 'toggle-inundable') {
                hacerZoomA('./data/inundable.geojson');
            } else if (checkboxId === 'toggle-riesgo') {
                hacerZoomA('./data/zona_conflicto.geojson');
            }
        }
    });
});

// Alternar mapa base
document.querySelectorAll('input[name="basemap"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'argenmap') {
            map.setLayoutProperty('base-argenmap', 'visibility', 'visible');
            map.setLayoutProperty('base-google', 'visibility', 'none');
        } else {
            map.setLayoutProperty('base-argenmap', 'visibility', 'none');
            map.setLayoutProperty('base-google', 'visibility', 'visible');
        }
    });
});


// ============================================================
// COMPORTAMIENTO MÓVIL
// ============================================================
const btnCapas = document.getElementById('btn-capas');
const panelControles = document.getElementById('panel-controles');
const btnCerrar = document.getElementById('btn-cerrar-panel');

if (btnCapas && panelControles && btnCerrar) {
    btnCapas.addEventListener('click', () => {
        panelControles.classList.add('abierto');
    });

    btnCerrar.addEventListener('click', () => {
        panelControles.classList.remove('abierto');
    });
}