type PortfolioPoint = {
  timestamp: number
  value: number
}

export const PortfolioHistoryChart = ({
  points,
  loading,
  formatValue
}: {
  points: PortfolioPoint[]
  loading: boolean
  formatValue: (value: number) => string
}): JSX.Element => {
  if (loading) {
    return <div className='portfolio-chart-empty'>Loading history</div>
  }
  if (points.length < 2) {
    return <div className='portfolio-chart-empty'>No portfolio history</div>
  }

  const width = 640
  const height = 180
  const padding = 18
  const values = points.map(point => point.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueRange = maxValue - minValue || 1
  const path = points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * (width - padding * 2)
      const y =
        height -
        padding -
        ((point.value - minValue) / valueRange) * (height - padding * 2)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <div className='portfolio-chart'>
      <svg viewBox={`0 0 ${width} ${height}`} role='img'>
        <path
          className='portfolio-chart-grid'
          d={`M ${padding} ${height - padding} H ${width - padding}`}
        />
        <path className='portfolio-chart-line' d={path} />
      </svg>
      <div className='portfolio-chart-range'>
        <span>{formatValue(minValue)}</span>
        <span>{formatValue(maxValue)}</span>
      </div>
    </div>
  )
}
