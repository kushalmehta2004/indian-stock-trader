import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend } from 'chart.js';
import 'chartjs-adapter-date-fns'; // For date handling

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend);

function StockChart() {
  const [stockData, setStockData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [signal, setSignal] = useState('');

  useEffect(() => {
    axios.get('/api/stock/RELIANCE')
      .then(response => {
        setStockData(response.data.prices);
        setCurrentPrice(response.data.current_price);
        setSignal(response.data.signal);
      })
      .catch(error => console.error('Error fetching stock data:', error));
  }, []);

  const chartData = {
    labels: stockData.map(d => d.date),
    datasets: [
      {
        label: 'Price',
        data: stockData.map(d => d.close),
        borderColor: 'blue',
        fill: false,
      },
      {
        label: '50-day SMA',
        data: stockData.map(d => d.sma50),
        borderColor: 'green',
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      x: { type: 'time', time: { unit: 'day' } },
      y: { beginAtZero: false },
    },
  };

  return (
    <div>
      <p className="text-lg">Current Price: ₹{currentPrice.toFixed(2)}</p>
      <p className="text-lg">Signal: <span className="font-semibold">{signal}</span></p>
      <Line data={chartData} options={options} />
    </div>
  );
}

export default StockChart;
