// Global values provided via the API
declare var looker: Looker
declare var LookerCharts: LookerChartUtils
declare var require: any

import * as d3 from 'd3'
import { handleErrors } from '../common/utils'
/**
 * TODO install this version?
 * https://github.com/ugomeda/d3-liquid-fill-gauge
 * hmm, it's not published on npm
 */
const LiquidFillGauge = require('./liquid_fill_gauge.js')

import {
  Cell,
  Link,
  Looker,
  LookerChartUtils,
  VisualizationDefinition,
  VisOptions,
  VisConfig,
  VisQueryResponse
} from '../types/types'

interface LiquidFillGaugeVisualization extends VisualizationDefinition {
  svg?: any,
  gauge?: any,
}

const defaults = LiquidFillGauge.liquidFillGaugeDefaultSettings()

const vis: LiquidFillGaugeVisualization = {
  id: 'liquid_fill_gauge', // id/label not required, but nice for testing and keeping manifests in sync
  label: 'Liquid Fill Gauge',
  options: {
    showComparison: {
      label: 'Use field comparison',
      default: false,
      section: 'Value',
      type: 'boolean'
    },
    minValue: {
      label: 'Min value',
      min: 0,
      default: defaults.minValue,
      section: 'Value',
      type: 'number',
      placeholder: 'Any positive number'
    },
    maxValue: {
      label: 'Max value',
      min: 0,
      default: defaults.maxValue,
      section: 'Value',
      type: 'number',
      placeholder: 'Any positive number',
      hidden(config: VisConfig, queryResponse: VisQueryResponse) {
        return config.showComparison
      }
    },
    circleThickness: {
      label: 'Circle Thickness',
      min: 0,
      max: 1,
      step: 0.05,
      default: defaults.circleThickness,
      section: 'Style',
      type: 'number',
      display: 'range'
    },
    circleFillGap: {
      label: 'Circle Gap',
      min: 0,
      max: 1,
      step: 0.05,
      default: defaults.circleFillGap,
      section: 'Style',
      type: 'number',
      display: 'range'
    },
    circleColor: {
      label: 'Circle Color',
      default: defaults.circleFillGap,
      section: 'Style',
      type: 'string',
      display: 'color'
    },
    waveHeight: {
      label: 'Wave Height',
      min: 0,
      max: 1,
      step: 0.05,
      default: defaults.waveHeight,
      section: 'Waves',
      type: 'number',
      display: 'range'
    },
    waveCount: {
      label: 'Wave Count',
      min: 0,
      max: 10,
      default: defaults.waveCount,
      section: 'Waves',
      type: 'number',
      display: 'range'
    },
    waveRiseTime: {
      label: 'Wave Rise Time',
      min: 0,
      max: 5000,
      step: 50,
      default: defaults.waveRiseTime,
      section: 'Waves',
      type: 'number',
      display: 'range'
    },
    waveAnimateTime: {
      label: 'Wave Animation Time',
      min: 0,
      max: 5000,
      step: 50,
      default: 1800,
      section: 'Waves',
      type: 'number',
      display: 'range'
    },
    waveRise: {
      label: 'Wave Rise from Bottom',
      default: defaults.waveRise,
      section: 'Waves',
      type: 'boolean'
    },
    waveHeightScaling: {
      label: 'Scale waves if high or low',
      default: defaults.waveHeightScaling,
      section: 'Waves',
      type: 'boolean'
    },
    waveAnimate: {
      label: 'Animate Waves',
      default: true,
      section: 'Waves',
      type: 'boolean'
    },
    waveColor: {
      label: 'Wave Color',
      default: '#64518A',
      section: 'Style',
      type: 'string',
      display: 'color'
    },
    waveOffset: {
      label: 'Wave Offset',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0,
      section: 'Waves',
      type: 'number',
      display: 'range'
    },
    textVertPosition: {
      label: 'Text Vertical Offset',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      section: 'Value',
      type: 'number',
      display: 'range'
    },
    textSize: {
      label: 'Text Size',
      min: 0,
      max: 1,
      step: 0.01,
      default: 1,
      section: 'Value',
      type: 'number',
      display: 'range'
    },
    valueCountUp: {
      label: 'Animate to Value',
      default: true,
      section: 'Waves',
      type: 'boolean'
    },
    displayPercent: {
      label: 'Display as Percent',
      default: true,
      section: 'Value',
      type: 'boolean'
    },
    textColor: {
      label: 'Text Color (non-overlapped)',
      default: '#000000',
      section: 'Style',
      type: 'string',
      display: 'color'
    },
    waveTextColor: {
      label: 'Text Color (overlapped)',
      default: '#FFFFFF',
      section: 'Style',
      type: 'string',
      display: 'color'
    }
  },
  // Set up the initial state of the visualization
  create(element, config) {
    element.style.margin = '10px'
    element.innerHTML = `
      <style>
      .node,
      .link {
        transition: 0.5s opacity;
      }
      </style>
    `
    const elementId = `fill-gauge-${Date.now()}`
    this.svg = d3.select(element).append('svg')
    this.svg.attr('id', elementId)
  },
  // Render in response to the data or settings changing
  update(data, element, config, queryResponse) {
    // TODO error handling
    if (!handleErrors(this, queryResponse, {
      min_pivots: 0, max_pivots: 0,
      min_dimensions: 0, max_dimensions: undefined,
      min_measures: 1, max_measures: undefined
    })) return

    const gaugeConfig = Object.assign(LiquidFillGauge.liquidFillGaugeDefaultSettings(), config)

    const datumField = queryResponse.fields.measure_like[0]
    const datum = data[0][datumField.name]
    let value = datum.value

    const compareField = queryResponse.fields.measure_like[1]
    if (compareField && gaugeConfig.showComparison) {
      const compareDatum = data[0][compareField.name]
      gaugeConfig.maxValue = compareDatum.value
    }

    if (gaugeConfig.displayPercent) {
      value = datum.value / gaugeConfig.maxValue * 100
      gaugeConfig.maxValue = 100
    }

    this.svg.html('')
    this.svg.attr('width', element.clientWidth - 20)
    this.svg.attr('height', element.clientHeight - 20)

    this.gauge = LiquidFillGauge.loadLiquidFillGauge(this.svg.attr('id'), value, gaugeConfig)

  }
}

looker.plugins.visualizations.add(vis)
