/**
 * CDP Dashboard - Main Component
 *
 * Clean Tremor.so dashboard design for CDP analytics.
 */

import { useState, useEffect } from 'react'
import {
  Card,
  Title,
  Text,
  Metric,
  Flex,
  Grid,
  Col,
  Badge,
  TabGroup,
  TabList,
  Tab,
  AreaChart,
  DonutChart,
  BarList,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  ProgressBar,
  BadgeDelta,
  Legend,
} from '@tremor/react'
import type { CDPMetrics, TimeRange, CDPEvent, SearchQuery } from './types'

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
]

// Generate mock chart data for area charts
function generateChartData(days: number) {
  const data = []
  const now = new Date()
  for (let i = days; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      'Backyard Betty': Math.floor(300 + Math.random() * 200 + (days - i) * 5),
      'Broiler Bill': Math.floor(100 + Math.random() * 80 + (days - i) * 2),
      'Turf Pro Taylor': Math.floor(50 + Math.random() * 40 + (days - i) * 1),
    })
  }
  return data
}

export default function CDPDashboard() {
  const [range, setRange] = useState<TimeRange>('30d')
  const [metrics, setMetrics] = useState<CDPMetrics | null>(null)
  const [events, setEvents] = useState<CDPEvent[]>([])
  const [searches, setSearches] = useState<SearchQuery[]>([])
  const [loading, setLoading] = useState(true)

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const chartData = generateChartData(days)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [metricsRes, eventsRes, searchesRes] = await Promise.all([
          fetch(`/api/cdp/metrics?range=${range}`),
          fetch('/api/cdp/events?limit=20'),
          fetch('/api/cdp/searches?limit=10'),
        ])

        const [metricsData, eventsData, searchesData] = await Promise.all([
          metricsRes.json(),
          eventsRes.json(),
          searchesRes.json(),
        ])

        setMetrics(metricsData)
        setEvents(eventsData.events)
        setSearches(searchesData.searches)
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = window.setInterval(fetchData, 120000)
    return () => window.clearInterval(interval)
  }, [range])

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(v)

  const formatNumber = (v: number) => new Intl.NumberFormat('en-US').format(v)

  const formatTime = (timestamp: string) => {
    const diffMins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    return `${Math.floor(diffMins / 60)}h ago`
  }

  if (loading && !metrics) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 rounded-lg bg-gray-200" />
        <div className="grid grid-cols-3 gap-6">
          <div className="h-40 rounded-lg bg-gray-200" />
          <div className="h-40 rounded-lg bg-gray-200" />
          <div className="h-40 rounded-lg bg-gray-200" />
        </div>
      </div>
    )
  }

  const tunnelData = metrics
    ? [
        { name: 'Backyard Betty', value: metrics.tunnels.betty.conversions },
        { name: 'Broiler Bill', value: metrics.tunnels.bill.conversions },
        { name: 'Turf Pro Taylor', value: metrics.tunnels.taylor.conversions },
      ]
    : []

  const personaData =
    metrics?.personaDistribution.map((p) => ({
      name: p.label,
      value: p.count,
    })) || []

  const funnelData =
    metrics?.journeyFunnel.map((s) => ({
      name: s.label,
      value: s.count,
    })) || []

  const searchData = searches.map((s) => ({
    name: s.query,
    value: s.count,
  }))

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <Metric>CDP Analytics</Metric>
          <Text>Real-time persona targeting & conversion tracking</Text>
        </div>
        <TabGroup
          index={TIME_RANGES.findIndex((r) => r.value === range)}
          onIndexChange={(i) => setRange(TIME_RANGES[i].value)}
        >
          <TabList variant="solid" color="gray">
            {TIME_RANGES.map((r) => (
              <Tab key={r.value}>{r.label}</Tab>
            ))}
          </TabList>
        </TabGroup>
      </div>

      {/* KPI Cards Row */}
      <Grid numItemsMd={2} numItemsLg={4} className="gap-6">
        <Card decoration="top" decorationColor="amber">
          <Flex alignItems="start">
            <div>
              <Text>Total Visitors</Text>
              <Metric>
                {formatNumber(metrics?.personaDistribution.reduce((a, b) => a + b.count, 0) || 0)}
              </Metric>
            </div>
            <BadgeDelta deltaType="increase">+12.3%</BadgeDelta>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Flex alignItems="start">
            <div>
              <Text>Conversions</Text>
              <Metric>
                {formatNumber(
                  (metrics?.tunnels.betty.conversions || 0) +
                    (metrics?.tunnels.bill.conversions || 0) +
                    (metrics?.tunnels.taylor.conversions || 0)
                )}
              </Metric>
            </div>
            <BadgeDelta deltaType="increase">+8.1%</BadgeDelta>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start">
            <div>
              <Text>Revenue</Text>
              <Metric>
                {formatCurrency(
                  (metrics?.tunnels.betty.revenue || 0) +
                    (metrics?.tunnels.bill.revenue || 0) +
                    (metrics?.tunnels.taylor.revenue || 0)
                )}
              </Metric>
            </div>
            <BadgeDelta deltaType="increase">+15.2%</BadgeDelta>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="violet">
          <Flex alignItems="start">
            <div>
              <Text>Avg Conv. Rate</Text>
              <Metric>
                {(
                  (metrics?.tunnels.betty.conversionRate || 0) +
                  (metrics?.tunnels.bill.conversionRate || 0) +
                  (metrics?.tunnels.taylor.conversionRate || 0) / 3
                ).toFixed(1)}
                %
              </Metric>
            </div>
            <BadgeDelta deltaType="moderateIncrease">+2.4%</BadgeDelta>
          </Flex>
        </Card>
      </Grid>

      {/* Main Charts Row */}
      <Grid numItemsMd={2} className="gap-6">
        {/* Visitors by Tunnel Over Time */}
        <Card>
          <Title>Visitors by Tunnel</Title>
          <Text>Daily visitor count by persona tunnel</Text>
          <AreaChart
            className="mt-4 h-72"
            data={chartData}
            index="date"
            categories={['Backyard Betty', 'Broiler Bill', 'Turf Pro Taylor']}
            colors={['amber', 'emerald', 'cyan']}
            valueFormatter={formatNumber}
            showLegend={true}
            showGridLines={false}
            curveType="monotone"
          />
        </Card>

        {/* A/B Test Results */}
        <Card>
          <Flex alignItems="start">
            <div>
              <Title>A/B Test: Tunnel vs Generic</Title>
              <Text>Homepage personalization experiment</Text>
            </div>
            <Badge color="emerald" size="sm">
              Winner: Tunnel
            </Badge>
          </Flex>

          <div className="mt-6 space-y-6">
            <div>
              <Flex>
                <Text>Generic (Control)</Text>
                <Text>{metrics?.abTests.tunnelVsGeneric.control.conversionRate}%</Text>
              </Flex>
              <ProgressBar
                value={metrics?.abTests.tunnelVsGeneric.control.conversionRate || 0}
                color="gray"
                className="mt-2"
              />
            </div>
            <div>
              <Flex>
                <Text>Personalized Tunnel</Text>
                <Text className="font-semibold text-emerald-600">
                  {metrics?.abTests.tunnelVsGeneric.treatment.conversionRate}%
                </Text>
              </Flex>
              <ProgressBar
                value={metrics?.abTests.tunnelVsGeneric.treatment.conversionRate || 0}
                color="emerald"
                className="mt-2"
              />
            </div>

            <Card className="border-emerald-200 bg-emerald-50">
              <Flex>
                <div>
                  <Text className="font-medium text-emerald-800">Tunnel variant is winning</Text>
                  <Text className="text-emerald-600">
                    +{metrics?.abTests.tunnelVsGeneric.treatment.lift?.toFixed(0)}% lift at{' '}
                    {metrics?.abTests.tunnelVsGeneric.confidence}% confidence
                  </Text>
                </div>
                <Metric className="text-emerald-700">
                  {metrics?.abTests.tunnelVsGeneric.treatment.conversionRate}%
                </Metric>
              </Flex>
            </Card>
          </div>
        </Card>
      </Grid>

      {/* Tunnel Performance Cards */}
      <Grid numItemsMd={3} className="gap-6">
        {/* Betty */}
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50">
          <Flex alignItems="start">
            <div>
              <Text className="text-amber-800">Backyard Betty</Text>
              <Metric className="text-amber-900">{metrics?.tunnels.betty.conversionRate}%</Metric>
            </div>
            <BadgeDelta
              deltaType={
                metrics?.tunnels.betty.trend && metrics.tunnels.betty.trend >= 0
                  ? 'increase'
                  : 'decrease'
              }
            >
              {metrics?.tunnels.betty.trend}%
            </BadgeDelta>
          </Flex>
          <Flex className="mt-4 space-x-4">
            <div className="flex-1">
              <Text className="text-xs text-amber-700">Views</Text>
              <Text className="font-semibold text-amber-900">
                {formatNumber(metrics?.tunnels.betty.views || 0)}
              </Text>
            </div>
            <div className="flex-1">
              <Text className="text-xs text-amber-700">Conv.</Text>
              <Text className="font-semibold text-amber-900">
                {formatNumber(metrics?.tunnels.betty.conversions || 0)}
              </Text>
            </div>
            <div className="flex-1">
              <Text className="text-xs text-amber-700">Revenue</Text>
              <Text className="font-semibold text-amber-900">
                {formatCurrency(metrics?.tunnels.betty.revenue || 0)}
              </Text>
            </div>
          </Flex>
        </Card>

        {/* Bill */}
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50">
          <Flex alignItems="start">
            <div>
              <Text className="text-emerald-800">Broiler Bill</Text>
              <Metric className="text-emerald-900">{metrics?.tunnels.bill.conversionRate}%</Metric>
            </div>
            <BadgeDelta
              deltaType={
                metrics?.tunnels.bill.trend && metrics.tunnels.bill.trend >= 0
                  ? 'increase'
                  : 'decrease'
              }
            >
              {metrics?.tunnels.bill.trend}%
            </BadgeDelta>
          </Flex>
          <Flex className="mt-4 space-x-4">
            <div className="flex-1">
              <Text className="text-xs text-emerald-700">Views</Text>
              <Text className="font-semibold text-emerald-900">
                {formatNumber(metrics?.tunnels.bill.views || 0)}
              </Text>
            </div>
            <div className="flex-1">
              <Text className="text-xs text-emerald-700">Conv.</Text>
              <Text className="font-semibold text-emerald-900">
                {formatNumber(metrics?.tunnels.bill.conversions || 0)}
              </Text>
            </div>
            <div className="flex-1">
              <Text className="text-xs text-emerald-700">Revenue</Text>
              <Text className="font-semibold text-emerald-900">
                {formatCurrency(metrics?.tunnels.bill.revenue || 0)}
              </Text>
            </div>
          </Flex>
        </Card>

        {/* Taylor */}
        <Card className="bg-gradient-to-br from-cyan-50 to-teal-50">
          <Flex alignItems="start">
            <div>
              <Text className="text-cyan-800">Turf Pro Taylor</Text>
              <Metric className="text-cyan-900">{metrics?.tunnels.taylor.conversionRate}%</Metric>
            </div>
            <BadgeDelta
              deltaType={
                metrics?.tunnels.taylor.trend && metrics.tunnels.taylor.trend >= 0
                  ? 'increase'
                  : 'decrease'
              }
            >
              {metrics?.tunnels.taylor.trend}%
            </BadgeDelta>
          </Flex>
          <Flex className="mt-4 space-x-4">
            <div className="flex-1">
              <Text className="text-xs text-cyan-700">Views</Text>
              <Text className="font-semibold text-cyan-900">
                {formatNumber(metrics?.tunnels.taylor.views || 0)}
              </Text>
            </div>
            <div className="flex-1">
              <Text className="text-xs text-cyan-700">Conv.</Text>
              <Text className="font-semibold text-cyan-900">
                {formatNumber(metrics?.tunnels.taylor.conversions || 0)}
              </Text>
            </div>
            <div className="flex-1">
              <Text className="text-xs text-cyan-700">Revenue</Text>
              <Text className="font-semibold text-cyan-900">
                {formatCurrency(metrics?.tunnels.taylor.revenue || 0)}
              </Text>
            </div>
          </Flex>
        </Card>
      </Grid>

      {/* Bottom Row */}
      <Grid numItemsMd={3} className="gap-6">
        {/* Persona Distribution */}
        <Card>
          <Title>Persona Distribution</Title>
          <DonutChart
            className="mt-6 h-40"
            data={personaData}
            category="value"
            index="name"
            colors={['amber', 'emerald', 'cyan', 'gray']}
            valueFormatter={formatNumber}
            showAnimation={true}
          />
          <Legend
            className="mt-4"
            categories={personaData.map((p) => p.name)}
            colors={['amber', 'emerald', 'cyan', 'gray']}
          />
        </Card>

        {/* Journey Funnel */}
        <Card>
          <Title>Customer Journey</Title>
          <Text>Progression through stages</Text>
          <BarList
            data={funnelData.slice(0, 6)}
            className="mt-4"
            color="emerald"
            valueFormatter={formatNumber}
          />
        </Card>

        {/* Top Searches */}
        <Card>
          <Title>Top Searches</Title>
          <Text>Most searched terms</Text>
          <BarList
            data={searchData.slice(0, 6)}
            className="mt-4"
            color="blue"
            valueFormatter={(v: number) => `${v}`}
          />
        </Card>
      </Grid>

      {/* Events Table */}
      <Card>
        <Title>Recent Events</Title>
        <Text>Live CDP event stream</Text>
        <Table className="mt-4">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Event</TableHeaderCell>
              <TableHeaderCell>Persona</TableHeaderCell>
              <TableHeaderCell>Stage</TableHeaderCell>
              <TableHeaderCell>Time</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.slice(0, 8).map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <Badge
                    color={
                      event.type.includes('conversion')
                        ? 'emerald'
                        : event.type.includes('tunnel')
                          ? 'blue'
                          : event.type.includes('persona')
                            ? 'amber'
                            : 'gray'
                    }
                  >
                    {event.type.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Text className="capitalize">{event.persona || '—'}</Text>
                </TableCell>
                <TableCell>
                  <Text className="capitalize">{event.stage || '—'}</Text>
                </TableCell>
                <TableCell>
                  <Text className="text-gray-500">{formatTime(event.timestamp)}</Text>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
