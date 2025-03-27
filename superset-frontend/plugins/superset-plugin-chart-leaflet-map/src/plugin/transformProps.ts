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
import {
  ChartProps,
  TimeseriesDataRecord,
  CategoricalColorNamespace,
} from '@superset-ui/core';
import { string } from 'prop-types';

export default function transformProps(chartProps: ChartProps) {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your SupersetPluginChartLeafletMap.tsx file, but
   * doing supplying custom props here is often handy for integrating third
   * party libraries that rely on specific props.
   *
   * A description of properties in `chartProps`:
   * - `height`, `width`: the height/width of the DOM element in which
   *   the chart is located
   * - `formData`: the chart data request payload that was sent to the
   *   backend.
   * - `queriesData`: the chart data response payload that was received
   *   from the backend. Some notable properties of `queriesData`:
   *   - `data`: an array with data, each row with an object mapping
   *     the column/alias to its value. Example:
   *     `[{ col1: 'abc', metric1: 10 }, { col1: 'xyz', metric1: 20 }]`
   *   - `rowcount`: the number of rows in `data`
   *   - `query`: the query that was issued.
   *
   * Please note: the transformProps function gets cached when the
   * application loads. When making changes to the `transformProps`
   * function during development with hot reloading, changes won't
   * be seen until restarting the development server.
   */
  console.log('here', chartProps);

  const {
    width,
    height,
    formData,
    queriesData,
    emitCrossFilters,
    hooks,
    filterState,
    ownState,
  } = chartProps;
  const { boldText, headerFontSize, headerText, colorScheme, sliceId } =
    formData;
  const { onContextMenu, setDataMask } = hooks;
  const data = queriesData[0].data as TimeseriesDataRecord[];

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  // assuming that the column you want to map the colorscheme to is the 3rd row
  // i.e: for our case it is the Category column as the first 2 columns are (y, x)
  // longitude and latitude.
  // therefore we pre-load the color scheme from the category column
  // To do this, since COUNT_DISTINCT returns the order of the number of unique
  // values in the column, we can use this to map the color scheme to the category
  // column.

  // First we count the number of each of the categories in the category column

  const categoryCount = data.reduce<Record<string, number>>((acc, row) => {
    const category = Object.values(row)[2] as string;
    acc[category] = (acc[category] || 0) + 1;

    return acc;
  }, {});

  const sortedCategories = Object.keys(categoryCount).sort(
    (a, b) => categoryCount[b] - categoryCount[a],
  );

  sortedCategories.forEach((category, _) => {
    colorFn(category, sliceId, colorScheme);
  });

  // I can do a lot of processing here, but it ends when it gets a reply
  // from the database
  // thus this is only useful for one transformation, if required.

  return {
    width,
    height,
    queriesData,
    data,
    emitCrossFilters,
    setDataMask,
    onContextMenu,
    filterState,
    filters: filterState.filters,
    // and now your control data, manipulated as needed, and passed through as props!
    boldText,
    headerFontSize,
    headerText,
    colorFn,
    sliceId,
    ownState,
    colorScheme,
  };
}
