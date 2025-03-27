/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, {
  useEffect,
  createRef,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import {
  DataMask,
  DataRecordValue,
  Filter,
  QueryObjectFilterClause,
  styled,
  TimeseriesDataRecord,
} from '@superset-ui/core';
import {
  SupersetPluginChartLeafletMapProps,
  SupersetPluginChartLeafletMapStylesProps,
} from './types';
import { createToolTip } from './utils';

import L, { marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

const Styles = styled.div<SupersetPluginChartLeafletMapStylesProps>`
  background-color: ${({ theme }) => theme.colors.secondary.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;

  h3 {
    /* You can use your props to control CSS! */
    margin-top: 0;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    font-size: ${({ theme, headerFontSize }) =>
      theme.typography.sizes[headerFontSize]}px;
    font-weight: ${({ theme, boldText }) =>
      theme.typography.weights[boldText ? 'bold' : 'normal']};
  }

  pre {
    height: ${({ theme, headerFontSize, height }) =>
      height - theme.gridUnit * 12 - theme.typography.sizes[headerFontSize]}px;
  }
`;

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

export default function SupersetPluginChartLeafletMap(
  props: SupersetPluginChartLeafletMapProps,
) {
  // height and width are the height and width of the DOM element as it exists in the dashboard.
  // There is also a `data` prop, which is, of course, your DATA 🎉
  const {
    data,
    height,
    width,
    emitCrossFilters,
    setDataMask,
    onContextMenu,
    filterState,
    filters,
    colorScheme,
    colorFn,
    sliceId,
  } = props;

  const hasBeenRendered = useRef(false);

  const mapContainerRef = createRef<HTMLDivElement>();
  const legendRef = useRef<L.Control | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  const markers = useRef<Record<string, L.CircleMarker[]>>({}); // I want to also store the Id here
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          data.map((row: any) => {
            const values = Object.values(row);
            return values[2] as string;
          }),
        ),
      ).sort((a, b) => a.localeCompare(b, 'ar')),
    [data],
  );

  useEffect(() => {
    if (!emitCrossFilters || !hasBeenRendered.current) return;
    // Check that the current filter isn't active
    const dataMask = getCrossFilterDataMask(
      Object.keys(data[0])[2],
      Object.keys(data[0])[3],
    );

    const f = filterState.filters;
    if (f && dataMask.filterState) {
      const filtersApplied = f.every((filter: QueryObjectFilterClause) => {
        dataMask.filterState!.filters.includes(filter);
      });
      if (filtersApplied && f.length === dataMask.filterState.filters.length)
        return;
    }

    setDataMask(dataMask);
  }, [activeCategory, activeMarker]);

  const getCrossFilterDataMask = (
    categoryCol: string,
    idCol: string,
  ): DataMask => {
    // just take the category and the id column names
    const filters: QueryObjectFilterClause[] = [];

    if (activeCategory) {
      filters.push({
        col: categoryCol,
        op: 'IN',
        val: [activeCategory],
      });
    }
    if (activeMarker) {
      filters.push({
        col: idCol,
        op: 'IN',
        val: [activeMarker],
      });
    }
    return {
      extraFormData: {
        filters: filters,
      },
      filterState: {
        // value: activeCategory ? [activeCategory] : [],
        // selectedValues: activeCategory ? [activeCategory] : []
        filters,
      },
    };
  };

  useEffect(() => {
    if (mapContainerRef.current && !mapInstance.current) {
      mapInstance.current = L.map(mapContainerRef.current, {
        center: [29.3759, 47.9774],
        zoom: 10,
        maxBounds: [
          [28.5244, 46.5052],
          [30.1035, 48.6051],
        ],
        maxBoundsViscosity: 1.0,
        worldCopyJump: true,
      });

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          noWrap: true,
        },
      ).addTo(mapInstance.current);
    }

    const map = mapInstance.current;
    if (!map) return;

    const filters = filterState.filters;
    let filterCategory = '';

    if (filters) {
      // find the first filter related to the category column
      const categoryFilter = filters.find(
        (x: QueryObjectFilterClause) => x.col === Object.keys(data[0])[2],
      );
      if (categoryFilter) {
        debugger;
        if (Array.isArray(categoryFilter.val))
          filterCategory = categoryFilter.val[0];
        else filterCategory = categoryFilter.val;
      }
    }

    markersLayer.current = L.layerGroup().addTo(map);

    data.forEach((row: any) => {
      const values = Object.values(row);

      const longitude = parseFloat(values[0] as string);
      const latitude = parseFloat(values[1] as string);

      const category = values[2] as string;

      if (longitude && latitude) {
        const currMarker = L.circleMarker([latitude, longitude], {
          radius: 6,
          color: colorFn(category, sliceId, colorScheme),
          fillColor: 'lightBlue',
          fillOpacity: 0.8,
        }).bindTooltip(createToolTip(longitude, latitude, category), {
          direction: 'top',
          offset: [0, -10],
          permanent: false,
          opacity: 1.0,
          className: 'tooltip',
        });

        (currMarker as any).options.id = values[3] as string;

        if (filterCategory === '') currMarker.addTo(markersLayer.current!);
        else if (filterCategory === category)
          currMarker.addTo(markersLayer.current!);

        currMarker.on('click', e => {
          debugger;
          setActiveMarker(prevMarker => {
            if (prevMarker === e.target.options.id) {
              Object.keys(markers.current).forEach(key => {
                markers.current[key].forEach(m => {
                  m.setStyle({ opacity: 1.0 });
                });
              });

              return null;
            }
            Object.keys(markers.current).forEach(key => {
              markers.current[key].forEach(m => {
                if (e.target.options.id === (m as any).options.id)
                  m.setStyle({ opacity: 1.0 });
                else m.setStyle({ opacity: 0.3 });
              });
              return e.target.options.id;
            });

            return e.target.options.id;
          });
        });

        if (!markers.current[category]) markers.current[category] = [];
        markers.current[category].push(currMarker);
      }
    });

    if (legendRef.current) {
      map.removeControl(legendRef.current);
    }

    legendRef.current = new L.Control({ position: 'bottomright' });

    legendRef.current.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend');
      // this should contain the name of the 3rd key
      // the legend of the map is always in the 3rd key (For now);
      const key = Object.keys(data[0])[2];
      div.style.background = 'white';
      div.style.padding = '10px';
      div.style.borderRadius = '5px';
      div.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
      div.innerHTML = `<h5>${key}</h5>`;
      const categoriesToRender = categories;
      categoriesToRender.forEach((category, index) => {
        console.log('------- map chart');
        console.log('name', category);
        console.log('sliceId', sliceId);
        console.log('color', colorFn(category, sliceId, colorScheme));
        console.log('------- map chart');

        div.innerHTML += `
          <div class="legend-item" data-category="${category}" style="display: flex; align-items: center; margin-bottom: 5px; cursor: pointer">
            <span style="
              display: inline-block;
              width: 12px;
              height: 12px;
              background: ${colorFn(category, sliceId, colorScheme)};
              margin-right: 8px;
            "></span> ${category}
          </div>`;
      });

      return div;
    };

    legendRef.current!.addTo(map);

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });

    if (mapContainerRef.current) observer.observe(mapContainerRef.current);

    hasBeenRendered.current = true;

    if (filterCategory !== '') setActiveCategory(filterCategory);

    return () => {
      observer.disconnect();
      markersLayer.current!.clearLayers();
      if (legendRef.current) {
        map.removeControl(legendRef.current);
      }
    };
  }, [data]);

  useEffect(() => {
    if (!legendRef.current) return;

    const legendItems = document.querySelectorAll('.legend-item');

    legendItems.forEach(element => {
      return L.DomEvent.off(element as HTMLElement);
    });

    document.querySelectorAll('.legend-item').forEach(element => {
      L.DomEvent.on(element as HTMLElement, 'click', () => {
        const category = (element as HTMLElement).getAttribute('data-category');
        if (!category) return;
        else if (category === '') return;
        setActiveCategory(prev => {
          if (prev === category) {
            // If already active, reset and show all markers
            markersLayer.current!.clearLayers();
            Object.values(markers.current)
              .flat()
              .forEach(m => m.addTo(markersLayer.current!));
            return null;
          } else {
            // Show only the selected category
            markersLayer.current!.clearLayers();
            markers.current[category]?.forEach(m =>
              m.addTo(markersLayer.current!),
            );
            return category;
          }
        });
        if (!emitCrossFilters) return;
        const dataMask = getCrossFilterDataMask(
          Object.keys(data[0])[2],
          Object.keys(data[0])[3],
        );
        console.log(dataMask);
        setDataMask(dataMask);
      });
    });
  }, [data]);

  return (
    <Styles
      boldText={props.boldText}
      style={{ padding: '0' }}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
      ></div>
    </Styles>
  );
}
